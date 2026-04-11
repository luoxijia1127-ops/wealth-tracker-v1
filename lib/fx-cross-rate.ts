/**
 * Frankfurter 存库为「1 USD = X 各币种」；按用户默认货币作基准换算为「1 基准 = Y 目标」。
 */

import type { FxUsdMidRates } from '@/lib/fx-rates';

/**
 * 人民币 → 美元 → 欧元 → 港币。走势与缓存列表均按此顺序，并跳过当前基准币种。
 */
export const FX_CHART_ORDER = ['CNY', 'USD', 'EUR', 'HKD'] as const;

export const FX_CHART_POOL = FX_CHART_ORDER;

export const FX_CODE_LABEL_ZH: Record<string, string> = {
  USD: '美元',
  CNY: '人民币',
  EUR: '欧元',
  HKD: '港币',
  JPY: '日元',
};

/**
 * 走势图基准：默认货币在 CNY/EUR/HKD/USD 内则用；否则本地历史仅有四币种串联，退回 CNY。
 */
export function effectiveChartBase(displayCurrency: string): string {
  const dc = /^[A-Z]{3}$/.test(displayCurrency.trim())
    ? displayCurrency.trim().toUpperCase()
    : 'CNY';
  if (dc === 'USD') return 'USD';
  if ((FX_CHART_POOL as readonly string[]).includes(dc)) return dc;
  return 'CNY';
}

/** 与基准不同的三条走势线：按 {@link FX_CHART_ORDER} 排序并去掉基准 */
export function pickThreeChartTargets(base: string): string[] {
  const b = /^[A-Z]{3}$/.test(base) ? base : 'CNY';
  return FX_CHART_ORDER.filter((c) => c !== b).slice(0, 3);
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
  /** 目标为美元：存库为「1 USD = rb 基准币」，故 1 基准币 = 1/rb USD（接口常不含 USD 键） */
  if (t === 'USD') {
    const rb = rates[b as keyof typeof rates];
    return typeof rb === 'number' && rb > 0 && Number.isFinite(rb)
      ? 1 / rb
      : null;
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

/**
 * 多少单位基准货币 = 1 单位目标货币（`unitsOfTargetPerBase` 的倒数）。
 * 基准为 CNY 时即「多少人民币 = 1 欧元/港币/美元」等。
 */
export function basePerOneTarget(
  rates: FxUsdMidRates['rates'],
  base: string,
  target: string
): number | null {
  const u = unitsOfTargetPerBase(rates, base, target);
  if (u === null || !(u > 0) || !Number.isFinite(u)) return null;
  return 1 / u;
}
