/**
 * 行情刷新：A 股东财 push2 + 日 K；场外基金 F10；美股/港股 Stooq；黄金参考价。
 */

import { isInternationalListedAsset } from '@/lib/asset-value';
import { getShanghaiDateString } from '@/lib/date-shanghai';
import { fetchDailySettlementClose } from '@/lib/eastmoney-kline';
import { fetchOtcFundLatestNav } from '@/lib/eastmoney-fund-nav';
import { fetchPush2LastPrice } from '@/lib/eastmoney-push';
import { toEastMoneySecid } from '@/lib/eastmoney-secid';
import { fetchGoldReferenceCnyPerGram } from '@/lib/gold-quote';
import { fetchStooqQuote } from '@/lib/stooq-quote';
import { getAssets, saveAssets } from '@/lib/asset-storage';
import {
  getListedUnitPrice,
  isListedAssetCategory,
  type ChinaExchange,
  type SimpleAsset,
} from '@/types/asset';

function listedEastMoneySecid(a: SimpleAsset): string {
  const raw = typeof a.emSecid === 'string' ? a.emSecid.trim() : '';
  if (raw.length > 0 && /^\d+\.\d+$/.test(raw)) return raw;
  return toEastMoneySecid(a.exchange as ChinaExchange, a.symbol!.trim());
}

function isEmQuoteEligibleListedAsset(a: SimpleAsset): boolean {
  if (!isListedAssetCategory(a.category)) return false;
  if (typeof a.intlQuoteSymbol === 'string' && a.intlQuoteSymbol.trim().length > 0) {
    return false;
  }
  if (typeof a.shares !== 'number' || a.shares <= 0) return false;
  const em = typeof a.emSecid === 'string' ? a.emSecid.trim() : '';
  if (em.length > 0 && /^\d+\.\d+$/.test(em)) return true;
  return (
    typeof a.symbol === 'string' &&
    /^\d{6}$/.test(a.symbol.trim()) &&
    (a.exchange === 'SH' ||
      a.exchange === 'SZ' ||
      a.exchange === 'BJ' ||
      a.exchange === 'OTC')
  );
}

function isIntlQuoteEligibleListedAsset(a: SimpleAsset): boolean {
  return (
    isInternationalListedAsset(a) &&
    typeof a.intlQuoteSymbol === 'string' &&
    a.intlQuoteSymbol.trim().length > 0
  );
}

function listingCurrencyForMerge(a: SimpleAsset): string {
  if (a.exchange === 'US' || a.exchange === 'HK') {
    const c = a.currency;
    if (typeof c === 'string' && /^[A-Z]{3}$/.test(c)) return c;
    return a.exchange === 'HK' ? 'HKD' : 'USD';
  }
  return 'CNY';
}

/**
 * 合并 push2 / 日 K 结果：先写入 markPrice、lastClose 字段；
 * 再用 getListedUnitPrice（现价优先）算市值；若无单价则只更新字段、不动 value。
 */
function mergeListedQuotes(
  a: SimpleAsset,
  push: Awaited<ReturnType<typeof fetchPush2LastPrice>>,
  kline: Awaited<ReturnType<typeof fetchDailySettlementClose>>
): SimpleAsset {
  let markPrice = a.markPrice;
  let markPriceDate = a.markPriceDate;
  if (push && push.price > 0) {
    markPrice = push.price;
    markPriceDate = getShanghaiDateString();
  }
  let lastClose = a.lastClose;
  let lastCloseDate = a.lastCloseDate;
  if (kline) {
    lastClose = kline.close;
    lastCloseDate = kline.tradeDate;
  }
  const next: SimpleAsset = {
    ...a,
    markPrice,
    markPriceDate,
    lastClose,
    lastCloseDate,
  };
  const unit = getListedUnitPrice(next);
  if (unit !== null && typeof a.shares === 'number') {
    return {
      ...next,
      value: a.shares * unit,
      currency: listingCurrencyForMerge(a),
    };
  }
  return next;
}

/** Stooq 仅日级收盘，现价与昨收同用 close */
function mergeStooqQuote(
  a: SimpleAsset,
  row: NonNullable<Awaited<ReturnType<typeof fetchStooqQuote>>>
): SimpleAsset {
  const next: SimpleAsset = {
    ...a,
    markPrice: row.close,
    markPriceDate: getShanghaiDateString(),
    lastClose: row.close,
    lastCloseDate: row.tradeDate,
  };
  const unit = getListedUnitPrice(next);
  if (unit !== null && typeof a.shares === 'number') {
    return {
      ...next,
      value: a.shares * unit,
      currency: listingCurrencyForMerge(a),
    };
  }
  return next;
}

/** 浅比较：整表 JSON 一致则认为无需写盘（顺序与 getAssets 一致） */
function assetsJsonEqual(a: SimpleAsset[], b: SimpleAsset[]): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

async function withTimeout<T>(
  ms: number,
  run: (signal: AbortSignal) => Promise<T>
): Promise<T | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    return await run(ac.signal);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function refreshListedQuotes(): Promise<SimpleAsset[]> {
  const assets = await getAssets();
  const emListed = assets.filter(isEmQuoteEligibleListedAsset);
  const intlListed = assets.filter(isIntlQuoteEligibleListedAsset);
  const hasGoldHeld = assets.some(
    (a) =>
      a.category === 'Gold' &&
      typeof a.shares === 'number' &&
      a.shares > 0
  );
  if (emListed.length === 0 && intlListed.length === 0 && !hasGoldHeld) {
    return assets;
  }

  const uniqueSecids = [...new Set(emListed.map(listedEastMoneySecid))];

  const secidPack = new Map<
    string,
    {
      push: Awaited<ReturnType<typeof fetchPush2LastPrice>>;
      kline: Awaited<ReturnType<typeof fetchDailySettlementClose>>;
    }
  >();

  await Promise.all(
    uniqueSecids.map(async (secid) => {
      const sample = emListed.find((a) => listedEastMoneySecid(a) === secid);
      try {
        if (sample?.exchange === 'OTC' && sample.symbol) {
          const nav = await withTimeout(8000, (signal) =>
            fetchOtcFundLatestNav(sample.symbol!.trim(), signal)
          );
          if (nav) {
            secidPack.set(secid, {
              push: { price: nav.close },
              kline: {
                close: nav.close,
                tradeDate: nav.tradeDate,
              },
            });
          } else {
            secidPack.set(secid, { push: null, kline: null });
          }
          return;
        }
        const [push, kline] = await Promise.all([
          withTimeout(8000, (signal) => fetchPush2LastPrice(secid, signal)),
          withTimeout(8000, (signal) =>
            fetchDailySettlementClose(secid, signal)
          ),
        ]);
        secidPack.set(secid, { push: push ?? null, kline: kline ?? null });
      } catch {
        secidPack.set(secid, { push: null, kline: null });
      }
    })
  );

  const uniqueStooq = [
    ...new Set(
      intlListed.map((a) => a.intlQuoteSymbol!.trim().toLowerCase())
    ),
  ];
  const stooqPack = new Map<string, Awaited<ReturnType<typeof fetchStooqQuote>>>();
  await Promise.all(
    uniqueStooq.map(async (sym) => {
      const row = await withTimeout(8000, (signal) =>
        fetchStooqQuote(sym, signal)
      );
      stooqPack.set(sym, row);
    })
  );

  let next = assets.map((a) => {
    if (isEmQuoteEligibleListedAsset(a)) {
      const secid = listedEastMoneySecid(a);
      const pack = secidPack.get(secid);
      if (!pack) return a;
      return mergeListedQuotes(a, pack.push, pack.kline);
    }
    if (isIntlQuoteEligibleListedAsset(a)) {
      const sym = a.intlQuoteSymbol!.trim().toLowerCase();
      const row = stooqPack.get(sym);
      if (!row) return a;
      return mergeStooqQuote(a, row);
    }
    return a;
  });

  const spot = await withTimeout(8000, (signal) =>
    fetchGoldReferenceCnyPerGram(signal)
  );
  if (spot != null && spot.price > 0) {
    const today = getShanghaiDateString();
    next = next.map((a) => {
      if (a.category !== 'Gold') return a;
      if (typeof a.shares !== 'number' || !(a.shares > 0)) return a;
      const merged: SimpleAsset = {
        ...a,
        markPrice: spot.price,
        markPriceDate: today,
      };
      const unit = getListedUnitPrice(merged);
      if (unit !== null) {
        return {
          ...merged,
          value: merged.shares! * unit,
          currency: 'CNY',
        };
      }
      return merged;
    });
  }

  if (!assetsJsonEqual(assets, next)) {
    await saveAssets(next);
  }
  return next;
}
