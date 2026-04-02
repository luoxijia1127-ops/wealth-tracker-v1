/**
 * Insights 图表用纯函数与常量（无 React），便于单测与页面拆分。
 */

import {
  formatMoney,
  getAssetCurrency,
  getAssetDisplayValue,
} from '@/lib/asset-value';
import {
  convertDisplayValueToCny,
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

export type InsightsChartTab = 'trend' | 'distribution' | 'returns';

export const INSIGHTS_CHART_TABS: {
  id: InsightsChartTab;
  label: string;
}[] = [
  { id: 'trend', label: '资产变动' },
  { id: 'distribution', label: '资产分布' },
  { id: 'returns', label: '投资回报' },
];

/** 净值曲线时间范围（相对「锚定日」向前回溯） */
export type TrendTimeframe = '1M' | '3M' | '6M' | '1Y' | 'ALL';

export const TREND_TIMEFRAME_OPTIONS: {
  id: TrendTimeframe;
  label: string;
}[] = [
  { id: '1M', label: '1M' },
  { id: '3M', label: '3M' },
  { id: '6M', label: '6M' },
  { id: '1Y', label: '1Y' },
  { id: 'ALL', label: 'ALL' },
];

const TREND_LOOKBACK_DAYS: Record<Exclude<TrendTimeframe, 'ALL'>, number> = {
  '1M': 31,
  '3M': 92,
  '6M': 183,
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
 * 按时间范围截取已按日期升序排列的快照；ALL 为全部。
 * anchorDate 一般为上海当日，窗口为 [anchorDate - 回溯天数, anchorDate] 内的快照。
 */
export function filterSnapshotsByTimeframe(
  orderedAsc: Snapshot[],
  tf: TrendTimeframe,
  anchorDate: string
): Snapshot[] {
  const upToToday = orderedAsc.filter((s) => s.date <= anchorDate);
  if (tf === 'ALL') return upToToday;
  const days = TREND_LOOKBACK_DAYS[tf];
  const minDate = addCalendarDaysYmd(anchorDate, -days);
  return upToToday.filter((s) => s.date >= minDate);
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

function buildSparseMonthDayLabels(dates: string[], maxTicks: number): string[] {
  if (dates.length === 0) return [];
  if (dates.length <= maxTicks) {
    return dates.map((d) => d.slice(5));
  }
  const out = dates.map(() => '');
  const n = dates.length;
  for (let t = 0; t < maxTicks; t++) {
    const idx = Math.round((t / Math.max(1, maxTicks - 1)) * (n - 1));
    out[idx] = dates[idx]!.slice(5);
  }
  return out;
}

export type ChartData = {
  labels: string[];
  datasets: [{ data: number[] }];
};

export type TrendChartModel = {
  data: ChartData;
  formatYLabel: (v: string) => string;
};

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
 * Insights 顶部「今日盈亏」分行：金额（含 ±¥）与百分比（四位小数），便于与参考图一致排版。
 */
export function formatInsightsPnlParts(diff: number, pct: number): {
  amountText: string;
  pctText: string;
} {
  const sign = diff >= 0 ? '+' : '−';
  const body = formatMoney(Math.abs(diff), 'CNY');
  const amountText = `${sign}${body}`;
  const signPct = pct >= 0 ? '+' : '−';
  const pctText = `${signPct}${Math.abs(pct).toFixed(4)}%`;
  return { amountText, pctText };
}

export function toTrendChartModel(snapshots: Snapshot[]): TrendChartModel {
  const dates = snapshots.map((s) => s.date);
  const labels = buildSparseMonthDayLabels(dates, 7);
  const raw = snapshots.map((s) => snapshotDisplayTotal(s));
  if (raw.length === 0) {
    return {
      data: { labels, datasets: [{ data: [] }] },
      formatYLabel: () => '',
    };
  }
  let min = Math.min(...raw);
  let max = Math.max(...raw);
  if (!(max > min)) {
    const base = raw[0] ?? 0;
    const pad = Math.max(1, Math.abs(base) * 0.002);
    min = base - pad;
    max = base + pad;
  }
  const span = max - min;
  const normalized = raw.map((v) => ((v - min) / span) * 100);
  return {
    data: { labels, datasets: [{ data: normalized }] },
    formatYLabel: (v: string) => {
      const n = parseFloat(v);
      if (Number.isNaN(n)) return '';
      const actual = min + (n / 100) * span;
      return formatTrendAxisCny(actual);
    },
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
 * 各大类市值合计。传入有效 `usdRates`（含 CNY>0）时按 Frankfurter/USD 串联折人民币，否则为各币种展示值直接相加（不推荐）。
 */
export function aggregateByCategory(
  assets: SimpleAsset[],
  usdRates?: FxUsdMidRates['rates'] | null
): Record<AssetCategory, number> {
  const m: Record<AssetCategory, number> = {
    Stock: 0,
    Fund: 0,
    ETF: 0,
    Cash: 0,
    Gold: 0,
  };
  const useFx = usdRates != null && usdRates.CNY > 0;
  for (const a of assets) {
    const c = a.category;
    if (!(c in m)) continue;
    const raw = getAssetDisplayValue(a);
    const add = useFx
      ? convertDisplayValueToCny(raw, getAssetCurrency(a), usdRates!)
      : raw;
    m[c] += add;
  }
  return m;
}

export function buildDonutSlices(
  assets: SimpleAsset[],
  categoryAccents: Record<AssetCategory, string>,
  usdRates?: FxUsdMidRates['rates'] | null
): DonutSlice[] {
  const sums = aggregateByCategory(assets, usdRates);
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
