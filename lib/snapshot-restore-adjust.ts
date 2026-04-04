/**
 * 从归档/回收站恢复资产后：自「移除日」起回补净值快照与逐资产日快照（沿用快照内市值与当前缓存汇率折人民币），并同步当日行情写今日快照。
 */

import {
  getAssetCurrency,
  getAssetDisplayValue,
} from '@/lib/asset-value';
import {
  getAssetDailySnapshots,
  replaceAllAssetDailySnapshots,
  type AssetDailySnapshotItem,
} from '@/lib/asset-daily-snapshots';
import {
  formatInstantToShanghaiDateString,
  getShanghaiDateString,
} from '@/lib/date-shanghai';
import { convertDisplayValueToCny, getCachedFxUsdRates } from '@/lib/fx-rates';
import { syncNetWorthFromMarket } from '@/lib/net-worth-sync';
import { getSnapshots, saveSnapshotsList, type Snapshot } from '@/lib/snapshots';
import type { SimpleAsset } from '@/types/asset';

/**
 * @param restored 已写回主列表的资产（可能已换新 id）
 * @param removedAtIso 归档/删除时刻 ISO 字符串，用于确定回补起始上海日历日（含当日）
 */
export async function applyRestoredAssetSnapshotAdjustments(
  restored: SimpleAsset,
  removedAtIso: string
): Promise<void> {
  const fromYmd = formatInstantToShanghaiDateString(new Date(removedAtIso));
  const today = getShanghaiDateString();
  const naive = getAssetDisplayValue(restored);
  if (!Number.isFinite(naive)) return;

  const cur = getAssetCurrency(restored);
  const cached = await getCachedFxUsdRates();
  let deltaCny: number | null = null;
  if (cached?.rates && cached.rates.CNY > 0) {
    const c = convertDisplayValueToCny(naive, cur, cached.rates);
    deltaCny = Number.isFinite(c) ? c : null;
  }

  const snapshots = await getSnapshots();
  let snapChanged = false;
  const patched: Snapshot[] = snapshots.map((s) => {
    if (s.date < fromYmd) return s;
    if (s.date === today) return s;
    const next: Snapshot = {
      ...s,
      totalValue: s.totalValue + naive,
    };
    if (
      deltaCny !== null &&
      typeof s.totalValueCny === 'number' &&
      Number.isFinite(s.totalValueCny)
    ) {
      next.totalValueCny = s.totalValueCny + deltaCny;
    }
    snapChanged = true;
    return next;
  });
  if (snapChanged) {
    await saveSnapshotsList(patched);
  }

  const item: AssetDailySnapshotItem = {
    assetId: restored.id,
    name: restored.name,
    category: restored.category,
    value: naive,
    currency: cur,
  };

  const daily = await getAssetDailySnapshots();
  let dailyChanged = false;
  const merged = daily.map((d) => {
    if (d.date < fromYmd) return d;
    if (d.items.some((i) => i.assetId === item.assetId)) return d;
    dailyChanged = true;
    return {
      ...d,
      items: [...d.items, { ...item }],
    };
  });
  if (dailyChanged) {
    await replaceAllAssetDailySnapshots(merged);
  }

  await syncNetWorthFromMarket();
}
