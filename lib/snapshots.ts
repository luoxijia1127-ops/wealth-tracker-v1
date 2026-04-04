/**
 * 每日净值快照：date 使用上海日历日与资产/历史一致。
 * totalValue 为多币种市值直接相加（未折算）；totalValueCny 为按当日中间价折人民币合计。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getShanghaiDateString } from '@/lib/date-shanghai';

export const SNAPSHOTS_STORAGE_KEY = 'snapshots';

export type Snapshot = {
  date: string;
  totalValue: number;
  /** 折合人民币合计；历史数据可能缺失 */
  totalValueCny?: number;
  /** 所用汇率的基准日期（多为接口返回日） */
  fxRateDate?: string;
};

/** 展示与曲线优先用折算人民币，否则回退未折算合计 */
export function snapshotDisplayTotal(s: Snapshot): number {
  if (
    typeof s.totalValueCny === 'number' &&
    Number.isFinite(s.totalValueCny)
  ) {
    return s.totalValueCny;
  }
  return s.totalValue;
}

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
 * 未传入 totalValueCny 时保留当日已有折算字段，避免仅刷新行情时误删汇率结果。
 */
export async function saveSnapshot(
  totalValue: number,
  options?: { totalValueCny?: number; fxRateDate?: string | null }
): Promise<void> {
  const snapshots = await getSnapshots();
  const today = getShanghaiDateString();
  const idx = snapshots.findIndex((s) => s.date === today);
  const prev = idx >= 0 ? snapshots[idx]! : null;

  const entry: Snapshot = { date: today, totalValue };
  if (options?.totalValueCny !== undefined) {
    entry.totalValueCny = options.totalValueCny;
    entry.fxRateDate =
      options.fxRateDate === null || options.fxRateDate === undefined
        ? undefined
        : options.fxRateDate;
  } else if (prev && prev.date === today) {
    if (prev.totalValueCny !== undefined) entry.totalValueCny = prev.totalValueCny;
    if (prev.fxRateDate !== undefined) entry.fxRateDate = prev.fxRateDate;
  }

  if (idx >= 0) {
    snapshots[idx] = entry;
  } else {
    snapshots.push(entry);
  }
  snapshots.sort((a, b) => a.date.localeCompare(b.date));
  await AsyncStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(snapshots));
}

/** 批量写回（如恢复资产后回补历史日净值） */
export async function saveSnapshotsList(snapshots: Snapshot[]): Promise<void> {
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  await AsyncStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(sorted));
}
