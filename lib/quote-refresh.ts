/**
 * 行情刷新：A 股东财 push2 + 日 K；场外基金 F10；国际上市 Twelve（经代理）或 legacy Stooq；贵金属参考价（按品种）。
 */

import { isInternationalListedAsset } from '@/lib/asset-value';
import {
  defaultCurrencyForIntlListingExchange,
  isIntlListingExchange,
} from '@/lib/intl-exchange-stooq';
import { ensureFxUsdRatesForToday } from '@/lib/fx-rates';
import { getShanghaiDateString } from '@/lib/date-shanghai';
import { fetchDailySettlementClose } from '@/lib/eastmoney-kline';
import { fetchOtcFundLatestNav } from '@/lib/eastmoney-fund-nav';
import { fetchPush2LastPrice } from '@/lib/eastmoney-push';
import { toEastMoneySecid } from '@/lib/eastmoney-secid';
import { fetchPreciousMetalCnyPerGram } from '@/lib/precious-metal-quote';
import {
  isIntlStooqFallbackEnabled,
  isTwelveIntlProviderEnabled,
} from '@/lib/intl-provider';
import {
  fetchTwelveQuoteViaProxy,
  type TwelveQuoteOk,
} from '@/lib/market-proxy-client';
import { fetchStooqQuote } from '@/lib/stooq-quote';
import { getAssets, saveAssets } from '@/lib/asset-storage';
import {
  getListedUnitPrice,
  isListedAssetCategory,
  type ChinaExchange,
  type PreciousMetalSpot,
  type SimpleAsset,
} from '@/types/asset';

function listedEastMoneySecid(a: SimpleAsset): string {
  const raw = typeof a.emSecid === 'string' ? a.emSecid.trim() : '';
  if (raw.length > 0 && /^\d+\.\d+$/.test(raw)) return raw;
  return toEastMoneySecid(a.exchange as ChinaExchange, a.symbol!.trim());
}

function assetHasTwelveKeys(a: SimpleAsset): boolean {
  return (
    typeof a.twelveDataSymbol === 'string' &&
    a.twelveDataSymbol.trim().length > 0 &&
    typeof a.twelveDataMic === 'string' &&
    a.twelveDataMic.trim().length > 0
  );
}

type TwelveKey = { symbol: string; mic: string; inferredFromLegacy: boolean };

/**
 * 旧版本保存的美股只有 `aapl.us` 这一 Stooq 键，因此不会命中后来加入的
 * Twelve 代理。对无歧义的普通美股 ticker 自动补为 Twelve 键；成功刷新后
 * 会写回资产，用户无需删除持仓或重录交易。
 */
function twelveKeyForAsset(a: SimpleAsset): TwelveKey | null {
  if (assetHasTwelveKeys(a)) {
    return {
      symbol: a.twelveDataSymbol!.trim(),
      mic: a.twelveDataMic!.trim().toUpperCase(),
      inferredFromLegacy: false,
    };
  }
  if (a.exchange !== 'US') return null;
  const legacy = a.intlQuoteSymbol?.trim();
  if (!legacy || !/^([a-z0-9]+)\.us$/i.test(legacy)) return null;
  const symbol = legacy.slice(0, -3).toUpperCase();
  return { symbol, mic: 'XNAS', inferredFromLegacy: true };
}

function isEmQuoteEligibleListedAsset(a: SimpleAsset): boolean {
  if (!isListedAssetCategory(a.category)) return false;
  if (typeof a.intlQuoteSymbol === 'string' && a.intlQuoteSymbol.trim().length > 0) {
    return false;
  }
  if (assetHasTwelveKeys(a)) return false;
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
  if (!isInternationalListedAsset(a)) return false;
  if (isTwelveIntlProviderEnabled() && assetHasTwelveKeys(a)) return true;
  return (
    typeof a.intlQuoteSymbol === 'string' && a.intlQuoteSymbol.trim().length > 0
  );
}

function listingCurrencyForMerge(a: SimpleAsset): string {
  const ex = a.exchange;
  if (typeof ex === 'string' && isIntlListingExchange(ex)) {
    const c = a.currency;
    if (typeof c === 'string' && /^[A-Z]{3}$/.test(c)) return c;
    return defaultCurrencyForIntlListingExchange(ex);
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
  let lastClose = a.lastClose;
  let lastCloseDate = a.lastCloseDate;
  if (kline) {
    lastClose = kline.close;
    lastCloseDate = kline.tradeDate;
  }
  if (push && push.price > 0) {
    markPrice = push.price;
    markPriceDate = getShanghaiDateString();
  } else if (kline && kline.close > 0) {
    /**
     * getListedUnitPrice 优先 markPrice；push 失败时（休市、超时、部分标的无 f43）
     * 若仍只更新 lastClose、不动 markPrice，会长期显示陈旧现价，下拉刷新也像「没更新」。
     * 用日 K 结算价同时作为有效市价来源。
     */
    markPrice = kline.close;
    markPriceDate = kline.tradeDate;
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

function mergeTwelveQuote(a: SimpleAsset, row: TwelveQuoteOk): SimpleAsset {
  const d =
    typeof row.tradeDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(row.tradeDate)
      ? row.tradeDate.slice(0, 10)
      : getShanghaiDateString();
  const next: SimpleAsset = {
    ...a,
    markPrice: row.close,
    markPriceDate: d,
    lastClose: row.close,
    lastCloseDate: d,
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
    /** 与 lastClose 同一交易日，避免「同步日」与 Stooq  bar 日期不一致 */
    markPriceDate: row.tradeDate,
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
          /**
           * 场外基金：官方单位净值与盘中估值同时读取。
           * - lastClose / lastCloseDate：基金公司已披露的单位净值
           * - markPrice / markPriceDate：东财当日估值，仅在实际返回有效价格时使用
           */
          const [nav, estimate] = await Promise.all([
            withTimeout(8000, (signal) =>
              fetchOtcFundLatestNav(sample.symbol!.trim(), signal)
            ),
            withTimeout(8000, (signal) => fetchPush2LastPrice(secid, signal)),
          ]);
          secidPack.set(secid, {
            push: estimate ?? null,
            kline: nav
              ? { close: nav.close, tradeDate: nav.tradeDate }
              : null,
          });
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

  const twelveEnabled = isTwelveIntlProviderEnabled();
  const twelveKeysList = intlListed
    .flatMap((a) => {
      if (!twelveEnabled) return [];
      const key = twelveKeyForAsset(a);
      return key ? [`${key.symbol}|${key.mic}`] : [];
    });
  const uniqueTwelve = [...new Set(twelveKeysList)];

  const twelvePack = new Map<string, TwelveQuoteOk | null>();
  await Promise.all(
    uniqueTwelve.map(async (k) => {
      const [sym, mic] = k.split('|');
      if (!sym || !mic) return;
      const row = await withTimeout(8000, (signal) => {
        return fetchTwelveQuoteViaProxy(sym, mic, signal).then((r) =>
          r.ok ? r : null
        );
      });
      twelvePack.set(k, row);
    })
  );

  const needStooqSymbols = intlListed.flatMap((a) => {
    const twelveKey = twelveKeyForAsset(a);
    if (!twelveEnabled || !twelveKey) {
      const s = a.intlQuoteSymbol?.trim().toLowerCase();
      return s ? [s] : [];
    }
    const k = `${twelveKey.symbol}|${twelveKey.mic}`;
    if (!isIntlStooqFallbackEnabled()) return [];
    if (twelvePack.get(k)) return [];
    const s = a.intlQuoteSymbol?.trim().toLowerCase();
    return s ? [s] : [];
  });

  const uniqueStooq = [...new Set(needStooqSymbols)];
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
      const twelveKey = twelveKeyForAsset(a);
      if (twelveEnabled && twelveKey) {
        const k = `${twelveKey.symbol}|${twelveKey.mic}`;
        const trow = twelvePack.get(k);
        if (trow) {
          const resolved = twelveKey.inferredFromLegacy
            ? {
                ...a,
                twelveDataSymbol: twelveKey.symbol,
                twelveDataMic: twelveKey.mic,
              }
            : a;
          return mergeTwelveQuote(resolved, trow);
        }
        if (
          isIntlStooqFallbackEnabled() &&
          typeof a.intlQuoteSymbol === 'string' &&
          a.intlQuoteSymbol.trim().length > 0
        ) {
          const sym = a.intlQuoteSymbol.trim().toLowerCase();
          const row = stooqPack.get(sym);
          if (row) return mergeStooqQuote(a, row);
        }
        return a;
      }
      const sym = a.intlQuoteSymbol!.trim().toLowerCase();
      const row = stooqPack.get(sym);
      if (!row) return a;
      return mergeStooqQuote(a, row);
    }
    return a;
  });

  const goldHeld = next.filter(
    (a) =>
      a.category === 'Gold' &&
      typeof a.shares === 'number' &&
      a.shares > 0
  );

  const secidKeys = [
    ...new Set(
      goldHeld
        .map((a) =>
          typeof a.emSecid === 'string' ? a.emSecid.trim() : ''
        )
        .filter((s) => /^\d+\.\d+$/.test(s))
    ),
  ];
  const priceBySecid = new Map<string, number>();
  await Promise.all(
    secidKeys.map(async (secid) => {
      const push = await withTimeout(8000, (signal) =>
        fetchPush2LastPrice(secid, signal)
      );
      if (push && push.price > 0) priceBySecid.set(secid, push.price);
    })
  );

  const metalsNeedingRef = new Set<PreciousMetalSpot>();
  for (const a of goldHeld) {
    const sid =
      typeof a.emSecid === 'string' ? a.emSecid.trim() : '';
    if (sid && priceBySecid.has(sid)) continue;
    metalsNeedingRef.add((a.preciousMetalSpot ?? 'XAU') as PreciousMetalSpot);
  }

  const needsUsdCny = [...metalsNeedingRef].some((m) => m !== 'XAU');
  let cnyPerUsd: number | null = null;
  if (needsUsdCny) {
    const fx = await ensureFxUsdRatesForToday();
    cnyPerUsd = fx.rates?.rates.CNY ?? null;
  }

  const priceByMetal = new Map<PreciousMetalSpot, number>();
  await Promise.all(
    [...metalsNeedingRef].map(async (m) => {
      const r = await withTimeout(8000, (signal) =>
        fetchPreciousMetalCnyPerGram(m, cnyPerUsd, signal)
      );
      if (r && r.price > 0) priceByMetal.set(m, r.price);
    })
  );

  const hasGoldPrices = priceBySecid.size > 0 || priceByMetal.size > 0;
  if (hasGoldPrices) {
    const today = getShanghaiDateString();
    next = next.map((a) => {
      if (a.category !== 'Gold') return a;
      if (typeof a.shares !== 'number' || !(a.shares > 0)) return a;
      const sid =
        typeof a.emSecid === 'string' ? a.emSecid.trim() : '';
      const m = (a.preciousMetalSpot ?? 'XAU') as PreciousMetalSpot;
      let p: number | undefined;
      if (sid && priceBySecid.has(sid)) p = priceBySecid.get(sid);
      else p = priceByMetal.get(m);
      if (p === undefined) return a;
      const merged: SimpleAsset = {
        ...a,
        markPrice: p,
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
