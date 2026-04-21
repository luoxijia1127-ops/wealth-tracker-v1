/**
 * 添加资产页：按「交易日」回填成本参考价（东财现价/日 K 收盘、Stooq 历史收盘）。
 * 场内加减仓：从已有持仓构造 UnifiedSuggestItem，供同一套拉价逻辑使用。
 */

import { getShanghaiDateString } from '@/lib/date-shanghai';
import {
  fetchEastMoneyCloseOnOrBefore,
  type DailyCloseQuote,
} from '@/lib/eastmoney-kline';
import { fetchPush2LastPrice } from '@/lib/eastmoney-push';
import type { UnifiedSuggestItem } from '@/lib/instrument-search';
import { isIntlListingExchange } from '@/lib/intl-exchange-stooq';
import { fetchStooqCloseOnOrBefore, fetchStooqQuote } from '@/lib/stooq-quote';
import type { SimpleAsset } from '@/types/asset';

export type ReferencePriceResult = {
  price: number;
  /** 展示用：现价 / 收盘日期 */
  hint: string;
};

/** 从已保存的场内/贵金属持仓构造拉价入参；无东财 secid / Stooq 代码时返回 null（仅能手填单价）。 */
export function listedAssetToReferencePricePick(
  asset: SimpleAsset
): UnifiedSuggestItem | null {
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
    secidRaw.length > 0 && /^\d+\.\d+$/.test(secidRaw) ? secidRaw : '';
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

export async function fetchAddAssetReferencePrice(
  pick: UnifiedSuggestItem,
  tradeDate: string,
  signal?: AbortSignal
): Promise<ReferencePriceResult | null> {
  const td = tradeDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(td)) return null;
  const today = getShanghaiDateString();

  if (pick.intlQuoteSymbol) {
    const hist = await fetchStooqCloseOnOrBefore(
      pick.intlQuoteSymbol,
      td,
      signal
    );
    if (hist) {
      return {
        price: hist.close,
        hint:
          hist.tradeDate < td
            ? `收盘 ${hist.tradeDate}（最近交易日）`
            : `收盘 ${hist.tradeDate}`,
      };
    }
    const last = await fetchStooqQuote(pick.intlQuoteSymbol, signal);
    if (last && last.tradeDate <= td) {
      return { price: last.close, hint: `收盘 ${last.tradeDate}` };
    }
    return null;
  }

  const secid = pick.quoteId?.trim();
  if (!secid || !/^\d+\.\d+$/.test(secid)) return null;

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
      hint:
        k.tradeDate < td
          ? `收盘 ${k.tradeDate}（最近交易日）`
          : `收盘 ${k.tradeDate}`,
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
