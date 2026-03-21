/**
 * 场外开放式基金单位净值：东财 F10 历史净值页数据源（push2 的 f43 对 150.xxx 基金常无效）。
 */

const LSJZ_URL = 'https://fundf10.eastmoney.com/F10DataApi.aspx';

export type OtcFundNavQuote = {
  close: number;
  tradeDate: string;
};

/**
 * 取该基金最新披露的一条单位净值（页内表格第一行）。
 */
export async function fetchOtcFundLatestNav(
  fundCode: string,
  signal?: AbortSignal
): Promise<OtcFundNavQuote | null> {
  const code = fundCode.trim().replace(/\D/g, '').padStart(6, '0');
  if (!/^\d{6}$/.test(code)) return null;

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
