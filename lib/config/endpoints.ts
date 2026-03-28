/**
 * 外部 HTTP 端点集中配置。可通过 EXPO_PUBLIC_* 环境变量覆盖默认地址（构建时注入）。
 */

function envUrl(envKey: string, fallback: string): string {
  try {
    const v = process.env[envKey];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  } catch {
    /* Metro / 非 Node 环境 */
  }
  return fallback;
}

export const ENDPOINTS = {
  frankfurterFx: envUrl(
    'EXPO_PUBLIC_FX_URL',
    'https://api.frankfurter.app/latest?from=USD&to=CNY,EUR,HKD'
  ),
  eastmoneyPush: envUrl(
    'EXPO_PUBLIC_EASTMONEY_PUSH_URL',
    'https://push2.eastmoney.com/api/qt/stock/get'
  ),
  eastmoneyKline: envUrl(
    'EXPO_PUBLIC_EASTMONEY_KLINE_URL',
    'https://push2his.eastmoney.com/api/qt/stock/kline/get'
  ),
  eastmoneySuggest: envUrl(
    'EXPO_PUBLIC_EASTMONEY_SUGGEST_URL',
    'https://searchadapter.eastmoney.com/api/suggest/get'
  ),
  eastmoneyFundF10: envUrl(
    'EXPO_PUBLIC_EASTMONEY_FUND_F10_URL',
    'https://fundf10.eastmoney.com/F10DataApi.aspx'
  ),
  openfigiSearch: envUrl(
    'EXPO_PUBLIC_OPENFIGI_SEARCH_URL',
    'https://api.openfigi.com/v3/search'
  ),
  /** 招行公开金价页（HTML），可被 EXPO_PUBLIC_GOLD_QUOTE_URL JSON 覆盖逻辑见 gold-quote */
  cmbGoldRateHtml: envUrl(
    'EXPO_PUBLIC_CMB_GOLD_RATE_URL',
    'https://cmb-mobile-web.paas.cmbchina.com/goldrate.html'
  ),
} as const;

/** Stooq CSV 行情；默认与历史实现一致 */
export function buildStooqCsvUrl(symbol: string): string {
  return `https://stooq.com/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcv&h&e=csv`;
}
