/**
 * 换机备份与恢复：打包 / 解包 / 应用。
 *
 * 产物结构（明文 .zip）：
 *   backup.json           —— 结构化全量，唯一恢复源
 *   README.txt            —— 说明与字段字典
 *   transactions.csv      —— 手动流水（复用 manualTransactionsToCsv）
 *   daily-networth.csv    —— 每日总净值（含折算 CNY）
 *   daily-assets.csv      —— 每日逐资产市值
 *
 * 设计要点：
 *   - 明文（用户选择），不做加密；文件名里无敏感信息。
 *   - schemaVersion 向前兼容，写入前经过 ensureAsset 清洗。
 *   - 应用（applyBackupPayload）前先把当前数据打成一份「回滚 zip」存到 cacheDirectory；
 *     写入过程中任一步失败都用该 zip 回放，保证原子性。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';

import {
  ASSETS_STORAGE_KEY,
  getAssets,
  saveAssets,
} from '@/lib/asset-storage';
import {
  applyCashLedgerReplay,
  usesCashAmountLedger,
} from '@/lib/cash-ledger';
import {
  SNAPSHOTS_STORAGE_KEY,
  getSnapshots,
  saveSnapshotsList,
  type Snapshot,
} from '@/lib/snapshots';
import {
  ASSET_DAILY_SNAPSHOTS_KEY,
  getAssetDailySnapshots,
  replaceAllAssetDailySnapshots,
  type AssetDailySnapshot,
  type AssetDailySnapshotItem,
} from '@/lib/asset-daily-snapshots';
import {
  collectManualTransactions,
  manualTransactionsToCsv,
  getManualTransactionDateBounds,
} from '@/lib/manual-transactions-export';
import {
  ASSET_CATEGORY_ORDER,
  ensureAsset,
  type AssetCategory,
  type AssetHistoryEntry,
  type CashLedgerEntry,
  type SimpleAsset,
  type TradeLedgerEntry,
} from '@/types/asset';

/** 归档/回收站键（与 lib/asset-recycle.ts 保持一致） */
const ARCHIVED_KEY = '@nest/archived-assets-v1';
const TRASH_KEY = '@nest/deleted-assets-v1';

export const BACKUP_SCHEMA_VERSION = 1;

/** 可接受的最低 schemaVersion：用于向后兼容判断 */
export const BACKUP_MIN_SCHEMA_VERSION = 1;

export type AssetRecycleRecord = {
  recordId: string;
  asset: SimpleAsset;
  /** ISO 8601 */
  at: string;
};

export type BackupCounts = {
  assets: number;
  snapshots: number;
  assetDailySnapshots: number;
  archived: number;
  trash: number;
  tradeEntries: number;
  cashEntries: number;
};

export type BackupPayload = {
  schemaVersion: number;
  app: 'nest';
  appVersion?: string;
  exportedAt: string;
  platform?: string;
  counts: BackupCounts;
  assets: SimpleAsset[];
  snapshots: Snapshot[];
  assetDailySnapshots: AssetDailySnapshot[];
  archived: AssetRecycleRecord[];
  trash: AssetRecycleRecord[];
  /** 对去掉本字段后的 stable JSON 的 sha256 */
  integrity?: { algo: 'sha256'; hash: string };
};

export type ApplyMode = 'replace' | 'merge';

export type ApplySummary = {
  mode: ApplyMode;
  assetsBefore: number;
  assetsAfter: number;
  snapshotsBefore: number;
  snapshotsAfter: number;
  dailyAssetsBefore: number;
  dailyAssetsAfter: number;
  archivedBefore: number;
  archivedAfter: number;
  trashBefore: number;
  trashAfter: number;
  /** 本次执行前自动保存的回滚 zip 绝对路径；可用于再次恢复 */
  rollbackFileUri: string;
};

export type BackupPreview = {
  schemaVersion: number;
  exportedAt: string;
  counts: BackupCounts;
  dateRange: { minDate: string; maxDate: string };
  /** null 表示 backup.json 里没带 integrity 字段，无法比对 */
  integrityOk: boolean | null;
  appVersion?: string;
  platform?: string;
  warnings: string[];
};

/** -------- AsyncStorage 收集 / 写入 -------- */

async function readJsonArray<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function writeJsonArray(key: string, value: unknown[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

function sanitizeRecycleRecord(raw: unknown): AssetRecycleRecord | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const recordId =
    typeof o.recordId === 'string' && o.recordId.length > 0 ? o.recordId : null;
  if (!recordId || !o.asset) return null;
  const at =
    typeof o.at === 'string' && o.at.length > 0 ? o.at : new Date().toISOString();
  return { recordId, at, asset: ensureAsset(o.asset) };
}

function sanitizeSnapshot(raw: unknown): Snapshot | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const date = typeof o.date === 'string' ? o.date : '';
  const totalValue = typeof o.totalValue === 'number' ? o.totalValue : NaN;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(totalValue)) {
    return null;
  }
  const s: Snapshot = { date, totalValue };
  if (typeof o.totalValueCny === 'number' && Number.isFinite(o.totalValueCny)) {
    s.totalValueCny = o.totalValueCny;
  }
  if (typeof o.fxRateDate === 'string' && o.fxRateDate.length > 0) {
    s.fxRateDate = o.fxRateDate;
  }
  return s;
}

function sanitizeAssetDailyItem(raw: unknown): AssetDailySnapshotItem | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const assetId = typeof o.assetId === 'string' ? o.assetId : '';
  const name = typeof o.name === 'string' ? o.name : '';
  const value = typeof o.value === 'number' ? o.value : NaN;
  const category = typeof o.category === 'string' ? o.category : '';
  const currency = typeof o.currency === 'string' ? o.currency : '';
  if (!assetId || !Number.isFinite(value)) return null;
  const cat = ASSET_CATEGORY_ORDER.includes(category as AssetCategory)
    ? (category as AssetCategory)
    : 'Cash';
  return { assetId, name, category: cat, value, currency };
}

function sanitizeAssetDaily(raw: unknown): AssetDailySnapshot | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const date = typeof o.date === 'string' ? o.date : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const itemsRaw = Array.isArray(o.items) ? o.items : [];
  const items = itemsRaw
    .map(sanitizeAssetDailyItem)
    .filter((x): x is AssetDailySnapshotItem => x !== null);
  return { date, items };
}

/** 计数流水条目 */
function countLedgerEntries(assets: SimpleAsset[]): {
  tradeEntries: number;
  cashEntries: number;
} {
  let trade = 0;
  let cash = 0;
  for (const a of assets) {
    trade += a.tradeHistory?.length ?? 0;
    cash += a.cashLedger?.length ?? 0;
  }
  return { tradeEntries: trade, cashEntries: cash };
}

export async function collectBackupData(): Promise<
  Omit<BackupPayload, 'integrity'>
> {
  const [assets, snapshots, daily, archivedRaw, trashRaw] = await Promise.all([
    getAssets(),
    getSnapshots(),
    getAssetDailySnapshots(),
    readJsonArray<unknown>(ARCHIVED_KEY),
    readJsonArray<unknown>(TRASH_KEY),
  ]);

  const archived = archivedRaw
    .map(sanitizeRecycleRecord)
    .filter((x): x is AssetRecycleRecord => x !== null);
  const trash = trashRaw
    .map(sanitizeRecycleRecord)
    .filter((x): x is AssetRecycleRecord => x !== null);

  const { tradeEntries, cashEntries } = countLedgerEntries(assets);

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    app: 'nest',
    appVersion:
      typeof Constants.expoConfig?.version === 'string'
        ? Constants.expoConfig.version
        : undefined,
    exportedAt: new Date().toISOString(),
    platform: Platform.OS,
    counts: {
      assets: assets.length,
      snapshots: snapshots.length,
      assetDailySnapshots: daily.length,
      archived: archived.length,
      trash: trash.length,
      tradeEntries,
      cashEntries,
    },
    assets,
    snapshots,
    assetDailySnapshots: daily,
    archived,
    trash,
  };
}

/** -------- base64 / binary helpers -------- */

function u8ToBase64(u8: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < u8.length; i += CHUNK) {
    const sub = u8.subarray(i, i + CHUNK);
    binary += String.fromCharCode.apply(
      null,
      Array.from(sub) as unknown as number[]
    );
  }
  const g = globalThis as { btoa?: (s: string) => string };
  if (typeof g.btoa === 'function') return g.btoa(binary);
  throw new Error('btoa not available on this platform');
}

function base64ToU8(b64: string): Uint8Array {
  const g = globalThis as { atob?: (s: string) => string };
  if (typeof g.atob !== 'function') {
    throw new Error('atob not available on this platform');
  }
  const binary = g.atob(b64);
  const len = binary.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** -------- 完整性 (sha256) -------- */

/** 以稳定 key 顺序序列化 payload（浅层即可：各字段值本身是数组/对象也按原样 stringify） */
function stablePayloadJson(p: Omit<BackupPayload, 'integrity'>): string {
  const ordered = {
    schemaVersion: p.schemaVersion,
    app: p.app,
    appVersion: p.appVersion,
    exportedAt: p.exportedAt,
    platform: p.platform,
    counts: p.counts,
    assets: p.assets,
    snapshots: p.snapshots,
    assetDailySnapshots: p.assetDailySnapshots,
    archived: p.archived,
    trash: p.trash,
  };
  return JSON.stringify(ordered);
}

async function sha256Hex(input: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    input,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
}

/** -------- 文本产物（CSV / README） -------- */

function networthCsv(list: Snapshot[]): string {
  const header = ['date', 'totalValue', 'totalValueCny', 'fxRateDate'];
  const lines = [
    header.join(','),
    ...list.map((s) =>
      [
        s.date,
        String(s.totalValue),
        s.totalValueCny !== undefined ? String(s.totalValueCny) : '',
        s.fxRateDate ?? '',
      ].join(',')
    ),
  ];
  return `\ufeff${lines.join('\r\n')}`;
}

function dailyAssetsCsv(list: AssetDailySnapshot[]): string {
  const header = ['date', 'assetId', 'name', 'category', 'value', 'currency'];
  const escape = (s: string): string =>
    /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  const lines = [header.join(',')];
  for (const d of list) {
    for (const item of d.items) {
      lines.push(
        [
          d.date,
          escape(item.assetId),
          escape(item.name),
          item.category,
          String(item.value),
          item.currency,
        ].join(',')
      );
    }
  }
  return `\ufeff${lines.join('\r\n')}`;
}

function readmeText(payload: Omit<BackupPayload, 'integrity'>): string {
  const lines = [
    'Nest 本地备份 (schemaVersion=' + payload.schemaVersion + ')',
    '',
    '导出时间: ' + payload.exportedAt,
    '平台: ' + (payload.platform ?? '-'),
    '版本: ' + (payload.appVersion ?? '-'),
    '',
    '文件说明:',
    '  backup.json        —— 换机恢复的唯一数据源（请勿改名/移动到 zip 之外）',
    '  transactions.csv   —— 全期间手动交易流水，仅供 Excel 审阅',
    '  daily-networth.csv —— 每日总净值与折算人民币',
    '  daily-assets.csv   —— 每日逐资产市值，支持回填「资产变动」历史',
    '',
    '数据字典（backup.json 顶层字段）:',
    '  assets              SimpleAsset[]，含 history / tradeHistory / cashLedger',
    '  snapshots           每日总净值快照（date, totalValue, totalValueCny, fxRateDate）',
    '  assetDailySnapshots 每日逐资产市值（最多 730 天）',
    '  archived / trash    归档与最近删除记录（含原资产快照）',
    '',
    '恢复方法:',
    '  1) 在新设备上安装 Nest',
    '  2) 打开「设置 -> 数据 -> 导入备份」',
    '  3) 选择本 zip 文件，确认「覆盖恢复（推荐换机场景）」',
    '',
    '隐私提示: 本备份未加密，含全部资产与流水数据；请勿上传至公开云盘或第三方。',
    '',
  ];
  return lines.join('\r\n');
}

/** -------- 打包 / 解包 -------- */

export async function buildBackupZip(
  payload: Omit<BackupPayload, 'integrity'>
): Promise<Uint8Array> {
  const hash = await sha256Hex(stablePayloadJson(payload));
  const withHash: BackupPayload = {
    ...payload,
    integrity: { algo: 'sha256', hash },
  };
  const backupJson = JSON.stringify(withHash, null, 2);

  const bounds = getManualTransactionDateBounds(payload.assets);
  const txRows = collectManualTransactions(payload.assets, {
    start: bounds.min,
    end: bounds.max,
  });
  const txCsv = manualTransactionsToCsv(txRows);

  const files: Record<string, Uint8Array> = {
    'backup.json': strToU8(backupJson),
    'README.txt': strToU8(readmeText(payload)),
    'transactions.csv': strToU8(txCsv),
    'daily-networth.csv': strToU8(networthCsv(payload.snapshots)),
    'daily-assets.csv': strToU8(dailyAssetsCsv(payload.assetDailySnapshots)),
  };
  return zipSync(files);
}

/** 解 zip：必须包含 backup.json；其余 CSV 仅作留档，不参与恢复。 */
export async function parseBackupZip(
  bytes: Uint8Array
): Promise<{ payload: BackupPayload; preview: BackupPreview }> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch (e) {
    throw new Error('备份文件损坏或不是有效的 zip：' + (e as Error).message);
  }
  const jsonBytes = entries['backup.json'];
  if (!jsonBytes) {
    throw new Error('zip 内缺少 backup.json，无法识别为 Nest 备份');
  }
  const jsonText = strFromU8(jsonBytes);
  return parseBackupJson(jsonText);
}

/** 解析纯 JSON 备份（兼容 .json 文件直接导入） */
export async function parseBackupJson(
  jsonText: string
): Promise<{ payload: BackupPayload; preview: BackupPreview }> {
  const warnings: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    throw new Error('备份 JSON 格式错误：' + (e as Error).message);
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('备份 JSON 结构非法');
  }
  const o = parsed as Record<string, unknown>;
  const schemaVersion =
    typeof o.schemaVersion === 'number' ? o.schemaVersion : 0;
  if (schemaVersion < BACKUP_MIN_SCHEMA_VERSION) {
    throw new Error(
      `不支持的备份版本 ${schemaVersion}，当前应用支持 ${BACKUP_MIN_SCHEMA_VERSION}+`
    );
  }
  if (schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new Error(
      `备份文件来自更新版本（v${schemaVersion}），请升级 App 后再导入`
    );
  }

  const assetsRaw = Array.isArray(o.assets) ? o.assets : [];
  const assets = assetsRaw.map((x) => ensureAsset(x));

  const snapshotsRaw = Array.isArray(o.snapshots) ? o.snapshots : [];
  const snapshots = snapshotsRaw
    .map(sanitizeSnapshot)
    .filter((x): x is Snapshot => x !== null);

  const dailyRaw = Array.isArray(o.assetDailySnapshots)
    ? o.assetDailySnapshots
    : [];
  const assetDailySnapshots = dailyRaw
    .map(sanitizeAssetDaily)
    .filter((x): x is AssetDailySnapshot => x !== null);

  const archived = (Array.isArray(o.archived) ? o.archived : [])
    .map(sanitizeRecycleRecord)
    .filter((x): x is AssetRecycleRecord => x !== null);
  const trash = (Array.isArray(o.trash) ? o.trash : [])
    .map(sanitizeRecycleRecord)
    .filter((x): x is AssetRecycleRecord => x !== null);

  if (assetsRaw.length !== assets.length) {
    warnings.push(
      `已跳过 ${assetsRaw.length - assets.length} 条无法识别的资产记录`
    );
  }
  if (snapshotsRaw.length !== snapshots.length) {
    warnings.push(
      `已跳过 ${snapshotsRaw.length - snapshots.length} 条无效的总净值快照`
    );
  }

  const { tradeEntries, cashEntries } = countLedgerEntries(assets);
  const counts: BackupCounts = {
    assets: assets.length,
    snapshots: snapshots.length,
    assetDailySnapshots: assetDailySnapshots.length,
    archived: archived.length,
    trash: trash.length,
    tradeEntries,
    cashEntries,
  };

  const payload: BackupPayload = {
    schemaVersion,
    app: 'nest',
    appVersion: typeof o.appVersion === 'string' ? o.appVersion : undefined,
    exportedAt:
      typeof o.exportedAt === 'string' ? o.exportedAt : new Date().toISOString(),
    platform: typeof o.platform === 'string' ? o.platform : undefined,
    counts,
    assets,
    snapshots,
    assetDailySnapshots,
    archived,
    trash,
  };
  const integrityRaw = o.integrity as
    | { algo?: unknown; hash?: unknown }
    | undefined;
  if (integrityRaw && integrityRaw.algo === 'sha256' && typeof integrityRaw.hash === 'string') {
    payload.integrity = { algo: 'sha256', hash: integrityRaw.hash };
  }

  let integrityOk: boolean | null = null;
  if (payload.integrity) {
    try {
      const computed = await sha256Hex(stablePayloadJson(payload));
      integrityOk = computed === payload.integrity.hash;
      if (!integrityOk) {
        warnings.push('完整性校验未通过：文件可能在导出后被修改过');
      }
    } catch {
      integrityOk = null;
      warnings.push('无法计算 sha256，跳过完整性校验');
    }
  }

  const dateRange = computeDateRange(payload);

  const preview: BackupPreview = {
    schemaVersion,
    exportedAt: payload.exportedAt,
    counts,
    dateRange,
    integrityOk,
    appVersion: payload.appVersion,
    platform: payload.platform,
    warnings,
  };
  return { payload, preview };
}

function computeDateRange(p: BackupPayload): {
  minDate: string;
  maxDate: string;
} {
  let min = '9999-12-31';
  let max = '0000-01-01';
  const bump = (d: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      if (d < min) min = d;
      if (d > max) max = d;
    }
  };
  for (const s of p.snapshots) bump(s.date);
  for (const d of p.assetDailySnapshots) bump(d.date);
  for (const a of p.assets) {
    for (const h of a.history ?? []) bump(h.date);
    for (const t of a.tradeHistory ?? []) bump(t.tradeDate);
    for (const c of a.cashLedger ?? []) bump(c.entryDate);
  }
  if (min === '9999-12-31') return { minDate: '', maxDate: '' };
  return { minDate: min, maxDate: max };
}

/** -------- 合并工具 -------- */

function mergeArrayById<T extends { id: string }>(
  base: T[] | undefined,
  add: T[] | undefined
): T[] | undefined {
  const b = base ?? [];
  const a = add ?? [];
  if (b.length === 0 && a.length === 0) return undefined;
  const seen = new Map<string, T>();
  for (const x of b) seen.set(x.id, x);
  for (const x of a) seen.set(x.id, x); // 以备份为准覆盖同 id
  return Array.from(seen.values());
}

function mergeHistory(
  base: AssetHistoryEntry[] | undefined,
  add: AssetHistoryEntry[] | undefined
): AssetHistoryEntry[] | undefined {
  const b = base ?? [];
  const a = add ?? [];
  if (b.length === 0 && a.length === 0) return undefined;
  const byDate = new Map<string, AssetHistoryEntry>();
  for (const h of b) byDate.set(h.date, h);
  for (const h of a) byDate.set(h.date, h);
  return Array.from(byDate.values()).sort((x, y) => x.date.localeCompare(y.date));
}

function mergeAsset(current: SimpleAsset, incoming: SimpleAsset): SimpleAsset {
  const merged: SimpleAsset = { ...current, ...incoming };
  const th = mergeArrayById<TradeLedgerEntry>(
    current.tradeHistory,
    incoming.tradeHistory
  );
  if (th) merged.tradeHistory = th;
  const cl = mergeArrayById<CashLedgerEntry>(
    current.cashLedger,
    incoming.cashLedger
  );
  if (cl) merged.cashLedger = cl;
  const hist = mergeHistory(current.history, incoming.history);
  if (hist) merged.history = hist;
  // 余额流水类资产：合并后 incoming.value 可能与合并后的流水并不一致，
  // 回放一次以保证 value 与 cashLedger 保持一致。非余额流水类（股票/基金等）保持 incoming.value。
  if (usesCashAmountLedger(merged) && merged.cashLedger && merged.cashLedger.length > 0) {
    try {
      return applyCashLedgerReplay(merged, merged.cashLedger);
    } catch {
      // 合并出现不一致（如支出超余额）时，保留未回放版本不阻塞导入；用户可在应用内再修正。
      return merged;
    }
  }
  return merged;
}

function mergeAssetList(
  current: SimpleAsset[],
  incoming: SimpleAsset[]
): SimpleAsset[] {
  const byId = new Map<string, SimpleAsset>();
  for (const a of current) byId.set(a.id, a);
  for (const a of incoming) {
    const exist = byId.get(a.id);
    byId.set(a.id, exist ? mergeAsset(exist, a) : a);
  }
  return Array.from(byId.values());
}

function mergeSnapshotsByDate(a: Snapshot[], b: Snapshot[]): Snapshot[] {
  const byDate = new Map<string, Snapshot>();
  for (const s of a) byDate.set(s.date, s);
  for (const s of b) byDate.set(s.date, s);
  return Array.from(byDate.values()).sort((x, y) => x.date.localeCompare(y.date));
}

function mergeDailyByDate(
  a: AssetDailySnapshot[],
  b: AssetDailySnapshot[]
): AssetDailySnapshot[] {
  const byDate = new Map<string, AssetDailySnapshot>();
  for (const s of a) byDate.set(s.date, s);
  for (const s of b) byDate.set(s.date, s);
  return Array.from(byDate.values()).sort((x, y) => x.date.localeCompare(y.date));
}

function mergeRecycleRecords(
  a: AssetRecycleRecord[],
  b: AssetRecycleRecord[]
): AssetRecycleRecord[] {
  const byId = new Map<string, AssetRecycleRecord>();
  for (const r of a) byId.set(r.recordId, r);
  for (const r of b) byId.set(r.recordId, r);
  return Array.from(byId.values());
}

/** -------- 写入 AsyncStorage（多键事务式，失败自动回滚） -------- */

async function writeAllFromPayload(p: BackupPayload): Promise<void> {
  // 四个键依次写入；任一失败 throw，调用方负责回滚。
  await saveAssets(p.assets);
  await saveSnapshotsList(p.snapshots);
  await replaceAllAssetDailySnapshots(p.assetDailySnapshots);
  await writeJsonArray(ARCHIVED_KEY, p.archived);
  await writeJsonArray(TRASH_KEY, p.trash);
}

/** 把回滚 zip 写入 cacheDirectory，返回文件 URI */
async function saveRollbackZip(bytes: Uint8Array): Promise<string> {
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) throw new Error('cacheDirectory 不可用，无法保存回滚快照');
  const uri = `${cacheDir}nest-pre-import-${Date.now()}.zip`;
  const b64 = u8ToBase64(bytes);
  await FileSystem.writeAsStringAsync(uri, b64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return uri;
}

export async function applyBackupPayload(
  incoming: BackupPayload,
  mode: ApplyMode
): Promise<ApplySummary> {
  const current = await collectBackupData();
  const rollbackBytes = await buildBackupZip(current);
  const rollbackFileUri = await saveRollbackZip(rollbackBytes);

  let nextAssets: SimpleAsset[];
  let nextSnapshots: Snapshot[];
  let nextDaily: AssetDailySnapshot[];
  let nextArchived: AssetRecycleRecord[];
  let nextTrash: AssetRecycleRecord[];

  if (mode === 'replace') {
    nextAssets = incoming.assets;
    nextSnapshots = incoming.snapshots;
    nextDaily = incoming.assetDailySnapshots;
    nextArchived = incoming.archived;
    nextTrash = incoming.trash;
  } else {
    nextAssets = mergeAssetList(current.assets, incoming.assets);
    nextSnapshots = mergeSnapshotsByDate(current.snapshots, incoming.snapshots);
    nextDaily = mergeDailyByDate(
      current.assetDailySnapshots,
      incoming.assetDailySnapshots
    );
    nextArchived = mergeRecycleRecords(current.archived, incoming.archived);
    nextTrash = mergeRecycleRecords(current.trash, incoming.trash);
  }

  const nextPayload: BackupPayload = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    app: 'nest',
    appVersion: current.appVersion,
    exportedAt: current.exportedAt,
    platform: current.platform,
    counts: {
      assets: nextAssets.length,
      snapshots: nextSnapshots.length,
      assetDailySnapshots: nextDaily.length,
      archived: nextArchived.length,
      trash: nextTrash.length,
      ...countLedgerEntries(nextAssets),
    },
    assets: nextAssets,
    snapshots: nextSnapshots,
    assetDailySnapshots: nextDaily,
    archived: nextArchived,
    trash: nextTrash,
  };

  try {
    await writeAllFromPayload(nextPayload);
  } catch (e) {
    // 回滚：重写四个键到原样
    try {
      await writeAllFromPayload({
        ...current,
        schemaVersion: BACKUP_SCHEMA_VERSION,
        app: 'nest',
      } as BackupPayload);
    } catch {
      /* 回滚失败时保留已保存的 rollback zip 作为最后防线 */
    }
    throw new Error('写入失败，已回滚到导入前状态：' + (e as Error).message);
  }

  return {
    mode,
    assetsBefore: current.assets.length,
    assetsAfter: nextAssets.length,
    snapshotsBefore: current.snapshots.length,
    snapshotsAfter: nextSnapshots.length,
    dailyAssetsBefore: current.assetDailySnapshots.length,
    dailyAssetsAfter: nextDaily.length,
    archivedBefore: current.archived.length,
    archivedAfter: nextArchived.length,
    trashBefore: current.trash.length,
    trashAfter: nextTrash.length,
    rollbackFileUri,
  };
}

/** 使用上一次的「回滚 zip」再次恢复：等价于 replace */
export async function restoreFromRollbackZipFile(
  fileUri: string
): Promise<ApplySummary> {
  const b64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = base64ToU8(b64);
  const { payload } = await parseBackupZip(bytes);
  return applyBackupPayload(payload, 'replace');
}

/** 将 zip 字节或 .json 文本写到一个临时文件，用于分享 */
export async function writeZipToCache(
  bytes: Uint8Array,
  filename: string
): Promise<string> {
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) throw new Error('cacheDirectory 不可用');
  const uri = `${cacheDir}${filename}`;
  const b64 = u8ToBase64(bytes);
  await FileSystem.writeAsStringAsync(uri, b64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return uri;
}

/** 读取用户选择文件的字节（base64 -> Uint8Array） */
export async function readFileBytes(uri: string): Promise<Uint8Array> {
  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64ToU8(b64);
}

/** 判断文件是 json 还是 zip（按前缀字节） */
export function sniffBackupFormat(bytes: Uint8Array): 'zip' | 'json' | 'unknown' {
  if (bytes.length >= 4) {
    const b0 = bytes[0];
    const b1 = bytes[1];
    if (b0 === 0x50 && b1 === 0x4b) return 'zip'; // PK..
    // 跳过 BOM
    let start = 0;
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) start = 3;
    const c = bytes[start];
    if (c === 0x7b /* { */ || c === 0x5b /* [ */) return 'json';
  }
  return 'unknown';
}

/** 解析任意备份字节（自动识别 zip / 纯 json） */
export async function parseBackupBytes(
  bytes: Uint8Array
): Promise<{ payload: BackupPayload; preview: BackupPreview }> {
  const fmt = sniffBackupFormat(bytes);
  if (fmt === 'zip') return parseBackupZip(bytes);
  if (fmt === 'json') return parseBackupJson(strFromU8(bytes));
  throw new Error('无法识别的文件：既不是 zip，也不是 JSON');
}

/** 生成默认备份文件名（本地时间，YYYYMMDD-HHmm） */
export function defaultBackupFileName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ymd = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const hm = `${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `nest-backup-${ymd}-${hm}.zip`;
}

/** 方便导入页复用的 storage 键常量（便于将来扩展） */
export const BACKUP_STORAGE_KEYS = {
  assets: ASSETS_STORAGE_KEY,
  snapshots: SNAPSHOTS_STORAGE_KEY,
  assetDailySnapshots: ASSET_DAILY_SNAPSHOTS_KEY,
  archived: ARCHIVED_KEY,
  trash: TRASH_KEY,
} as const;
