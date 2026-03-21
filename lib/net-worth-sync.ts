/**
 * 刷新行情 → 按需写资产 → 若「今日快照合计」变化再 upsert 快照（减少无意义写入）。
 */

import { sumDisplayValuesNaive } from '@/lib/asset-value';
import { getShanghaiDateString } from '@/lib/date-shanghai';
import { refreshListedQuotes } from '@/lib/quote-refresh';
import { getSnapshots, saveSnapshot } from '@/lib/snapshots';
import type { SimpleAsset } from '@/types/asset';

const EPS = 1e-6;

export async function syncNetWorthFromMarket(): Promise<SimpleAsset[]> {
  const assets = await refreshListedQuotes();
  const total = sumDisplayValuesNaive(assets);
  const snapshots = await getSnapshots();
  const today = getShanghaiDateString();
  const existing = snapshots.find((s) => s.date === today);
  if (
    !existing ||
    Math.abs(existing.totalValue - total) > EPS
  ) {
    await saveSnapshot(total);
  }
  return assets;
}
