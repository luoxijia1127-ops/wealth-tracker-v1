/**
 * Frankfurter 存库为「1 USD = X 各币种」；按用户默认货币作基准换算为「1 基准 = Y 目标」。
 */

import type { FxUsdMidRates } from '@/lib/fx-rates';

export const FX_CHART_POOL = ['CNY', 'EUR', 'HKD', 'JPY'] as const;

export const FX_CODE_LABEL_ZH: Record<string, string> = {
  USD: '美元',
  CNY: '人民币',
  EUR: '欧元',
  HKD: '港币',
  JPY: '日元',
};

/**
 * 走势图基准：默认货币在 CNY/EUR/HKD/JPY/USD 内则用；否则本地历史仅有四币种串联，退回 CNY。
 */
export function effectiveChartBase(displayCurrency: string): string {
  const dc = /^[A-Z]{3}$/.test(displayCurrency.trim())
    ? displayCurrency.trim().toUpperCase()
    : 'CNY';
  if (dc === 'USD') return 'USD';
  if ((FX_CHART_POOL as readonly string[]).includes(dc)) return dc;
  return 'CNY';
}

/**
 * 与基准不同的三条走势线：USD 时为 EUR/HKD/JPY；否则为池中除基准外的三种。
 */
export function pickThreeChartTargets(base: string): string[] {
  const b = /^[A-Z]{3}$/.test(base) ? base : 'CNY';
  if (b === 'USD') return ['EUR', 'HKD', 'JPY'];
  return FX_CHART_POOL.filter((c) => c !== b).slice(0, 3);
}

/**
 * 1 单位基准货币可兑换多少单位目标货币（Frankfurter USD 串联）。
 * 基准为 USD 时，直接用 API 给出的「1 USD = X 目标」。
 */
export function unitsOfTargetPerBase(
  rates: FxUsdMidRates['rates'],
  base: string,
  target: string
): number | null {
  const b = /^[A-Z]{3}$/.test(base) ? base : 'CNY';
  const t = /^[A-Z]{3}$/.test(target) ? target : '';
  if (!t || b === t) return 1;
  if (b === 'USD') {
    const v = rates[t as keyof typeof rates];
    return typeof v === 'number' && v > 0 && Number.isFinite(v) ? v : null;
  }
  const rb = rates[b as keyof typeof rates];
  const rt = rates[t as keyof typeof rates];
  if (
    typeof rb !== 'number' ||
    !(rb > 0) ||
    typeof rt !== 'number' ||
    !(rt > 0)
  ) {
    return null;
  }
  return rt / rb;
}
