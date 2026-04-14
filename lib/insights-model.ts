/**
 * Insights 图表用纯函数与常量（无 React），便于单测与页面拆分。
 */

import {
  formatMoney,
  getAssetCurrency,
  getAssetDisplayValue,
} from '@/lib/asset-value';
import {
  convertDisplayValueToCurrency,
  type FxUsdMidRates,
} from '@/lib/fx-rates';
import {
  ASSET_CATEGORY_ORDER,
  CATEGORY_LABEL_ZH,
  type AssetCategory,
  type SimpleAsset,
} from '@/types/asset';
import Pie from 'paths-js/pie';
import {
  snapshotDisplayTotal,
  type Snapshot,
} from '@/lib/snapshots';

/** 快照净值：有人民币折算字段时折到默认展示货币，否则沿用 snapshotDisplayTotal */
export function snapshotDisplayTotalInDisplay(
  s: Snapshot,
  displayCurrency: string,
  usdRates: FxUsdMidRates['rates'] | null
): number {
  const cny =
    typeof s.totalValueCny === 'number' && Number.isFinite(s.totalValueCny)
      ? s.totalValueCny
      : null;
  const dc = /^[A-Z]{3}$/.test(displayCurrency) ? displayCurrency : 'CNY';
  if (cny === null) return snapshotDisplayTotal(s);
  if (!usdRates || !(usdRates.CNY > 0) || dc === 'CNY') return cny;
  const v = convertDisplayValueToCurrency(cny, 'CNY', dc, usdRates);
  return Number.isFinite(v) ? v : cny;
}

export type InsightsChartTab = 'trend' | 'distribution' | 'returns';

export const INSIGHTS_CHART_TABS: {
  id: InsightsChartTab;
  label: string;
}[] = [
  { id: 'trend', label: '资产变动' },
  { id: 'distribution', label: '资产分布' },
  { id: 'returns', label: '投资回报' },
];

/** 净值曲线时间范围（相对「锚定日」向前回溯）；CUSTOM 用起止日截取 */
export type TrendTimeframe = '7D' | '1M' | '3M' | '1Y' | 'ALL' | 'CUSTOM';

export type TrendCustomRange = { start: string; end: string };

export const TREND_TIMEFRAME_OPTIONS: {
  id: TrendTimeframe;
  label: string;
}[] = [
  { id: '7D', label: '7天' },
  { id: '1M', label: '1月' },
  { id: '3M', label: '3月' },
  { id: '1Y', label: '1年' },
  { id: 'ALL', label: '全部' },
  { id: 'CUSTOM', label: '自定义' },
];

const TREND_LOOKBACK_DAYS: Record<Exclude<TrendTimeframe, 'CUSTOM' | 'ALL'>, number> = {
  '7D': 7,
  '1M': 31,
  '3M': 92,
  '1Y': 366,
};

function parseYmd(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  return { y: +m[1]!, m: +m[2]!, d: +m[3]! };
}

/** 日历日加减（YYYY-MM-DD，按 UTC 日期分量计算，与快照日期格式一致） */
export function addCalendarDaysYmd(ymd: string, deltaDays: number): string {
  const p = parseYmd(ymd);
  if (!p) return ymd;
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d + deltaDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * 按时间范围截取已按日期升序排列的快照。
 * CUSTOM：用 customRange 与 anchor 交集；未传 customRange 时默认近 30 日。
 */
export function filterSnapshotsByTimeframe(
  orderedAsc: Snapshot[],
  tf: TrendTimeframe,
  anchorDate: string,
  customRange?: TrendCustomRange | null
): Snapshot[] {
  const upToToday = orderedAsc.filter((s) => s.date <= anchorDate);
  if (tf === 'ALL') return upToToday;
  if (tf === 'CUSTOM') {
    let start =
      customRange?.start ?? addCalendarDaysYmd(anchorDate, -30);
    let end = customRange?.end ?? anchorDate;
    if (start > end) {
      const t = start;
      start = end;
      end = t;
    }
    return upToToday.filter((s) => s.date >= start && s.date <= end);
  }
  const days = TREND_LOOKBACK_DAYS[tf];
  const minDate = addCalendarDaysYmd(anchorDate, -days);
  return upToToday.filter((s) => s.date >= minDate);
}

/** `YYYY-MM-DD` → `2026年4月2日` */
export function formatYmdChinese(ymd: string): string {
  const p = parseYmd(ymd);
  if (!p) return ymd;
  return `${p.y}年${p.m}月${p.d}日`;
}

/** 纵轴刻度：千元人民币，保留 1 位小数，如 `¥10.2K` */
export function formatTrendYAxisThousandsCny(value: number): string {
  if (!Number.isFinite(value)) return '';
  const k = value / 1000;
  const sign = k < 0 ? '−' : '';
  return `${sign}¥${Math.abs(k).toFixed(1)}K`;
}

/** 纵轴刻度：千元量级 + 币种代码（非 CNY 时不用 ¥ 前缀） */
export function formatTrendYAxisThousandsDisplay(
  value: number,
  displayCurrency: string
): string {
  if (displayCurrency === 'CNY') return formatTrendYAxisThousandsCny(value);
  if (!Number.isFinite(value)) return '';
  const k = value / 1000;
  const sign = k < 0 ? '−' : '';
  const abs = Math.abs(k);
  const body = abs >= 100 ? abs.toFixed(0) : abs.toFixed(1);
  return `${sign}${body}k ${displayCurrency}`;
}

/** Y 轴刻度：紧凑人民币读数（万 / 亿），占宽尽量小 */
export function formatTrendAxisCny(value: number): string {
  if (!Number.isFinite(value)) return '';
  const sign = value < 0 ? '-' : '';
  const v = Math.abs(value);
  if (v >= 1e8) {
    const x = value / 1e8;
    const d = Math.abs(x) >= 10 ? 1 : 2;
    return `${sign}${x.toFixed(d)}亿`;
  }
  if (v >= 1e4) {
    const x = value / 1e4;
    const d = Math.abs(x) >= 100 ? 0 : Math.abs(x) >= 10 ? 1 : 2;
    return `${sign}${x.toFixed(d)}万`;
  }
  if (v >= 1000) {
    return `${sign}${(value / 1000).toFixed(1)}k`;
  }
  return `${sign}${Math.round(value)}`;
}

export type ChartData = {
  labels: string[];
  datasets: [{ data: number[] }];
};

export type TrendPoint = { date: string; valueCny: number };

export type TrendChartModel = {
  /** 兼容旧 LineChart 数据（已不再用于主渲染） */
  data: ChartData;
  formatYLabel: (v: string) => string;
  series: TrendPoint[];
  yMin: number;
  yMax: number;
};

function computeYDomain(min: number, max: number): { yMin: number; yMax: number } {
  if (!(max > min)) {
    const base = min;
    const pad = Math.max(1, Math.abs(base) * 0.002);
    return { yMin: base - pad, yMax: base + pad };
  }
  const span = max - min;
  const pad = span * 0.08;
  return { yMin: min - pad, yMax: max + pad };
}

export type DonutSlice = {
  category: AssetCategory;
  name: string;
  value: number;
  color: string;
};

export function formatChange(diff: number, pct: number): string {
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${Math.round(diff).toLocaleString()} (${sign}${pct.toFixed(1)}%)`;
}

/**
 * Insights 顶部「今日盈亏」分行：金额（含 ±¥）与百分比（两位小数）。
 */
export function formatInsightsPnlParts(
  diff: number,
  pct: number,
  currency: string = 'CNY'
): {
  amountText: string;
  pctText: string;
} {
  const sign = diff >= 0 ? '+' : '−';
  const code = /^[A-Z]{3}$/.test(currency) ? currency : 'CNY';
  const body = formatMoney(Math.abs(diff), code);
  const amountText = `${sign}${body}`;
  const signPct = pct >= 0 ? '+' : '−';
  const pctText = `${signPct}${Math.abs(pct).toFixed(2)}%`;
  return { amountText, pctText };
}

export type TrendChartModelOptions = {
  /** 展示用默认货币（快照存 CNY 时按当前汇率线性换算到该币种） */
  displayCurrency?: string;
  usdRates?: FxUsdMidRates['rates'] | null;
};

export function toTrendChartModel(
  snapshots: Snapshot[],
  opts?: TrendChartModelOptions
): TrendChartModel {
  const displayCurrency = opts?.displayCurrency ?? 'CNY';
  const usdRates = opts?.usdRates;
  const series: TrendPoint[] = snapshots.map((s) => {
    let valueCny = snapshotDisplayTotal(s);
    if (
      usdRates &&
      usdRates.CNY > 0 &&
      displayCurrency !== 'CNY' &&
      typeof s.totalValueCny === 'number' &&
      Number.isFinite(s.totalValueCny)
    ) {
      const v = convertDisplayValueToCurrency(
        s.totalValueCny,
        'CNY',
        displayCurrency,
        usdRates
      );
      if (Number.isFinite(v)) valueCny = v;
    }
    return { date: s.date, valueCny };
  });
  const dates = series.map((s) => s.date);
  const labels = dates.map((d, i) =>
    dates.length === 1
      ? formatYmdChinese(d)
      : i === 0 || i === dates.length - 1
        ? formatYmdChinese(d)
        : ''
  );
  const raw = series.map((s) => s.valueCny);
  if (raw.length === 0) {
    return {
      data: { labels, datasets: [{ data: [] }] },
      formatYLabel: () => '',
      series: [],
      yMin: 0,
      yMax: 1,
    };
  }
  let min = Math.min(...raw);
  let max = Math.max(...raw);
  const { yMin, yMax } = computeYDomain(min, max);
  const span = yMax - yMin;
  const normalized = raw.map((v) => ((v - yMin) / span) * 100);
  return {
    data: { labels, datasets: [{ data: normalized }] },
    formatYLabel: (v: string) => {
      const n = parseFloat(v);
      if (Number.isNaN(n)) return '';
      const actual = yMin + (n / 100) * span;
      return displayCurrency === 'CNY'
        ? formatTrendYAxisThousandsCny(actual)
        : formatTrendYAxisThousandsDisplay(actual, displayCurrency);
    },
    series,
    yMin,
    yMax,
  };
}

export function getDailyChange(
  snapshots: Snapshot[]
): { diff: number; pct: number } | null {
  if (snapshots.length < 2) return null;
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const prev = sorted[sorted.length - 2];
  const last = sorted[sorted.length - 1];
  const lastT = snapshotDisplayTotal(last);
  const prevT = snapshotDisplayTotal(prev);
  const diff = lastT - prevT;
  const pct = prevT !== 0 ? (diff / prevT) * 100 : 0;
  return { diff, pct };
}

/**
 * 在默认货币展示下，将「快照口径」的日涨跌换算到该货币（对 CNY 快照为线性缩放，百分比不变）。
 */
export function getDailyChangeInDisplay(
  snapshots: Snapshot[],
  displayCurrency: string,
  usdRates: FxUsdMidRates['rates'] | null
): { diff: number; pct: number } | null {
  const base = getDailyChange(snapshots);
  if (!base) return null;
  const dc = /^[A-Z]{3}$/.test(displayCurrency) ? displayCurrency : 'CNY';
  if (dc === 'CNY' || !usdRates || !(usdRates.CNY > 0)) return base;
  const k = convertDisplayValueToCurrency(1, 'CNY', dc, usdRates);
  if (!Number.isFinite(k)) return base;
  return { diff: base.diff * k, pct: base.pct };
}

/**
 * 各大类市值合计。传入有效 `usdRates`（含 CNY>0）时按 Frankfurter/USD 串联折到 `displayCurrency`，否则为各币种展示值直接相加（不推荐）。
 */
export function aggregateByCategory(
  assets: SimpleAsset[],
  usdRates?: FxUsdMidRates['rates'] | null,
  displayCurrency: string = 'CNY'
): Record<AssetCategory, number> {
  const m: Record<AssetCategory, number> = {
    Stock: 0,
    Fund: 0,
    ETF: 0,
    Cash: 0,
    Gold: 0,
    Custom: 0,
  };
  const useFx = usdRates != null && usdRates.CNY > 0;
  const target = /^[A-Z]{3}$/.test(displayCurrency) ? displayCurrency : 'CNY';
  for (const a of assets) {
    const c = a.category;
    if (!(c in m)) continue;
    const raw = getAssetDisplayValue(a);
    let add: number;
    if (useFx) {
      add = convertDisplayValueToCurrency(
        raw,
        getAssetCurrency(a),
        target,
        usdRates!
      );
      if (!Number.isFinite(add)) add = 0;
    } else {
      add = raw;
    }
    m[c] += add;
  }
  return m;
}

export function buildDonutSlices(
  assets: SimpleAsset[],
  categoryAccents: Record<AssetCategory, string>,
  usdRates?: FxUsdMidRates['rates'] | null,
  displayCurrency: string = 'CNY'
): DonutSlice[] {
  const sums = aggregateByCategory(assets, usdRates, displayCurrency);
  const out: DonutSlice[] = [];
  for (const cat of ASSET_CATEGORY_ORDER) {
    const v = sums[cat];
    if (v > 0) {
      out.push({
        category: cat,
        name: CATEGORY_LABEL_ZH[cat],
        value: v,
        color: categoryAccents[cat],
      });
    }
  }
  return out;
}

export const DONUT_EXPLODE = 12;
export const DONUT_SELECTED_SCALE = 1.08;

/** 与环形图绘制共用，保证质心用于面板左右判断时一致 */
export function getDonutPieCurves(
  slices: DonutSlice[],
  width: number,
  ringSize: number
) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const outer = Math.min(ringSize * 0.42, width * 0.38);
  const inner = outer * 0.58;
  const curves =
    total > 0
      ? Pie({
          center: [0, 0],
          r: inner,
          R: outer,
          data: slices,
          accessor: (x: DonutSlice) => x.value,
        }).curves
      : [];
  return { curves, total, outer, inner };
}

export function getCentroidForCategory(
  slices: DonutSlice[],
  category: AssetCategory,
  width: number,
  ringSize: number
): [number, number] | null {
  const { curves } = getDonutPieCurves(slices, width, ringSize);
  const hit = curves.find((c) => c.item.category === category);
  return hit ? hit.sector.centroid : null;
}
