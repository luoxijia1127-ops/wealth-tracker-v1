/**
 * A 股风格：涨红跌绿（数值类涨跌、净值变动等）。
 * 买卖/现金流水侧栏色见各组件语义，不与「涨跌」混用时可单独指定。
 */

/** 涨 / 多 / 正变动 */
export const FINANCE_UP = '#E53935';
/** 跌 / 空 / 负变动 */
export const FINANCE_DOWN = '#2E7D32';

/** 主金额墨色（参考图大数字） */
export const BALANCE_INK = '#31313E';

export function financeDeltaColor(
  v: number,
  zeroColor: string
): string {
  if (v > 0) return FINANCE_UP;
  if (v < 0) return FINANCE_DOWN;
  return zeroColor;
}

/**
 * 涨跌色与当前应用配色一致（`AppPaletteTheme.statusPositive` / `statusNegative`），
 * 用于总览等需与主题统一的场景；A 股经典红绿请仍用 {@link financeDeltaColor}。
 */
export function themeFinanceDeltaColor(
  v: number,
  statusPositive: string,
  statusNegative: string,
  zeroColor: string
): string {
  if (v > 0) return statusPositive;
  if (v < 0) return statusNegative;
  return zeroColor;
}
