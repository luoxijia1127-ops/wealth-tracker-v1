/**
 * 投资回报指标：累计收益率、年化收益率、持有天数；供 Insights 散点图与表格。
 *
 * 累计收益率 = (期末市值 + 累计卖出回款 + 持有期间净现金流 − 累计买入投入) / 累计买入投入
 * 年化收益率 = (1 + 累计收益率)^(365 / 持有天数) − 1（持有天数须 > 0 且 1+累计收益率 > 0）
 */

import { ensureCashBaselineLedger, usesCashAmountLedger } from '@/lib/cash-ledger';
import { getShanghaiDateString } from '@/lib/date-shanghai';
import { ensureBaselineLedger } from '@/lib/trade-ledger';
import {
  type AssetCategory,
  type SimpleAsset,
  type TradeLedgerEntry,
} from '@/types/asset';
import { getAssetCurrency, getAssetDisplayValue } from '@/lib/asset-value';

export type InvestmentReturnReason =
  | 'ok'
  | 'no_buy'
  | 'bad_days'
  | 'bad_return_base'
  | 'zero_return'
  | 'unsupported';

export type InvestmentReturnMetric = {
  assetId: string;
  name: string;
  category: AssetCategory;
  currency: string;
  /** 累计买入投入（分母） */
  buyAmount: number;
  /** 当前市值/持仓估值 */
  endValue: number;
  /** 历史卖出回款合计 */
  sellProceeds: number;
  /** 持有期间净现金流（当前无股息字段时为 0，预留） */
  cashFlowNet: number;
  /** 累计收益率，小数如 0.12 表示 12% */
  cumulativeReturn: number;
  /** 年化收益率，无效时为 null */
  annualizedReturn: number | null;
  holdingDays: number;
  reason: InvestmentReturnReason;
  /** 首笔相关日期（用于展示） */
  startDate: string | null;
};

function calendarDaysBetweenYmd(start: string, end: string): number {
  const [y1, m1, d1] = start.split('-').map((x) => parseInt(x, 10));
  const [y2, m2, d2] = end.split('-').map((x) => parseInt(x, 10));
  if (
    [y1, m1, d1, y2, m2, d2].some((n) => Number.isNaN(n))
  ) {
    return 0;
  }
  const t0 = Date.UTC(y1, m1 - 1, d1);
  const t1 = Date.UTC(y2, m2 - 1, d2);
  const diff = Math.round((t1 - t0) / 86400000);
  return diff < 0 ? 0 : diff;
}

/** 持有自然日数（含建仓日与今日），与常见「持有天数」展示一致 */
function calendarDaysInclusiveYmd(start: string, end: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return 0;
  }
  let a = start;
  let b = end;
  if (a > b) {
    const t = a;
    a = b;
    b = t;
  }
  return calendarDaysBetweenYmd(a, b) + 1;
}

function sumListedFlows(history: TradeLedgerEntry[]): {
  buyCost: number;
  sellProceeds: number;
  firstDate: string | null;
  lastDate: string | null;
} {
  let buyCost = 0;
  let sellProceeds = 0;
  let firstDate: string | null = null;
  let lastDate: string | null = null;
  const sorted = [...history].sort((a, b) =>
    a.tradeDate !== b.tradeDate
      ? a.tradeDate.localeCompare(b.tradeDate)
      : a.id.localeCompare(b.id)
  );
  for (const t of sorted) {
    const flow = t.shares * t.unitPriceCny;
    if (t.side === 'buy') buyCost += flow;
    else sellProceeds += flow;
    if (!firstDate || t.tradeDate < firstDate) firstDate = t.tradeDate;
    if (!lastDate || t.tradeDate > lastDate) lastDate = t.tradeDate;
  }
  return { buyCost, sellProceeds, firstDate, lastDate };
}

function annualizedFromTotalReturn(
  totalReturn: number,
  holdingDays: number
): number | null {
  if (!(holdingDays > 0)) return null;
  const base = 1 + totalReturn;
  if (!(base > 0) || !Number.isFinite(base)) return null;
  const exp = 365 / holdingDays;
  if (!Number.isFinite(exp) || exp <= 0) return null;
  const a = Math.pow(base, exp) - 1;
  return Number.isFinite(a) ? a : null;
}

/**
 * 单资产指标。不支持或数据不足时 reason !== 'ok'，仍返回部分字段供表格说明。
 */
export function computeInvestmentReturnMetric(
  asset: SimpleAsset
): InvestmentReturnMetric {
  const today = getShanghaiDateString();
  const currency = getAssetCurrency(asset);
  const endValue = getAssetDisplayValue(asset);
  const base: Omit<InvestmentReturnMetric, 'reason'> = {
    assetId: asset.id,
    name: asset.name,
    category: asset.category,
    currency,
    buyAmount: 0,
    endValue,
    sellProceeds: 0,
    cashFlowNet: 0,
    cumulativeReturn: 0,
    annualizedReturn: null,
    holdingDays: 0,
    startDate: null,
  };

  if (usesCashAmountLedger(asset)) {
    const basis =
      typeof asset.costBasis === 'number' && asset.costBasis > 0
        ? asset.costBasis
        : null;
    const ledger = ensureCashBaselineLedger(asset);
    if (ledger.length === 0) {
      return { ...base, reason: 'unsupported' };
    }
    const sorted = [...ledger].sort((a, b) =>
      a.entryDate !== b.entryDate
        ? a.entryDate.localeCompare(b.entryDate)
        : a.id.localeCompare(b.id)
    );
    const startDate = sorted[0]!.entryDate;
    const holdingDays = calendarDaysInclusiveYmd(startDate, today);
    if (basis === null || !(basis > 0)) {
      return {
        ...base,
        buyAmount: 0,
        startDate,
        holdingDays,
        reason: 'no_buy',
      };
    }
    const cashFlowNet = 0;
    const totalReturn = (endValue + cashFlowNet - basis) / basis;
    const annualizedReturn = annualizedFromTotalReturn(
      totalReturn,
      holdingDays
    );
    let reason: InvestmentReturnReason = 'ok';
    if (!(holdingDays > 0)) reason = 'bad_days';
    else if (1 + totalReturn <= 0) reason = 'bad_return_base';
    else if (Math.abs(totalReturn) < 1e-12) reason = 'zero_return';
    return {
      ...base,
      buyAmount: basis,
      sellProceeds: 0,
      cashFlowNet,
      cumulativeReturn: totalReturn,
      annualizedReturn,
      holdingDays,
      startDate,
      reason,
    };
  }

  if (
    asset.category !== 'Stock' &&
    asset.category !== 'Fund' &&
    asset.category !== 'ETF' &&
    asset.category !== 'Gold'
  ) {
    return { ...base, reason: 'unsupported' };
  }

  const rawHistory = asset.tradeHistory ?? [];
  const history =
    rawHistory.length > 0
      ? rawHistory
      : ensureBaselineLedger(asset);
  if (history.length === 0) {
    return { ...base, reason: 'unsupported' };
  }

  const { buyCost, sellProceeds, firstDate } = sumListedFlows(history);
  const cashFlowNet = 0;
  const startDate = firstDate ?? null;
  const holdingDays =
    startDate !== null ? calendarDaysInclusiveYmd(startDate, today) : 0;

  if (!(buyCost > 0)) {
    return {
      ...base,
      buyAmount: buyCost,
      sellProceeds,
      cashFlowNet,
      startDate,
      holdingDays,
      reason: 'no_buy',
    };
  }

  const totalReturn =
    (endValue + sellProceeds + cashFlowNet - buyCost) / buyCost;
  const annualizedReturn = annualizedFromTotalReturn(
    totalReturn,
    holdingDays
  );

  let reason: InvestmentReturnReason = 'ok';
  if (!(holdingDays > 0)) reason = 'bad_days';
  else if (1 + totalReturn <= 0) reason = 'bad_return_base';
  else if (Math.abs(totalReturn) < 1e-12) reason = 'zero_return';

  return {
    ...base,
    buyAmount: buyCost,
    sellProceeds,
    cashFlowNet,
    cumulativeReturn: totalReturn,
    annualizedReturn,
    holdingDays,
    startDate,
    reason,
  };
}

export function computeAllReturnMetrics(
  assets: SimpleAsset[]
): InvestmentReturnMetric[] {
  return assets.map((a) => computeInvestmentReturnMetric(a));
}

/** 可作图：有买入成本、持有天数、有效累计收益（含累计亏损≥100% 等仅年化不可用的情况） */
export function isPlottableMetric(m: InvestmentReturnMetric): boolean {
  if (m.buyAmount <= 0 || m.holdingDays <= 0) return false;
  if (!Number.isFinite(m.cumulativeReturn)) return false;
  if (
    m.reason === 'unsupported' ||
    m.reason === 'no_buy' ||
    m.reason === 'bad_days' ||
    m.reason === 'zero_return'
  ) {
    return false;
  }
  return true;
}

/** 纵轴裁剪上界：累计收益率比例，如 4 = +400% */
export const CUMULATIVE_CHART_CAP = 4;
/** 纵轴裁剪下界：-1 = -100%（全亏） */
export const CUMULATIVE_CHART_FLOOR = -1;

export function clampCumulativeForAxis(r: number): number {
  if (!Number.isFinite(r)) return 0;
  return Math.max(
    CUMULATIVE_CHART_FLOOR,
    Math.min(CUMULATIVE_CHART_CAP, r)
  );
}
