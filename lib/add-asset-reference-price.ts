/**
 * 添加资产页：按「交易日」回填成本参考价（东财现价/日 K 收盘、Twelve 经代理、或 legacy Stooq）。
 * 场内加减仓：从已有持仓构造 UnifiedSuggestItem，供同一套拉价逻辑使用。
 */

import { getShanghaiDateString } from '@/lib/date-shanghai';
import {
  fetchEastMoneyCloseOnOrBefore,
  type DailyCloseQuote,
} from '@/lib/eastmoney-kline';
import { fetchPush2LastPrice } from '@/lib/eastmoney-push';
import type { UnifiedSuggestItem } from '@/lib/instrument-search';
import {
  isIntlStooqFallbackEnabled,
  isTwelveIntlProviderEnabled,
} from '@/lib/intl-provider';
import { isIntlListingExchange } from '@/lib/intl-exchange-stooq';
import { fetchTwelveQuoteViaProxy } from '@/lib/market-proxy-client';
import { fetchStooqCloseOnOrBefore, fetchStooqQuote } from '@/lib/stooq-quote';
import type { SimpleAsset } from '@/types/asset';

export type ReferencePriceResult = {
  price: number;
  /** 展示用：现价 / 收盘日期 */
  hint: string;
};

/** 东财行情 secid：沪深 `1.600519`、上金 `118.AU9999`（点后允许字母数字） */
function isEastMoneyQuoteSecid(secid: string): boolean {
  const s = secid.trim();
  return s.length > 0 && /^\d+\.[A-Za-z0-9]+$/.test(s);
}

function pickTwelveKeys(pick: UnifiedSuggestItem): {
  sym: string;
  mic: string;
} | null {
  const sym = pick.twelveDataSymbol?.trim() ?? '';
  const mic = pick.twelveDataMic?.trim().toUpperCase() ?? '';
  if (!sym || !mic) return null;
  return { sym, mic };
}

/** 从已保存的场内/贵金属持仓构造拉价入参；无东财 secid / 国际键时返回 null（仅能手填单价）。 */
export function listedAssetToReferencePricePick(
  asset: SimpleAsset
): UnifiedSuggestItem | null {
  const twelveSym =
    typeof asset.twelveDataSymbol === 'string'
      ? asset.twelveDataSymbol.trim()
      : '';
  const twelveMicRaw =
    typeof asset.twelveDataMic === 'string' ? asset.twelveDataMic.trim() : '';
  const twelveMic = twelveMicRaw.toUpperCase();
  if (
    twelveSym.length > 0 &&
    twelveMic.length > 0 &&
    typeof asset.exchange === 'string' &&
    isIntlListingExchange(asset.exchange)
  ) {
    const intlRaw =
      typeof asset.intlQuoteSymbol === 'string'
        ? asset.intlQuoteSymbol.trim().toLowerCase()
        : '';
    const code =
      typeof asset.symbol === 'string' && asset.symbol.trim().length > 0
        ? asset.symbol.trim()
        : twelveSym;
    return {
      code,
      name: (asset.name || code).trim(),
      exchange: asset.exchange,
      ...(intlRaw.length > 0 ? { intlQuoteSymbol: intlRaw } : {}),
      twelveDataSymbol: twelveSym,
      twelveDataMic: twelveMic,
    };
  }

  const intlRaw =
    typeof asset.intlQuoteSymbol === 'string'
      ? asset.intlQuoteSymbol.trim().toLowerCase()
      : '';
  if (
    intlRaw.length > 0 &&
    typeof asset.exchange === 'string' &&
    isIntlListingExchange(asset.exchange)
  ) {
    const code =
      typeof asset.symbol === 'string' && asset.symbol.trim().length > 0
        ? asset.symbol.trim()
        : intlRaw;
    return {
      code,
      name: (asset.name || code).trim(),
      exchange: asset.exchange,
      intlQuoteSymbol: intlRaw,
    };
  }

  const secidRaw =
    typeof asset.emSecid === 'string' ? asset.emSecid.trim() : '';
  const secid =
    secidRaw.length > 0 && isEastMoneyQuoteSecid(secidRaw) ? secidRaw : '';
  const sym =
    typeof asset.symbol === 'string' && asset.symbol.trim().length > 0
      ? asset.symbol.trim()
      : '';
  const ex = asset.exchange;
  if (
    secid &&
    sym &&
    (ex === 'SH' ||
      ex === 'SZ' ||
      ex === 'BJ' ||
      ex === 'OTC' ||
      ex === 'SGE')
  ) {
    return {
      code: sym,
      name: (asset.name || sym).trim(),
      exchange: ex,
      quoteId: secid,
    };
  }
  return null;
}

function hintFromBarDate(barDate: string | null, td: string): string {
  if (!barDate) return '收盘';
  if (barDate < td) return `收盘 ${barDate}（最近交易日）`;
  return `收盘 ${barDate}`;
}

async function fetchIntlReferenceFromTwelve(
  pick: UnifiedSuggestItem,
  td: string,
  today: string,
  signal?: AbortSignal
): Promise<ReferencePriceResult | null> {
  const keys = pickTwelveKeys(pick);
  if (!keys || !isTwelveIntlProviderEnabled()) return null;
  const { sym, mic } = keys;

  if (td === today) {
    const last = await fetchTwelveQuoteViaProxy(sym, mic, signal);
    if (
      last.ok &&
      last.tradeDate &&
      last.tradeDate.length >= 10 &&
      last.tradeDate.slice(0, 10) <= td
    ) {
      return {
        price: last.close,
        hint: `收盘 ${last.tradeDate.slice(0, 10)}`,
      };
    }
    const hist = await fetchTwelveQuoteViaProxy(sym, mic, signal, td);
    if (hist.ok && hist.tradeDate) {
      const d = hist.tradeDate.slice(0, 10);
      return { price: hist.close, hint: hintFromBarDate(d, td) };
    }
    return null;
  }

  const hist = await fetchTwelveQuoteViaProxy(sym, mic, signal, td);
  if (hist.ok && hist.tradeDate) {
    const d = hist.tradeDate.slice(0, 10);
    return { price: hist.close, hint: hintFromBarDate(d, td) };
  }
  const last = await fetchTwelveQuoteViaProxy(sym, mic, signal);
  if (
    last.ok &&
    last.tradeDate &&
    last.tradeDate.slice(0, 10) <= td
  ) {
    return {
      price: last.close,
      hint: `收盘 ${last.tradeDate.slice(0, 10)}`,
    };
  }
  return null;
}

async function fetchIntlReferenceFromStooq(
  pick: UnifiedSuggestItem,
  td: string,
  today: string,
  signal?: AbortSignal
): Promise<ReferencePriceResult | null> {
  const sym = pick.intlQuoteSymbol?.trim();
  if (!sym) return null;

  if (td === today) {
    const last = await fetchStooqQuote(sym, signal);
    if (last && last.tradeDate <= td) {
      return { price: last.close, hint: `收盘 ${last.tradeDate}` };
    }
    const hist = await fetchStooqCloseOnOrBefore(sym, td, signal);
    if (hist) {
      return {
        price: hist.close,
        hint: hintFromBarDate(hist.tradeDate, td),
      };
    }
    return null;
  }

  const hist = await fetchStooqCloseOnOrBefore(sym, td, signal);
  if (hist) {
    return {
      price: hist.close,
      hint: hintFromBarDate(hist.tradeDate, td),
    };
  }
  const last = await fetchStooqQuote(sym, signal);
  if (last && last.tradeDate <= td) {
    return { price: last.close, hint: `收盘 ${last.tradeDate}` };
  }
  return null;
}

export async function fetchAddAssetReferencePrice(
  pick: UnifiedSuggestItem,
  tradeDate: string,
  signal?: AbortSignal
): Promise<ReferencePriceResult | null> {
  const td = tradeDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(td)) return null;
  const today = getShanghaiDateString();

  const twelveKeys = pickTwelveKeys(pick);
  if (twelveKeys && isTwelveIntlProviderEnabled()) {
    const tw = await fetchIntlReferenceFromTwelve(pick, td, today, signal);
    if (tw) return tw;
    if (isIntlStooqFallbackEnabled() && pick.intlQuoteSymbol?.trim()) {
      return fetchIntlReferenceFromStooq(pick, td, today, signal);
    }
    return null;
  }

  if (pick.intlQuoteSymbol) {
    return fetchIntlReferenceFromStooq(pick, td, today, signal);
  }

  const secid = pick.quoteId?.trim();
  if (!secid || !isEastMoneyQuoteSecid(secid)) return null;

  if (td === today) {
    const push = await fetchPush2LastPrice(secid, signal);
    if (push && push.price > 0) {
      return { price: push.price, hint: '现价' };
    }
  }

  const k: DailyCloseQuote | null = await fetchEastMoneyCloseOnOrBefore(
    secid,
    td,
    signal
  );
  if (k) {
    return {
      price: k.close,
      hint: hintFromBarDate(k.tradeDate, td),
    };
  }

  const pushFallback = await fetchPush2LastPrice(secid, signal);
  if (pushFallback && pushFallback.price > 0) {
    return {
      price: pushFallback.price,
      hint:
        td === today
          ? '现价'
          : `现价（${td} 当日收盘未取到，最新价供参考）`,
    };
  }
  return null;
}
