/**
 * 一次性清理：移除早期测试写入的 3-19、3-21 净值快照（全局 + 逐资产日快照）。
 * 执行后写入标记，不再重复运行。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ASSET_DAILY_SNAPSHOTS_KEY } from '@/lib/asset-daily-snapshots';
import { SNAPSHOTS_STORAGE_KEY, type Snapshot } from '@/lib/snapshots';

const MIGRATION_KEY = 'migration_purge_test_snapshots_03_19_21_v1';

/** 可能为 2025 或 2026 年测试数据，一并剔除 */
const DATES_TO_REMOVE = new Set([
  '2025-03-19',
  '2025-03-21',
  '2026-03-19',
  '2026-03-21',
]);

export async function purgeLegacyTestSnapshotDatesOnce(): Promise<void> {
  try {
    if ((await AsyncStorage.getItem(MIGRATION_KEY)) === '1') return;

    const rawSnaps = await AsyncStorage.getItem(SNAPSHOTS_STORAGE_KEY);
    if (rawSnaps) {
      const parsed = JSON.parse(rawSnaps) as unknown;
      if (Array.isArray(parsed)) {
        const arr = parsed as Snapshot[];
        const next = arr.filter((s) => !DATES_TO_REMOVE.has(s.date));
        if (next.length !== arr.length) {
          next.sort((a, b) => a.date.localeCompare(b.date));
          await AsyncStorage.setItem(
            SNAPSHOTS_STORAGE_KEY,
            JSON.stringify(next)
          );
        }
      }
    }

    const rawDaily = await AsyncStorage.getItem(ASSET_DAILY_SNAPSHOTS_KEY);
    if (rawDaily) {
      const parsed = JSON.parse(rawDaily) as unknown;
      if (Array.isArray(parsed)) {
        const arr = parsed as { date: string }[];
        const next = arr.filter((s) => !DATES_TO_REMOVE.has(s.date));
        if (next.length !== arr.length) {
          next.sort((a, b) => a.date.localeCompare(b.date));
          await AsyncStorage.setItem(
            ASSET_DAILY_SNAPSHOTS_KEY,
            JSON.stringify(next)
          );
        }
      }
    }

    await AsyncStorage.setItem(MIGRATION_KEY, '1');
  } catch {
    /* 清理失败不阻断启动；未写标记则下次启动可重试 */
  }
}
