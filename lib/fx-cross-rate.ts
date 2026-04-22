/**
 * Frankfurter 存库为「1 USD = X 各币种」；按用户默认货币作基准换算为「1 基准 = Y 目标」。
 */

import { DISPLAY_CURRENCY_FX_POOL } from '@/lib/asset-currency';
import type { FxUsdMidRates } from '@/lib/fx-rates';

/**
 * 汇率走势「主五币」：人民币、美元、欧元、港币、英镑；逻辑对称。
 * - 默认展示货币 ∈ 这五者之一 → 对其余 **4** 个画走势；
 * - 默认展示货币 ∉ 这五者（如 CHF / JPY / SEK / KRW）→ 对这 **5** 个主币各画一条相对默认币的走势。
 */
export const FX_TREND_MAJOR_FIVE = [
  'CNY',
  'USD',
  'EUR',
  'HKD',
  'GBP',
] as const;

/** 与 {@link FX_TREND_MAJOR_FIVE} 一致（旧名保留） */
export const FX_CHART_ORDER = FX_TREND_MAJOR_FIVE;

export const FX_CHART_POOL = DISPLAY_CURRENCY_FX_POOL;

export const FX_CODE_LABEL_ZH: Record<string, string> = {
  USD: '美元',
  CNY: '人民币',
  EUR: '欧元',
  HKD: '港币',
  GBP: '英镑',
  CHF: '瑞士法郎',
  SEK: '瑞典克朗',
  JPY: '日元',
  KRW: '韩元',
};

/**
 * 走势图纵轴基准 = 当前默认展示货币（须在 App 支持的展示币种内）；非法值退回 CNY。
 * 主五币走势目标币种列表由 {@link pickFxMonthlyChartTargets} 决定（4 或 5 个）；各币种图表单独筛有效交易日。
 */
export function effectiveChartBase(displayCurrency: string): string {
  const raw = displayCurrency.trim().toUpperCase();
  const dc = /^[A-Z]{3}$/.test(raw) ? raw : 'CNY';
  return (FX_CHART_POOL as readonly string[]).includes(dc) ? dc : 'CNY';
}

/** 与基准不同的前三条主序（兼容旧逻辑） */
export function pickThreeChartTargets(base: string): string[] {
  const b = /^[A-Z]{3}$/.test(base) ? base : 'CNY';
  return FX_TREND_MAJOR_FIVE.filter((c) => c !== b).slice(0, 3);
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

/**
 * 近一月走势涉及的主五币目标代码（不含基准本身）。
 * 默认展示币 ∈ 主五币 → 其余 4 个；否则 → 主五币全部 5 个。
 * 各币种单独作图时，再按日过滤「该日该币种有有效串联价」的条目，勿要求全窗口每一天都有该币种（否则易漏掉 GBP 等回填较晚的字段）。
 */
export function pickFxMonthlyChartTargets(chartBase: string): string[] {
  const base = /^[A-Z]{3}$/.test(chartBase) ? chartBase.toUpperCase() : 'CNY';
  const five = FX_TREND_MAJOR_FIVE as readonly string[];
  const baseInFive = (five as readonly string[]).includes(base);
  return baseInFive ? five.filter((c) => c !== base).slice() : [...five];
}

/**
 * @param _rows 已弃用，保留参数以免旧调用编译失败；目标列表不再依赖「全日齐全」。
 */
export function pickFourFxChartTargets(
  chartBase: string,
  _rows?: FxUsdMidRates[]
): string[] {
  return pickFxMonthlyChartTargets(chartBase);
}

/** 旧名兼容 */
export const pickFxChartLineTargets = pickFourFxChartTargets;
