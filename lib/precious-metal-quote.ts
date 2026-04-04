/**
 * 贵金属 CNY/克 参考价：
 * - XAU：gold-quote（EXPO JSON → 东财上金 AU9999 → 招行页）
 * - XAG / XPT / XPD：优先东财上海金现货（与 XAU 同源）；失败则 Stooq 美元/金衡盎司 × USD→CNY ÷ 31.1035
 */

import { fetchGoldReferenceCnyPerGram } from '@/lib/gold-quote';
import { fetchSgeCnyPerGramFromEastmoney } from '@/lib/sge-eastmoney-quote';
import { fetchStooqForexSpotLatest } from '@/lib/stooq-quote';
import type { PreciousMetalSpot } from '@/types/asset';

/** 金衡盎司 → 克（国际惯例） */
export const TROY_OZ_TO_GRAMS = 31.1034768;

const STOOQ_USD_PER_OZ: Record<Exclude<PreciousMetalSpot, 'XAU'>, string> = {
  XAG: 'xagusd',
  XPT: 'xptusd',
  XPD: 'xpdusd',
};

/**
 * @param cnyPerUsd Frankfurter 1 USD = cnyPerUsd CNY；非 XAU 时必填
 */
export async function fetchPreciousMetalCnyPerGram(
  metal: PreciousMetalSpot | undefined,
  cnyPerUsd: number | null,
  signal?: AbortSignal
): Promise<{ price: number; source?: string } | null> {
  const m: PreciousMetalSpot = metal ?? 'XAU';
  if (m === 'XAU') {
    return fetchGoldReferenceCnyPerGram(signal);
  }
  const sge = await fetchSgeCnyPerGramFromEastmoney(m, signal);
  if (sge) return sge;
  if (!(typeof cnyPerUsd === 'number' && cnyPerUsd > 0)) return null;
  const sym = STOOQ_USD_PER_OZ[m];
  if (!sym) return null;
  const row = await fetchStooqForexSpotLatest(sym, signal);
  if (!row || !(row.close > 0)) return null;
  const cnyPerOz = row.close * cnyPerUsd;
  const cnyPerGram = cnyPerOz / TROY_OZ_TO_GRAMS;
  if (!(cnyPerGram > 0) || cnyPerGram > 1e6) return null;
  return { price: cnyPerGram, source: `stooq:${sym}` };
}
