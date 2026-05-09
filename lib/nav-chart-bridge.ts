/**
 * 「历史净值回补」：滞后录入的场内/贵金属仓位，用交易日至入库日之间的插值补全资产变动曲线。
 * - 回补段使用 smoothstep（缓入缓出），减轻末端陡增感。
 * - 合并后再按日历日线性加密数据点，避免快照稀疏时出现长直线。
 * - 仅作用于 Insights 图表展示序列，不修改持久化 snapshots，不影响今日盈亏。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  convertDisplayValueToCny,
  hasUsdAnchoredFxTable,
  type FxUsdMidRates,
} from '@/lib/fx-rates';
import { getAssetCurrency, getAssetDisplayValue } from '@/lib/asset-value';
import { snapshotDisplayTotal, type Snapshot } from '@/lib/snapshots';
import { isGoldAssetCategory, isListedAssetCategory, type SimpleAsset } from '@/types/asset';

export const NAV_CHART_BRIDGES_STORAGE_KEY = '@assetup/nav-chart-bridges-v1';

export type NavChartBridge = {
  id: string;
  assetId: string;
  /** 首笔建仓对应的交易日（上海 YYYY-MM-DD） */
  tradeYmd: string;
  /** 首次写入 App 并参与快照的上海日历日（通常为添加当日） */
  trackYmd: string;
  /** 建仓成本折合人民币（添加入库瞬间口径） */
  costCny: number;
  /** 入库跟踪日市值折合人民币（添加入库瞬间、同步前持仓市值口径） */
  valueAtTrackCny: number;
};

function parseYmd(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  return { y: +m[1]!, m: +m[2]!, d: +m[3]! };
}

/** a → b 的日历间隔天数（b - a）；非法返回 NaN */
export function calendarDaysDiff(aYmd: string, bYmd: string): number {
  const a = parseYmd(aYmd);
  const b = parseYmd(bYmd);
  if (!a || !b) return NaN;
  const t0 = Date.UTC(a.y, a.m - 1, a.d);
  const t1 = Date.UTC(b.y, b.m - 1, b.d);
  return Math.round((t1 - t0) / 86400000);
}

function addDaysYmd(ymd: string, delta: number): string | null {
  const p = parseYmd(ymd);
  if (!p) return null;
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d + delta));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** 0–1 平滑阶跃（两端切线水平），用于回补仓位随时间的过渡 */
function smoothstep01(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/**
 * 在相邻「结点」之间按日历日线性插值，填满 min→max 区间内每一天（用于图表折线更顺滑）。
 */
export function expandSnapshotsDailyLinear(sparseKnots: Snapshot[]): Snapshot[] {
  const sorted = [...sparseKnots].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return [];

  const minDate = sorted[0]!.date;
  const maxDate = sorted[sorted.length - 1]!.date;
  const out: Snapshot[] = [];

  let j = 0;
  for (let d = minDate; ; ) {
    while (j < sorted.length - 1 && sorted[j + 1]!.date <= d) {
      j += 1;
    }
    const lo = sorted[j]!;
    const hi =
      j + 1 < sorted.length ? sorted[j + 1]! : sorted[j]!;
    const vLo = snapshotTotalPreferCny(lo);
    const vHi = snapshotTotalPreferCny(hi);
    const span = calendarDaysDiff(lo.date, hi.date);
    let v: number;
    if (span <= 0 || lo.date === hi.date) {
      v = vLo;
    } else {
      const el = calendarDaysDiff(lo.date, d);
      const w = Math.min(1, Math.max(0, el / span));
      v = vLo + (vHi - vLo) * w;
    }
    out.push({ date: d, totalValue: v, totalValueCny: v });

    if (d >= maxDate) break;
    const nd = addDaysYmd(d, 1);
    if (!nd || nd > maxDate) break;
    d = nd;
  }

  return out;
}

function snapshotTotalPreferCny(s: Snapshot): number {
  if (
    typeof s.totalValueCny === 'number' &&
    Number.isFinite(s.totalValueCny)
  ) {
    return s.totalValueCny;
  }
  return snapshotDisplayTotal(s);
}

/** 日 d 上的净值底盘（若当日无快照则向前填充最近一条） */
function baseNavCnyOnDate(sortedAsc: Snapshot[], d: string): number {
  let last: Snapshot | null = null;
  for (const s of sortedAsc) {
    if (s.date > d) break;
    last = s;
  }
  return last ? snapshotTotalPreferCny(last) : 0;
}

function bridgeContributionOnDay(
  b: NavChartBridge,
  d: string,
  spanDays: number
): number {
  if (spanDays <= 0) return 0;
  if (d < b.tradeYmd || d >= b.trackYmd) return 0;
  const elapsed = calendarDaysDiff(b.tradeYmd, d);
  if (!Number.isFinite(elapsed) || elapsed < 0) return 0;
  const t = Math.min(1, elapsed / spanDays);
  const te = smoothstep01(t);
  return b.costCny + (b.valueAtTrackCny - b.costCny) * te;
}

/**
 * 合并快照与回补条，生成仅用于图表的「等价快照」序列（按 date 升序）。
 * 在 [tradeYmd, trackYmd) 内插入逐日插值点（含端点 trade），避免拉长区间仍只用直线连接两端。
 */
export function mergeSnapshotsWithNavBridgesForChart(
  orderedSnapshotsAsc: Snapshot[],
  bridges: NavChartBridge[]
): Snapshot[] {
  const snaps = [...orderedSnapshotsAsc].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const dateSet = new Set<string>();
  for (const s of snaps) dateSet.add(s.date);

  for (const b of bridges) {
    const span = calendarDaysDiff(b.tradeYmd, b.trackYmd);
    if (!Number.isFinite(span) || span <= 0) continue;
    for (let i = 0; i < span; i++) {
      const d = addDaysYmd(b.tradeYmd, i);
      if (d) dateSet.add(d);
    }
  }

  const dates = [...dateSet].sort((a, b) => a.localeCompare(b));
  const out: Snapshot[] = [];

  for (const d of dates) {
    const exact = snaps.find((s) => s.date === d);
    const base = exact ? snapshotTotalPreferCny(exact) : baseNavCnyOnDate(snaps, d);
    let extra = 0;
    for (const b of bridges) {
      const span = calendarDaysDiff(b.tradeYmd, b.trackYmd);
      if (!Number.isFinite(span) || span <= 0) continue;
      extra += bridgeContributionOnDay(b, d, span);
    }
    const totalCny = base + extra;
    out.push({
      date: d,
      totalValue: totalCny,
      totalValueCny: totalCny,
    });
  }

  return expandSnapshotsDailyLinear(out);
}

const bridgeListeners = new Set<(list: NavChartBridge[]) => void>();

export function subscribeNavChartBridges(
  listener: (list: NavChartBridge[]) => void
): () => void {
  bridgeListeners.add(listener);
  return () => {
    bridgeListeners.delete(listener);
  };
}

function notifyNavChartBridges(list: NavChartBridge[]): void {
  bridgeListeners.forEach((cb) => {
    try {
      cb(list);
    } catch {
      /* ignore */
    }
  });
}

export async function getNavChartBridges(): Promise<NavChartBridge[]> {
  try {
    const raw = await AsyncStorage.getItem(NAV_CHART_BRIDGES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: NavChartBridge[] = [];
    for (const x of parsed) {
      const b = sanitizeNavChartBridge(x);
      if (b) out.push(b);
    }
    return out;
  } catch {
    return [];
  }
}

export function sanitizeNavChartBridge(raw: unknown): NavChartBridge | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' && o.id.length > 0 ? o.id : null;
  const assetId =
    typeof o.assetId === 'string' && o.assetId.length > 0 ? o.assetId : null;
  const tradeYmd =
    typeof o.tradeYmd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.tradeYmd)
      ? o.tradeYmd
      : null;
  const trackYmd =
    typeof o.trackYmd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.trackYmd)
      ? o.trackYmd
      : null;
  const costCny = typeof o.costCny === 'number' ? o.costCny : NaN;
  const valueAtTrackCny =
    typeof o.valueAtTrackCny === 'number' ? o.valueAtTrackCny : NaN;
  if (
    !id ||
    !assetId ||
    !tradeYmd ||
    !trackYmd ||
    !Number.isFinite(costCny) ||
    !Number.isFinite(valueAtTrackCny)
  ) {
    return null;
  }
  return { id, assetId, tradeYmd, trackYmd, costCny, valueAtTrackCny };
}

export async function replaceAllNavChartBridges(
  list: NavChartBridge[]
): Promise<void> {
  await AsyncStorage.setItem(
    NAV_CHART_BRIDGES_STORAGE_KEY,
    JSON.stringify(list)
  );
  notifyNavChartBridges(list);
}

/** 新增资产成功后调用：若交易日早于入库日则写入一条回补记录 */
export async function tryAppendNavChartBridgeForNewAsset(
  asset: SimpleAsset,
  trackYmd: string,
  usdRates: FxUsdMidRates['rates'] | null
): Promise<void> {
  if (
    !isListedAssetCategory(asset.category) &&
    !isGoldAssetCategory(asset.category)
  ) {
    return;
  }
  const th = asset.tradeHistory;
  if (!th || th.length === 0) return;

  let tradeYmd = th[0]!.tradeDate;
  for (const e of th) {
    if (e.tradeDate < tradeYmd) tradeYmd = e.tradeDate;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tradeYmd)) return;
  if (tradeYmd >= trackYmd) return;

  const cur = getAssetCurrency(asset);
  if (cur !== 'CNY' && (!usdRates || !hasUsdAnchoredFxTable(usdRates))) {
    return;
  }

  const shares = typeof asset.shares === 'number' ? asset.shares : 0;
  const avg = typeof asset.avgCost === 'number' ? asset.avgCost : 0;
  if (!(shares > 0) || !(avg >= 0)) return;

  const costDisplay = shares * avg;
  const valueDisplay = getAssetDisplayValue(asset);
  const rates = usdRates ?? { USD: 1, CNY: 1 };
  const costCny = convertDisplayValueToCny(costDisplay, cur, rates);
  const valueAtTrackCny = convertDisplayValueToCny(valueDisplay, cur, rates);
  if (
    !Number.isFinite(costCny) ||
    !Number.isFinite(valueAtTrackCny)
  ) {
    return;
  }

  const id = `bridge-${asset.id}-${tradeYmd}`;
  const existing = await getNavChartBridges();
  const filtered = existing.filter((x) => x.id !== id && x.assetId !== asset.id);
  const next: NavChartBridge[] = [
    ...filtered,
    {
      id,
      assetId: asset.id,
      tradeYmd,
      trackYmd,
      costCny,
      valueAtTrackCny,
    },
  ];
  await replaceAllNavChartBridges(next);
}

export async function removeNavChartBridgesForAsset(
  assetId: string
): Promise<void> {
  const existing = await getNavChartBridges();
  const next = existing.filter((x) => x.assetId !== assetId);
  if (next.length === existing.length) return;
  await replaceAllNavChartBridges(next);
}

export function mergeNavChartBridgeLists(
  a: NavChartBridge[],
  b: NavChartBridge[]
): NavChartBridge[] {
  const byId = new Map<string, NavChartBridge>();
  for (const x of a) byId.set(x.id, x);
  for (const x of b) byId.set(x.id, x);
  return [...byId.values()].sort((x, y) => x.id.localeCompare(y.id));
}
