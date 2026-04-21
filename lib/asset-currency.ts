/**
 * 类现金等可选币种、默认展示货币；与 Frankfurter 拉取的 `to` 列表对齐。
 * Frankfurter `from=USD` 的 `to` 不含 USD（美元由 1 USD 基准推导）。
 */

/** 与 Frankfurter 拉取一致；勿含 USD */
/** 与 Stooq 国际场默认报价币种对齐；含 NOK/DKK 以便奥斯陆/哥本哈根持仓可经 USD 串联折算 */
export const FRANKFURTER_TO_CURRENCIES = [
  'CNY',
  'EUR',
  'HKD',
  'GBP',
  'CHF',
  'SEK',
  'JPY',
  'KRW',
  'NOK',
  'DKK',
] as const;

const FRANKFURTER_TO_PARAM = FRANKFURTER_TO_CURRENCIES.join(',');

/** 未配置 EXPO_PUBLIC_FX_URL 时的默认 latest 地址 */
export const DEFAULT_FRANKFURTER_LATEST_URL = `https://api.frankfurter.app/latest?from=USD&to=${FRANKFURTER_TO_PARAM}`;

export const ASSET_CURRENCY_OPTIONS = [
  { code: 'CNY', label: '人民币', symbol: '¥' },
  { code: 'USD', label: '美元', symbol: '$' },
  { code: 'HKD', label: '港币', symbol: 'HK$' },
  { code: 'GBP', label: '英镑', symbol: '£' },
  { code: 'EUR', label: '欧元', symbol: '€' },
  { code: 'CHF', label: '瑞士法郎', symbol: 'CHF' },
  { code: 'SEK', label: '瑞典克朗', symbol: 'kr' },
  { code: 'JPY', label: '日元', symbol: 'JP¥' },
  { code: 'KRW', label: '韩元', symbol: '₩' },
] as const;

export type AssetCurrencyCode = (typeof ASSET_CURRENCY_OPTIONS)[number]['code'];

/** 可作走势图基准、与 `effectiveChartBase` 一致（含 USD） */
export const DISPLAY_CURRENCY_FX_POOL: readonly AssetCurrencyCode[] =
  ASSET_CURRENCY_OPTIONS.map((o) => o.code);

export function assetCurrencySymbol(code: string): string {
  const o = ASSET_CURRENCY_OPTIONS.find((x) => x.code === code);
  return o?.symbol ?? '¥';
}

export function isValidAssetCurrency(code: string): code is AssetCurrencyCode {
  return ASSET_CURRENCY_OPTIONS.some((x) => x.code === code);
}

export function normalizeAssetCurrency(raw: unknown): AssetCurrencyCode {
  if (typeof raw === 'string' && isValidAssetCurrency(raw)) return raw;
  return 'CNY';
}
