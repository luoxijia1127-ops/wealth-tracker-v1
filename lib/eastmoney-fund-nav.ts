/**
 * 场外开放式基金单位净值：东财 F10 历史净值页数据源（push2 的 f43 对 150.xxx 基金常无效）。
 */

import { ENDPOINTS } from '@/lib/config/endpoints';

const LSJZ_URL = ENDPOINTS.eastmoneyFundF10;
const LSJZ_JSON_URL = ENDPOINTS.eastmoneyFundNavApi;

export type OtcFundNavQuote = {
  close: number;
  tradeDate: string;
};

type EastMoneyFundNavJson = {
  Data?: {
    LSJZList?: Array<{ FSRQ?: string; DWJZ?: string | number }>;
  };
};

async function fetchOtcFundLatestNavJson(
  code: string,
  signal?: AbortSignal
): Promise<OtcFundNavQuote | null> {
  const params = new URLSearchParams({
    fundCode: code,
    pageIndex: '1',
    pageSize: '1',
    startDate: '',
    endDate: '',
  });
  try {
    const res = await fetch(`${LSJZ_JSON_URL}?${params}`, {
      signal,
      headers: { Referer: 'https://fundf10.eastmoney.com/' },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as EastMoneyFundNavJson;
    const row = json.Data?.LSJZList?.[0];
    const tradeDate = typeof row?.FSRQ === 'string' ? row.FSRQ.slice(0, 10) : '';
    const close = parseFloat(String(row?.DWJZ ?? ''));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tradeDate)) return null;
    if (!Number.isFinite(close) || close <= 0) return null;
    return { close, tradeDate };
  } catch {
    return null;
  }
}

/**
 * 取该基金最新披露的一条单位净值（页内表格第一行）。
 */
export async function fetchOtcFundLatestNav(
  fundCode: string,
  signal?: AbortSignal
): Promise<OtcFundNavQuote | null> {
  const code = fundCode.trim().replace(/\D/g, '').padStart(6, '0');
  if (!/^\d{6}$/.test(code)) return null;

  /** 首选 JSON，避免依赖 F10 HTML 的页面结构。 */
  const jsonQuote = await fetchOtcFundLatestNavJson(code, signal);
  if (jsonQuote) return jsonQuote;

  const params = new URLSearchParams({
    type: 'lsjz',
    code,
    page: '1',
    per: '1',
  });

  try {
    const res = await fetch(`${LSJZ_URL}?${params}`, { signal });
    if (!res.ok) return null;
    const text = await res.text();
    const m = text.match(
      /<tbody>[\s\S]*?<tr>\s*<td>(\d{4}-\d{2}-\d{2})<\/td>\s*<td[^>]*>([0-9.]+)<\/td>/
    );
    if (!m) return null;
    const tradeDate = m[1];
    const close = parseFloat(m[2]);
    if (!Number.isFinite(close) || close <= 0) return null;
    return { close, tradeDate };
  } catch {
    return null;
  }
}
