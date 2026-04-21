/**
 * 同一代码（同 secid 或同交易所+代码）的场内持仓合并，避免重复行且保证行情字段完整。
 */

import {
  defaultCurrencyForIntlListingExchange,
  isIntlListingExchange,
} from '@/lib/intl-exchange-stooq';
import {
  getListedUnitPrice,
  isHeldMergeCategory,
  type SimpleAsset,
  type TradeLedgerEntry,
} from '@/types/asset';

/** 同一 category 下区分合并组；无交易所时退化为按代码合并（修复历史脏数据） */
export function listedDuplicateKey(a: SimpleAsset): string | null {
  if (!isHeldMergeCategory(a.category)) return null;
  const intl =
    typeof a.intlQuoteSymbol === 'string' && a.intlQuoteSymbol.trim().length > 0
      ? a.intlQuoteSymbol.trim().toLowerCase()
      : '';
  if (intl) {
    return `${a.category}|intl:${intl}`;
  }
  const sym =
    typeof a.symbol === 'string' && /^\d{6}$/.test(a.symbol.trim())
      ? a.symbol.trim()
      : null;
  if (!sym) return null;
  const emRaw = typeof a.emSecid === 'string' ? a.emSecid.trim() : '';
  const em = emRaw.length > 0 && /^\d+\.\d+$/.test(emRaw) ? emRaw : '';
  if (em) return `${a.category}|e:${em}`;
  const ex = a.exchange;
  if (ex === 'SH' || ex === 'SZ' || ex === 'BJ' || ex === 'OTC') {
    return `${a.category}|x:${ex}:${sym}`;
  }
  return `${a.category}|u:${sym}`;
}

function listedQualityScore(a: SimpleAsset): number {
  let s = 0;
  const iq = typeof a.intlQuoteSymbol === 'string' ? a.intlQuoteSymbol.trim() : '';
  if (iq.length > 0) s += 8;
  const em = typeof a.emSecid === 'string' ? a.emSecid.trim() : '';
  if (em.length > 0 && /^\d+\.\d+$/.test(em)) s += 8;
  const ex = a.exchange;
  if (ex === 'SH' || ex === 'SZ' || ex === 'BJ' || ex === 'OTC') s += 4;
  if (typeof ex === 'string' && isIntlListingExchange(ex)) s += 4;
  if (getListedUnitPrice(a) !== null) s += 2;
  if (typeof a.shares === 'number' && a.shares > 0) s += 1;
  return s;
}

function pickCanonical(group: SimpleAsset[]): SimpleAsset {
  return [...group].sort((a, b) => listedQualityScore(b) - listedQualityScore(a))[0]!;
}

function mergeNames(group: SimpleAsset[]): string {
  const names = group.map((g) => g.name.trim()).filter((n) => n.length > 0);
  if (names.length === 0) return '';
  return names.reduce((a, b) => (b.length > a.length ? b : a));
}

function mergeAccounts(group: SimpleAsset[]): string | undefined {
  const set = new Set(
    group
      .map((g) => (typeof g.account === 'string' ? g.account.trim() : ''))
      .filter((s) => s.length > 0)
  );
  if (set.size === 0) return undefined;
  if (set.size === 1) return [...set][0];
  return [...set].join('、');
}

function mergePurposeFields(group: SimpleAsset[]): {
  purpose?: string;
  purposeTarget?: number;
} {
  const purposes = [
    ...new Set(
      group
        .map((g) => (typeof g.purpose === 'string' ? g.purpose.trim() : ''))
        .filter((p) => p.length > 0)
    ),
  ];
  const purpose =
    purposes.length === 0 ? undefined : purposes.length === 1 ? purposes[0] : purposes.join(' / ');
  const targets = group
    .map((g) => g.purposeTarget)
    .filter((t): t is number => typeof t === 'number' && !Number.isNaN(t) && t > 0);
  const purposeTarget =
    targets.length > 0 ? Math.max(...targets) : undefined;
  return {
    ...(purpose && { purpose }),
    ...(purposeTarget !== undefined && { purposeTarget }),
  };
}

/** 合并同一标的的多条持仓记录时，汇总各条上的加减仓流水（按 id 去重） */
function mergeTradeHistories(group: SimpleAsset[]): TradeLedgerEntry[] | undefined {
  const byId = new Map<string, TradeLedgerEntry>();
  for (const g of group) {
    const h = g.tradeHistory;
    if (!h?.length) continue;
    for (const t of h) {
      if (t?.id && !byId.has(t.id)) byId.set(t.id, t);
    }
  }
  if (byId.size === 0) return undefined;
  return [...byId.values()].sort(
    (a, b) =>
      a.tradeDate.localeCompare(b.tradeDate) || a.id.localeCompare(b.id)
  );
}

function mergeQuoteFields(base: SimpleAsset, group: SimpleAsset[]): SimpleAsset {
  let markPrice = base.markPrice;
  let markPriceDate = base.markPriceDate;
  let lastClose = base.lastClose;
  let lastCloseDate = base.lastCloseDate;
  for (const o of group) {
    if (
      typeof o.markPrice === 'number' &&
      o.markPrice > 0 &&
      (!markPrice ||
        (o.markPriceDate &&
          markPriceDate &&
          o.markPriceDate > markPriceDate) ||
        !markPriceDate)
    ) {
      markPrice = o.markPrice;
      markPriceDate = o.markPriceDate;
    }
    if (
      o.lastClose &&
      o.lastClose > 0 &&
      o.lastCloseDate &&
      (!lastCloseDate || o.lastCloseDate >= lastCloseDate)
    ) {
      lastClose = o.lastClose;
      lastCloseDate = o.lastCloseDate;
    }
  }
  const next = { ...base, markPrice, markPriceDate, lastClose, lastCloseDate };
  const unit = getListedUnitPrice(next);
  const sh = next.shares ?? 0;
  if (unit !== null && sh > 0) {
    const baseEx = base.exchange;
    const cur =
      typeof baseEx === 'string' && isIntlListingExchange(baseEx)
        ? typeof base.currency === 'string' && /^[A-Z]{3}$/.test(base.currency)
          ? base.currency
          : defaultCurrencyForIntlListingExchange(baseEx)
        : 'CNY';
    return { ...next, value: sh * unit, currency: cur };
  }
  return next;
}

/**
 * 合并同 key 的场内记录为一条；非场内或无法分组的原样保留。
 */
export function mergeListedDuplicateAssets(assets: SimpleAsset[]): SimpleAsset[] {
  const unlisted: SimpleAsset[] = [];
  const buckets = new Map<string, SimpleAsset[]>();

  for (const a of assets) {
    const k = listedDuplicateKey(a);
    if (!k) {
      unlisted.push(a);
      continue;
    }
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(a);
  }

  const mergedListed: SimpleAsset[] = [];
  for (const [, group] of buckets) {
    if (group.length === 1) {
      mergedListed.push(group[0]!);
      continue;
    }
    const canon = pickCanonical(group);
    let totalShares = 0;
    for (const g of group) {
      const sh = g.shares;
      if (typeof sh === 'number' && sh > 0) totalShares += sh;
    }
    if (totalShares <= 0) {
      mergedListed.push(canon);
      continue;
    }

    let costNum = 0;
    let costDen = 0;
    for (const g of group) {
      const sh = g.shares;
      if (typeof sh !== 'number' || sh <= 0) continue;
      const ac = g.avgCost;
      if (typeof ac === 'number' && !Number.isNaN(ac) && ac > 0) {
        costNum += sh * ac;
        costDen += sh;
      }
    }
    const avgCost = costDen > 0 ? costNum / costDen : canon.avgCost;

    const donor = group.find(
      (g) =>
        g.exchange === 'SH' ||
        g.exchange === 'SZ' ||
        g.exchange === 'BJ' ||
        g.exchange === 'OTC'
    );
    const emDonor = group.find(
      (g) =>
        typeof g.emSecid === 'string' &&
        /^\d+\.\d+$/.test(g.emSecid.trim())
    );

    const tradeHistory = mergeTradeHistories(group);

    const merged: SimpleAsset = {
      ...canon,
      id: canon.id,
      name: mergeNames(group) || canon.name,
      symbol: canon.symbol?.trim() ?? group.find((g) => g.symbol)?.symbol,
      exchange: canon.exchange ?? donor?.exchange,
      emSecid: canon.emSecid ?? emDonor?.emSecid?.trim(),
      shares: totalShares,
      ...(avgCost !== undefined && { avgCost }),
      account: mergeAccounts(group),
      ...mergePurposeFields(group),
      ...(tradeHistory && tradeHistory.length > 0 ? { tradeHistory } : {}),
    };

    mergedListed.push(mergeQuoteFields(merged, group));
  }

  return [...unlisted, ...mergedListed];
}
