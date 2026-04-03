/**
 * 东方财富日 K（原型）：拉一段历史日 K 后，按规则选出「用于估值的结算收盘价」。
 * 注意：不是简单取数组最后一根（盘中最后一根可能是未收盘当日），见 resolveSettlementDailyClose。
 */

import { ENDPOINTS } from '@/lib/config/endpoints';
import { EASTMONEY_UT } from '@/lib/eastmoney-config';
import { getShanghaiDateString } from '@/lib/date-shanghai';

const KLINE_URL = ENDPOINTS.eastmoneyKline;

/** A 股常规收盘后再等几分钟，避免日 K 未落库 */
const SHANGHAI_CLOSE_MINUTES = 15 * 60 + 5;

export type DailyCloseQuote = {
  close: number;
  tradeDate: string;
  name?: string;
};

/** 解析单根 K 线字符串：日期,开盘,收盘,... → 第三段为收盘价 */
export function parseKlineLast(kline: string): DailyCloseQuote | null {
  const parts = kline.split(',');
  if (parts.length < 3) return null;
  const tradeDate = parts[0].trim();
  const close = parseFloat(parts[2]);
  if (!tradeDate || Number.isNaN(close) || close <= 0) return null;
  return { close, tradeDate };
}

function getShanghaiDateAndMinutes(): { ymd: string; minutes: number } {
  const ymd = getShanghaiDateString();
  const timeStr = new Date().toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const [hh, mm] = timeStr.split(':').map((x) => parseInt(x, 10));
  const minutes = (Number.isNaN(hh) ? 0 : hh) * 60 + (Number.isNaN(mm) ? 0 : mm);
  return { ymd, minutes };
}

/**
 * 在已按日期升序排列的日 K 中，选出用于持仓估值的那根收盘价：
 * - 若最后一根是「今天」且未到收盘宽限时间 → 用倒数第二根（上一交易日）
 * - 否则用最后一根（含已收盘后的当日、或周末时已是上一交易日）
 */
export function resolveSettlementDailyClose(
  bars: DailyCloseQuote[]
): DailyCloseQuote | null {
  if (bars.length === 0) return null;
  const { ymd, minutes } = getShanghaiDateAndMinutes();
  const last = bars[bars.length - 1];

  const lastIsToday = last.tradeDate === ymd;
  const beforeMarketCloseCutoff = minutes < SHANGHAI_CLOSE_MINUTES;

  if (lastIsToday && beforeMarketCloseCutoff && bars.length >= 2) {
    return bars[bars.length - 2];
  }
  return last;
}

/**
 * 拉最近 20 根日 K，再按 resolveSettlementDailyClose 选结算价（非「只取 API 最后一根」的偷懒写法）。
 */
export async function fetchDailySettlementClose(
  secid: string,
  signal?: AbortSignal
): Promise<DailyCloseQuote | null> {
  const params = new URLSearchParams({
    secid,
    ut: EASTMONEY_UT,
    fields1: 'f1,f2,f3,f4,f5,f6',
    fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
    klt: '101',
    fqt: '1',
    end: '20500101',
    lmt: '20',
  });
  const url = `${KLINE_URL}?${params.toString()}`;
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    rc?: number;
    data?: { klines?: string[]; name?: string };
  };
  if (json.rc !== undefined && json.rc !== 0) return null;
  const klines = json.data?.klines;
  if (!klines?.length) return null;

  const bars: DailyCloseQuote[] = [];
  for (const k of klines) {
    const p = parseKlineLast(k);
    if (p) bars.push(p);
  }
  const picked = resolveSettlementDailyClose(bars);
  if (!picked) return null;

  if (typeof json.data?.name === 'string' && json.data.name.length > 0) {
    return { ...picked, name: json.data.name };
  }
  return picked;
}

/**
 * 拉取更长日 K，取「最后一根 tradeDate ≤ asOfYmd」的收盘价（用于按交易日回填成本）。
 */
export async function fetchEastMoneyCloseOnOrBefore(
  secid: string,
  asOfYmd: string,
  signal?: AbortSignal
): Promise<DailyCloseQuote | null> {
  const params = new URLSearchParams({
    secid,
    ut: EASTMONEY_UT,
    fields1: 'f1,f2,f3,f4,f5,f6',
    fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
    klt: '101',
    fqt: '1',
    end: '20500101',
    lmt: '500',
  });
  const url = `${KLINE_URL}?${params.toString()}`;
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    rc?: number;
    data?: { klines?: string[]; name?: string };
  };
  if (json.rc !== undefined && json.rc !== 0) return null;
  const klines = json.data?.klines;
  if (!klines?.length) return null;

  const bars: DailyCloseQuote[] = [];
  for (const k of klines) {
    const p = parseKlineLast(k);
    if (p) bars.push(p);
  }
  bars.sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
  let best: DailyCloseQuote | null = null;
  for (const b of bars) {
    if (b.tradeDate <= asOfYmd) best = b;
  }
  if (!best) return null;
  if (typeof json.data?.name === 'string' && json.data.name.length > 0) {
    return { ...best, name: json.data.name };
  }
  return best;
}
