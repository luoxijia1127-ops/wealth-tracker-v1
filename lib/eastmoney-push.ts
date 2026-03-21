/**
 * 东方财富 push2：f43 为最新成交价/现价，写入资产的 markPrice（与 lastClose 分离）。
 */

import { EASTMONEY_UT } from '@/lib/eastmoney-config';

const PUSH_URL = 'https://push2.eastmoney.com/api/qt/stock/get';

export type Push2Quote = {
  price: number;
  name?: string;
};

export async function fetchPush2LastPrice(
  secid: string,
  signal?: AbortSignal
): Promise<Push2Quote | null> {
  const params = new URLSearchParams({
    invt: '2',
    fltt: '2',
    ut: EASTMONEY_UT,
    secid,
    fields: 'f43,f58',
  });
  try {
    const res = await fetch(`${PUSH_URL}?${params}`, { signal });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      rc?: number;
      data?: { f43?: number | string; f58?: string };
    };
    if (json.rc !== undefined && json.rc !== 0) return null;
    const data = json.data;
    if (!data || data.f43 === undefined || data.f43 === null) return null;
    const raw =
      typeof data.f43 === 'number' ? data.f43 : parseFloat(String(data.f43));
    if (!Number.isFinite(raw) || raw <= 0) return null;
    const name = typeof data.f58 === 'string' ? data.f58 : undefined;
    return { price: raw, name };
  } catch {
    return null;
  }
}
