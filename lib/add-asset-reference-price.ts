/**
 * 添加资产页：按「交易日」回填成本参考价（东财现价/日 K 收盘、Stooq 历史收盘）。
 */

import { getShanghaiDateString } from '@/lib/date-shanghai';
import {
  fetchEastMoneyCloseOnOrBefore,
  type DailyCloseQuote,
} from '@/lib/eastmoney-kline';
import { fetchPush2LastPrice } from '@/lib/eastmoney-push';
import type { UnifiedSuggestItem } from '@/lib/instrument-search';
import { fetchStooqCloseOnOrBefore, fetchStooqQuote } from '@/lib/stooq-quote';

export type ReferencePriceResult = {
  price: number;
  /** 展示用：现价 / 收盘日期 */
  hint: string;
};

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
        hint: `收盘 ${hist.tradeDate}`,
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
    return { price: k.close, hint: `收盘 ${k.tradeDate}` };
  }
  return null;
}
