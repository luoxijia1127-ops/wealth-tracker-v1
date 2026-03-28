/**
 * Insights 图表用纯函数与常量（无 React），便于单测与页面拆分。
 */

import {
  formatMoney,
  getAssetCurrency,
  getAssetDisplayValue,
} from '@/lib/asset-value';
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

export function toTrendChartModel(snapshots: Snapshot[]): TrendChartModel {
  const labels = snapshots.map((s) => s.date.slice(5));
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
      const k = actual / 1000;
      const absK = Math.abs(k);
      const digits = absK >= 100 ? 0 : absK >= 10 ? 1 : 2;
      return `${k.toFixed(digits)}k`;
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

export function aggregateByCategory(
  assets: SimpleAsset[]
): Record<AssetCategory, number> {
  const m: Record<AssetCategory, number> = {
    Stock: 0,
    Fund: 0,
    ETF: 0,
    Cash: 0,
    Gold: 0,
  };
  for (const a of assets) {
    const c = a.category;
    if (c in m) m[c] += getAssetDisplayValue(a);
  }
  return m;
}

export function buildDonutSlices(
  assets: SimpleAsset[],
  categoryAccents: Record<AssetCategory, string>
): DonutSlice[] {
  const sums = aggregateByCategory(assets);
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
