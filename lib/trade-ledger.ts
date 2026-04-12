/**
 * 场内加减仓流水：买卖份额+单价；编辑/删除流水后按时间顺序回放重算持仓与摊薄成本。
 */

import { getShanghaiDateString } from '@/lib/date-shanghai';
import { isHeldChineseAsset } from '@/lib/asset-value';
import {
  getListedUnitPrice,
  type SimpleAsset,
  type TradeLedgerEntry,
} from '@/types/asset';

export function generateTradeId(): string {
  return `tr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 无流水、需补「期初」买入时，建仓日不可用行情 lastCloseDate：
 * 该字段多为「上一交易日收盘」且全市场同类，会导致多只标的持有天数被算成同一天数（如均为 1 天）。
 * 优先用资产市值快照 history 的最早一日；否则用上海当日（表示仅有持仓、建仓日不可考）。
 */
export function pickListedSyntheticOpenDate(asset: SimpleAsset): string {
  const today = getShanghaiDateString();
  if (asset.history && asset.history.length > 0) {
    const sorted = [...asset.history].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const first = sorted[0]!.date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(first) && first <= today) {
      return first;
    }
  }
  return today;
}

/**
 * 若尚无流水但有持仓，补一条「期初」买入，便于与后续加减仓一并回放。
 */
export function ensureBaselineLedger(asset: SimpleAsset): TradeLedgerEntry[] {
  const existing =
    asset.tradeHistory && asset.tradeHistory.length > 0
      ? asset.tradeHistory.slice()
      : [];
  if (existing.length > 0) return existing;
  if (!isHeldChineseAsset(asset)) return [];
  const sh = asset.shares;
  if (typeof sh !== 'number' || sh <= 0) return [];
  const px =
    (typeof asset.avgCost === 'number' && asset.avgCost > 0
      ? asset.avgCost
      : null) ??
    getListedUnitPrice(asset) ??
    (typeof asset.lastClose === 'number' && asset.lastClose > 0
      ? asset.lastClose
      : null) ??
    0;
  if (!(px > 0)) return [];
  return [
    {
      id: `baseline-${asset.id}`,
      tradeDate: pickListedSyntheticOpenDate(asset),
      side: 'buy',
      shares: sh,
      unitPriceCny: px,
    },
  ];
}

export type ReplayResult = {
  shares: number;
  avgCost?: number;
  error?: string;
};

/**
 * 按摊薄成本逐笔计算「卖出」已实现盈亏（与 replay 一致）；用于交易明细展示。
 * 流水无效（如超卖）时自该笔起不再写入，已算出的仍保留。
 */
export function computeSellRealizedPnlByTradeId(
  trades: TradeLedgerEntry[]
): Map<string, number> {
  const out = new Map<string, number>();
  const sorted = [...trades].sort((a, b) =>
    a.tradeDate.localeCompare(b.tradeDate) !== 0
      ? a.tradeDate.localeCompare(b.tradeDate)
      : a.id.localeCompare(b.id)
  );
  let sh = 0;
  let totalCost = 0;
  for (const t of sorted) {
    const q = t.shares;
    const p = t.unitPriceCny;
    if (!(q > 0) || p < 0 || Number.isNaN(q) || Number.isNaN(p)) {
      break;
    }
    if (t.side === 'buy') {
      totalCost += q * p;
      sh += q;
    } else {
      if (sh <= 0 || q > sh + 1e-9) {
        break;
      }
      const avg = totalCost / sh;
      const realized = (p - avg) * q;
      out.set(t.id, realized);
      totalCost -= q * avg;
      sh -= q;
      if (totalCost < 0) totalCost = 0;
    }
  }
  return out;
}

/**
 * 按时间顺序回放，每经历一次「持仓从有到无」（清仓）累计该段内所有卖出的已实现盈亏，与明细里逐笔卖出盈亏之和一致。
 * 用于已归档列表：同一快照内多次建仓—清仓时拆成多行。
 */
export function computeClosedCycleRealizedPnlSeries(
  trades: TradeLedgerEntry[]
): number[] {
  const sorted = [...trades].sort((a, b) =>
    a.tradeDate.localeCompare(b.tradeDate) !== 0
      ? a.tradeDate.localeCompare(b.tradeDate)
      : a.id.localeCompare(b.id)
  );
  let sh = 0;
  let totalCost = 0;
  let cycleRealized = 0;
  const out: number[] = [];
  for (const t of sorted) {
    const q = t.shares;
    const p = t.unitPriceCny;
    if (!(q > 0) || p < 0 || Number.isNaN(q) || Number.isNaN(p)) {
      break;
    }
    if (t.side === 'buy') {
      totalCost += q * p;
      sh += q;
    } else {
      if (sh <= 0 || q > sh + 1e-9) {
        break;
      }
      const avg = totalCost / sh;
      const realized = (p - avg) * q;
      cycleRealized += realized;
      totalCost -= q * avg;
      sh -= q;
      if (totalCost < 0) totalCost = 0;
      if (sh <= 1e-9) {
        out.push(cycleRealized);
        cycleRealized = 0;
        sh = 0;
      }
    }
  }
  return out;
}

export function replayListedPosition(trades: TradeLedgerEntry[]): ReplayResult {
  const sorted = [...trades].sort((a, b) =>
    a.tradeDate.localeCompare(b.tradeDate) !== 0
      ? a.tradeDate.localeCompare(b.tradeDate)
      : a.id.localeCompare(b.id)
  );
  let sh = 0;
  let totalCost = 0;
  for (const t of sorted) {
    const q = t.shares;
    const p = t.unitPriceCny;
    if (!(q > 0) || p < 0 || Number.isNaN(q) || Number.isNaN(p)) {
      return { shares: sh, avgCost: avgFrom(sh, totalCost), error: '流水中有无效的份额或单价' };
    }
    if (t.side === 'buy') {
      totalCost += q * p;
      sh += q;
    } else {
      if (sh <= 0 || q > sh + 1e-9) {
        return {
          shares: sh,
          avgCost: avgFrom(sh, totalCost),
          error: '卖出份额超过当时持仓，请检查流水顺序与数量',
        };
      }
      const avg = totalCost / sh;
      totalCost -= q * avg;
      sh -= q;
      if (totalCost < 0) totalCost = 0;
    }
  }
  return { shares: sh, avgCost: avgFrom(sh, totalCost) };
}

function avgFrom(sh: number, totalCost: number): number | undefined {
  if (sh <= 0) return undefined;
  const a = totalCost / sh;
  return a > 0 ? a : undefined;
}

export function applyReplayToListedAsset(
  asset: SimpleAsset,
  history: TradeLedgerEntry[]
): SimpleAsset {
  const r = replayListedPosition(history);
  if (r.error) {
    throw new Error(r.error);
  }
  const next: SimpleAsset = {
    ...asset,
    tradeHistory: history.length > 0 ? history : undefined,
    shares: r.shares > 0 ? r.shares : undefined,
    avgCost: r.avgCost,
  };
  if (r.shares <= 0) {
    next.shares = undefined;
    next.avgCost = undefined;
    next.value = 0;
    return next;
  }
  const u = getListedUnitPrice(asset);
  if (u !== null) {
    next.value = r.shares * u;
  } else if (typeof asset.lastClose === 'number' && asset.lastClose > 0) {
    next.value = r.shares * asset.lastClose;
  } else {
    next.value = r.shares * (r.avgCost ?? 0);
  }
  return next;
}

/** 追加一笔加/减仓并回放（会必要时插入期初流水） */
export function appendListedTrade(
  asset: SimpleAsset,
  side: 'buy' | 'sell',
  qty: number,
  unitPriceCny: number,
  tradeDate: string,
  meta?: Pick<
    TradeLedgerEntry,
    | 'fundingSourceAssetId'
    | 'fundingSourceAssetName'
    | 'cashDestinationAssetId'
    | 'cashDestinationAssetName'
    | 'transferId'
  >
): SimpleAsset {
  const base = ensureBaselineLedger(asset);
  const entry: TradeLedgerEntry = {
    id: generateTradeId(),
    tradeDate,
    side,
    shares: qty,
    unitPriceCny,
    ...(meta?.fundingSourceAssetId
      ? { fundingSourceAssetId: meta.fundingSourceAssetId }
      : {}),
    ...(meta?.fundingSourceAssetName
      ? { fundingSourceAssetName: meta.fundingSourceAssetName }
      : {}),
    ...(meta?.cashDestinationAssetId
      ? { cashDestinationAssetId: meta.cashDestinationAssetId }
      : {}),
    ...(meta?.cashDestinationAssetName
      ? { cashDestinationAssetName: meta.cashDestinationAssetName }
      : {}),
    ...(meta?.transferId ? { transferId: meta.transferId } : {}),
  };
  const history = [...base, entry];
  return applyReplayToListedAsset(
    { ...asset, tradeHistory: history },
    history
  );
}

export function updateListedTradeEntry(
  asset: SimpleAsset,
  tradeId: string,
  patch: Partial<
    Pick<
      TradeLedgerEntry,
      | 'side'
      | 'shares'
      | 'unitPriceCny'
      | 'tradeDate'
      | 'fundingSourceAssetId'
      | 'fundingSourceAssetName'
      | 'cashDestinationAssetId'
      | 'cashDestinationAssetName'
      | 'transferId'
    >
  >
): SimpleAsset {
  const raw = asset.tradeHistory ?? [];
  const h = raw.map((t) =>
    t.id === tradeId ? { ...t, ...patch } : t
  ) as TradeLedgerEntry[];
  return applyReplayToListedAsset({ ...asset, tradeHistory: h }, h);
}

export function deleteListedTradeEntry(
  asset: SimpleAsset,
  tradeId: string
): SimpleAsset {
  const h = (asset.tradeHistory ?? []).filter((t) => t.id !== tradeId);
  if (h.length === 0) {
    return {
      ...asset,
      tradeHistory: undefined,
      shares: undefined,
      avgCost: undefined,
      value: 0,
    };
  }
  return applyReplayToListedAsset({ ...asset, tradeHistory: h }, h);
}
