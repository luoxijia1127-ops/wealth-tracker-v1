/**
 * 非场内资产可选币种（场内行情均为人民币计价）。
 */

export const ASSET_CURRENCY_OPTIONS = [
  { code: 'CNY', label: '人民币', symbol: '¥' },
  { code: 'USD', label: '美元', symbol: '$' },
  { code: 'EUR', label: '欧元', symbol: '€' },
  { code: 'HKD', label: '港币', symbol: 'HK$' },
] as const;

export type AssetCurrencyCode = (typeof ASSET_CURRENCY_OPTIONS)[number]['code'];

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
