/**
 * 数字单行展示：日元/韩元等位数多时优先用「千」为单位 k 缩写；
 * React Native 的 Text 上配合 {@link numberSingleLineTextProps} 防止换行。
 */

const JP_KR = new Set(['JPY', 'KRW']);

function trimTrailingZeros(s: string): string {
  if (!s.includes('.')) return s;
  return s.replace(/\.?0+$/, '');
}

/** 供 RN <Text>：禁止换行并在必要时缩小字号 */
export const numberSingleLineTextProps = {
  numberOfLines: 1 as const,
  adjustsFontSizeToFit: true,
  minimumFontScale: 0.38,
  ellipsizeMode: 'clip' as const,
};

/**
 * 汇率轴、中间价表等：对 JPY/KRW 且绝对值 ≥1000 用 `1.23k`；否则按数量级保留小数。
 * `versusCurrencyCode` 为标价币种（如走势里「1 日元=多少基准」时的 JPY）。
 */
export function formatRateOrSmallNumberOneLine(
  n: number,
  versusCurrencyCode?: string | null
): string {
  if (!Number.isFinite(n)) return '—';
  const c = (versusCurrencyCode ?? '').toUpperCase();
  const a = Math.abs(n);
  if (JP_KR.has(c) && a >= 1000) {
    const sign = n < 0 ? '−' : '';
    const k = a / 1000;
    const d = k >= 100 ? 0 : k >= 10 ? 1 : 2;
    return `${sign}${trimTrailingZeros(k.toFixed(d))}k`;
  }
  if (a >= 100) return n.toFixed(2);
  if (a >= 10) return n.toFixed(3);
  return n.toFixed(4);
}

/**
 * 大额日元/韩元金额用 `JP¥1.23k` / `₩1.23k`；不满足时返回 null，由调用方走 Intl。
 */
export function formatMoneyCompactKString(
  value: number,
  currencyCode: string
): string | null {
  if (!Number.isFinite(value)) return null;
  const c = currencyCode.toUpperCase();
  if (!JP_KR.has(c) || Math.abs(value) < 1000) return null;
  const sign = value < 0 ? '−' : '';
  const v = Math.abs(value) / 1000;
  const d = v >= 100 ? 0 : v >= 10 ? 1 : 2;
  const body = trimTrailingZeros(v.toFixed(d));
  const sym = c === 'JPY' ? 'JP¥' : '₩';
  return `${sign}${sym}${body}k`;
}
