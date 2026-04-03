/**
 * 已归档（清仓记录）与最近删除：独立 AsyncStorage 列表，支持恢复。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { addAsset, deleteAsset, getAssets } from '@/lib/asset-storage';
import { ensureAsset, generateAssetId, type SimpleAsset } from '@/types/asset';

const ARCHIVED_KEY = '@wealth-tracker/archived-assets-v1';
const TRASH_KEY = '@wealth-tracker/deleted-assets-v1';
const MAX_ARCHIVED = 80;
const MAX_TRASH = 50;

export type AssetRecycleRecord = {
  recordId: string;
  asset: SimpleAsset;
  /** ISO 8601 */
  at: string;
};

function cloneAsset(a: SimpleAsset): SimpleAsset {
  return JSON.parse(JSON.stringify(a)) as SimpleAsset;
}

async function readList(key: string): Promise<AssetRecycleRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: AssetRecycleRecord[] = [];
    for (const x of parsed) {
      if (typeof x !== 'object' || x === null) continue;
      const o = x as Record<string, unknown>;
      const recordId =
        typeof o.recordId === 'string' && o.recordId.length > 0
          ? o.recordId
          : null;
      const at = typeof o.at === 'string' ? o.at : '';
      if (!recordId || !o.asset) continue;
      out.push({
        recordId,
        at: at || new Date().toISOString(),
        asset: ensureAsset(o.asset),
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function writeList(key: string, list: AssetRecycleRecord[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(list));
}

export async function getArchivedRecords(): Promise<AssetRecycleRecord[]> {
  return readList(ARCHIVED_KEY);
}

export async function getTrashRecords(): Promise<AssetRecycleRecord[]> {
  return readList(TRASH_KEY);
}

/** 清仓后归档：保存完整资产快照（含流水），并从主列表移除 */
export async function archiveAssetRecord(asset: SimpleAsset): Promise<void> {
  const list = await getArchivedRecords();
  const record: AssetRecycleRecord = {
    recordId: `arc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    asset: cloneAsset(asset),
    at: new Date().toISOString(),
  };
  list.unshift(record);
  await writeList(ARCHIVED_KEY, list.slice(0, MAX_ARCHIVED));
  await deleteAsset(asset.id);
}

/** 删除资产：写入最近删除，再从主列表移除 */
export async function moveAssetToTrash(id: string): Promise<void> {
  const assets = await getAssets();
  const asset = assets.find((a) => a.id === id);
  if (!asset) return;
  const trash = await getTrashRecords();
  trash.unshift({
    recordId: `del-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    asset: cloneAsset(asset),
    at: new Date().toISOString(),
  });
  await writeList(TRASH_KEY, trash.slice(0, MAX_TRASH));
  await deleteAsset(id);
}

/** 将快照恢复到主资产列表；若 id 已存在则分配新 id */
export async function restoreAssetToMain(asset: SimpleAsset): Promise<void> {
  let next = ensureAsset(asset);
  const all = await getAssets();
  if (all.some((x) => x.id === next.id)) {
    next = { ...next, id: generateAssetId() };
  }
  await addAsset(next);
}

export async function restoreFromArchived(recordId: string): Promise<void> {
  const list = await getArchivedRecords();
  const idx = list.findIndex((r) => r.recordId === recordId);
  if (idx < 0) throw new Error('记录不存在');
  const [rec] = list.splice(idx, 1);
  await writeList(ARCHIVED_KEY, list);
  await restoreAssetToMain(rec.asset);
}

export async function restoreFromTrash(recordId: string): Promise<void> {
  const list = await getTrashRecords();
  const idx = list.findIndex((r) => r.recordId === recordId);
  if (idx < 0) throw new Error('记录不存在');
  const [rec] = list.splice(idx, 1);
  await writeList(TRASH_KEY, list);
  await restoreAssetToMain(rec.asset);
}

/** 从归档或回收站永久移除（不恢复） */
export async function purgeArchivedRecord(recordId: string): Promise<void> {
  const list = (await getArchivedRecords()).filter((r) => r.recordId !== recordId);
  await writeList(ARCHIVED_KEY, list);
}

export async function purgeTrashRecord(recordId: string): Promise<void> {
  const list = (await getTrashRecords()).filter((r) => r.recordId !== recordId);
  await writeList(TRASH_KEY, list);
}

export function formatRecycleTransactionSummary(a: SimpleAsset): string {
  const nT = a.tradeHistory?.length ?? 0;
  const nC = a.cashLedger?.length ?? 0;
  const parts: string[] = [];
  if (nT > 0) parts.push(`交易流水 ${nT} 条`);
  if (nC > 0) parts.push(`余额流水 ${nC} 条`);
  if (parts.length === 0) return '无流水记录';
  return parts.join(' · ');
}
