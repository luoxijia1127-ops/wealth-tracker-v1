/**
 * 每日净值快照：{ date, totalValue }，date 使用上海日历日与资产/历史一致。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getShanghaiDateString } from '@/lib/date-shanghai';

export const SNAPSHOTS_STORAGE_KEY = 'snapshots';

export type Snapshot = {
  date: string;
  totalValue: number;
};

export async function getSnapshots(): Promise<Snapshot[]> {
  try {
    const stored = await AsyncStorage.getItem(SNAPSHOTS_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * 按上海「今天」upsert 一条；其它日期不动；按日期排序后写回。
 */
export async function saveSnapshot(totalValue: number): Promise<void> {
  const snapshots = await getSnapshots();
  const today = getShanghaiDateString();
  const idx = snapshots.findIndex((s) => s.date === today);
  if (idx >= 0) {
    snapshots[idx] = { date: today, totalValue };
  } else {
    snapshots.push({ date: today, totalValue });
  }
  snapshots.sort((a, b) => a.date.localeCompare(b.date));
  await AsyncStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(snapshots));
}
