/**
 * 已归档（清仓记录）与最近删除：独立 AsyncStorage 列表，支持恢复。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { canAddAnotherAsset } from '@/lib/asset-limit';
import { addAsset, deleteAsset, getAssets } from '@/lib/asset-storage';
import { FREE_ASSET_LIMIT } from '@/lib/subscription-constants';
import { applyRestoredAssetSnapshotAdjustments } from '@/lib/snapshot-restore-adjust';
import {
  computeClosedCycleRealizedPnlSeries,
  computeSellRealizedPnlByTradeId,
} from '@/lib/trade-ledger';
import { ensureAsset, generateAssetId, type SimpleAsset } from '@/types/asset';

const ARCHIVED_KEY = '@nest/archived-assets-v1';
const TRASH_KEY = '@nest/deleted-assets-v1';
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

/** 将快照恢复到主资产列表；若 id 已存在则分配新 id；返回实际落库的资产 */
export async function restoreAssetToMain(asset: SimpleAsset): Promise<SimpleAsset> {
  const gate = await canAddAnotherAsset();
  if (!gate.allowed) {
    throw new Error(
      `免费版主列表最多 ${FREE_ASSET_LIMIT} 个资产。请先订阅或删除部分资产后再恢复。`
    );
  }
  let next = ensureAsset(asset);
  const all = await getAssets();
  if (all.some((x) => x.id === next.id)) {
    next = { ...next, id: generateAssetId() };
  }
  await addAsset(next);
  return next;
}

export async function restoreFromArchived(recordId: string): Promise<void> {
  const list = await getArchivedRecords();
  const idx = list.findIndex((r) => r.recordId === recordId);
  if (idx < 0) throw new Error('记录不存在');
  const [rec] = list.splice(idx, 1);
  await writeList(ARCHIVED_KEY, list);
  const restored = await restoreAssetToMain(rec.asset);
  await applyRestoredAssetSnapshotAdjustments(restored, rec.at);
}

export async function restoreFromTrash(recordId: string): Promise<void> {
  const list = await getTrashRecords();
  const idx = list.findIndex((r) => r.recordId === recordId);
  if (idx < 0) throw new Error('记录不存在');
  const [rec] = list.splice(idx, 1);
  await writeList(TRASH_KEY, list);
  const restored = await restoreAssetToMain(rec.asset);
  await applyRestoredAssetSnapshotAdjustments(restored, rec.at);
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

/** 表格窄列：交易/余额条数 */
export function formatRecycleTransactionSummaryShort(a: SimpleAsset): string {
  const nT = a.tradeHistory?.length ?? 0;
  const nC = a.cashLedger?.length ?? 0;
  if (nT === 0 && nC === 0) return '—';
  return `${nT}交/${nC}余`;
}

/** 已归档表格一行：可同一归档快照拆成多段（多次建仓—清仓）。 */
export type ArchivedDisplayRow = {
  key: string;
  record: AssetRecycleRecord;
  /** 展示用名称，多段时带「（第n段）」 */
  nameDisplay: string;
  /** 人民币计已实现盈亏；无场内流水等无法计算时为 null */
  realizedPnlCny: number | null;
};

/**
 * 将归档记录展开为表格行：有交易流水时按「清仓周期」拆分；同一条归档里两段持仓显示两行。
 */
export function buildArchivedDisplayRows(
  records: AssetRecycleRecord[]
): ArchivedDisplayRow[] {
  const out: ArchivedDisplayRow[] = [];
  for (const rec of records) {
    const a = rec.asset;
    const trades = a.tradeHistory;
    if (!trades || trades.length === 0) {
      out.push({
        key: rec.recordId,
        record: rec,
        nameDisplay: a.name,
        realizedPnlCny: null,
      });
      continue;
    }
    const cycles = computeClosedCycleRealizedPnlSeries(trades);
    if (cycles.length > 1) {
      cycles.forEach((pnl, i) => {
        out.push({
          key: `${rec.recordId}-c${i}`,
          record: rec,
          nameDisplay: `${a.name}（第${i + 1}段）`,
          realizedPnlCny: pnl,
        });
      });
      continue;
    }
    if (cycles.length === 1) {
      out.push({
        key: rec.recordId,
        record: rec,
        nameDisplay: a.name,
        realizedPnlCny: cycles[0]!,
      });
      continue;
    }
    const bySell = computeSellRealizedPnlByTradeId(trades);
    let sum = 0;
    for (const v of bySell.values()) sum += v;
    out.push({
      key: rec.recordId,
      record: rec,
      nameDisplay: a.name,
      realizedPnlCny: bySell.size > 0 ? sum : null,
    });
  }
  return out;
}
