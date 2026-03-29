/**
 * Insights 目标进度：相同用途文案（规范化后）+ 同币种的资产合并为一行，进度按合计市值 / 目标。
 */

import {
  filterAssetsForDashboard,
  getAssetCurrency,
  getAssetDisplayValue,
} from '@/lib/asset-value';
import type { AssetCategory, SimpleAsset } from '@/types/asset';

export function normalizePurposeKey(purpose: string | undefined): string | null {
  const t = purpose?.replace(/\s+/g, ' ').trim() ?? '';
  return t.length > 0 ? t : null;
}

export type GoalProgressDisplayRow = {
  id: string;
  primaryAssetId: string;
  label: string;
  detailLine: string;
  current: number;
  target: number;
  currency: string;
  pct: number;
  category: AssetCategory;
  ringColor: string;
  iconTint: string;
};

export function buildAggregatedGoalRows(
  assets: SimpleAsset[],
  goalRingColors: readonly string[],
  primaryFallback: string
): GoalProgressDisplayRow[] {
  type Bucket = { assets: SimpleAsset[] };
  const map = new Map<string, Bucket>();

  /** 与 Dashboard 一致：清仓证券、零份额黄金、零余额现金不参与目标进度 */
  const visible = filterAssetsForDashboard(assets);
  for (const a of visible) {
    if (typeof a.purposeTarget !== 'number' || a.purposeTarget <= 0) continue;
    const cur = getAssetCurrency(a);
    const pk = normalizePurposeKey(a.purpose);
    const key = pk
      ? `p:${pk}\0${cur}`
      : `i:${a.id}\0${cur}`;
    if (!map.has(key)) map.set(key, { assets: [] });
    map.get(key)!.assets.push(a);
  }

  const rows: GoalProgressDisplayRow[] = [];
  let colorIdx = 0;
  for (const [gkey, { assets: group }] of map) {
    const current = group.reduce((s, x) => s + getAssetDisplayValue(x), 0);
    const target = Math.max(
      ...group.map((x) => (typeof x.purposeTarget === 'number' ? x.purposeTarget : 0))
    );
    const pct =
      target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    const first = group[0]!;
    const currency = getAssetCurrency(first);
    const label =
      (normalizePurposeKey(first.purpose) ?? first.name.trim()) || '目标';
    const names = [
      ...new Set(group.map((x) => x.name.trim()).filter((n) => n.length > 0)),
    ];
    const detailLine =
      group.length > 1
        ? `${group.length} 笔：${names.slice(0, 3).join('、')}${
            names.length > 3 ? '…' : ''
          }`
        : first.name;
    const ringColor =
      goalRingColors[colorIdx % goalRingColors.length] ?? primaryFallback;
    colorIdx += 1;
    rows.push({
      id: `goal:${gkey}`,
      primaryAssetId: first.id,
      label,
      detailLine,
      current,
      target,
      currency,
      pct,
      category: first.category,
      ringColor,
      iconTint: ringColor,
    });
  }

  rows.sort((x, y) => y.pct - x.pct);
  return rows;
}
