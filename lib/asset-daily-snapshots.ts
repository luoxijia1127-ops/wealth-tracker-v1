import AsyncStorage from '@react-native-async-storage/async-storage';
import { getShanghaiDateString } from '@/lib/date-shanghai';
import { getAssetCurrency, getAssetDisplayValue } from '@/lib/asset-value';
import type { AssetCategory, SimpleAsset } from '@/types/asset';

export const ASSET_DAILY_SNAPSHOTS_KEY = 'asset_daily_snapshots';

export type AssetDailySnapshotItem = {
  assetId: string;
  name: string;
  category: AssetCategory;
  /** 展示口径市值 */
  value: number;
  currency: string;
};

export type AssetDailySnapshot = {
  date: string;
  items: AssetDailySnapshotItem[];
};

export async function getAssetDailySnapshots(): Promise<AssetDailySnapshot[]> {
  try {
    const stored = await AsyncStorage.getItem(ASSET_DAILY_SNAPSHOTS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) ? (parsed as AssetDailySnapshot[]) : [];
  } catch {
    return [];
  }
}

export async function saveAssetDailySnapshot(
  assets: SimpleAsset[],
  date?: string
): Promise<void> {
  const day = date ?? getShanghaiDateString();
  const items: AssetDailySnapshotItem[] = assets.map((a) => ({
    assetId: a.id,
    name: a.name,
    category: a.category,
    value: getAssetDisplayValue(a),
    currency: getAssetCurrency(a),
  }));

  const snaps = await getAssetDailySnapshots();
  const idx = snaps.findIndex((s) => s.date === day);
  if (idx >= 0) snaps[idx] = { date: day, items };
  else snaps.push({ date: day, items });
  snaps.sort((a, b) => a.date.localeCompare(b.date));

  // 防止无限增长：保留最近 730 天
  const MAX_DAYS = 730;
  const trimmed =
    snaps.length > MAX_DAYS ? snaps.slice(snaps.length - MAX_DAYS) : snaps;
  await AsyncStorage.setItem(ASSET_DAILY_SNAPSHOTS_KEY, JSON.stringify(trimmed));
}

