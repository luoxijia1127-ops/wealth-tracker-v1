import type { AssetDailySnapshot } from '@/lib/asset-daily-snapshots';
import type { Snapshot } from '@/lib/snapshots';
import type { AssetCategory, SimpleAsset } from '@/types/asset';

export type DailyTradeLine =
  | {
      kind: 'trade';
      date: string;
      assetId: string;
      assetName: string;
      side: 'buy' | 'sell';
      qty: number;
      unitPriceCny: number;
      amountCny: number;
      fundingSourceName?: string;
      transferId?: string;
    }
  | {
      kind: 'cash';
      date: string;
      assetId: string;
      assetName: string;
      side: 'in' | 'out';
      amount: number;
      note?: string;
      relatedAssetName?: string;
      transferId?: string;
      /** 是否内部划转（买入/加仓扣减等） */
      internal: boolean;
    };

export type DailyTradeSummary = {
  date: string;
  /** 当日快照总净值（未汇率折算直接相加口径） */
  snapshotTotal?: number;
  /** 相对上一条快照的变动 */
  snapshotDiff?: number;
  snapshotPct?: number;

  buyAmountCny: number;
  sellAmountCny: number;
  externalCashIn: number;
  externalCashOut: number;
  /** 外部净流入（入金 - 出金） */
  externalNetFlow: number;
  /** 净值变动 - 外部净流入（可理解为市场涨跌/估值变化/其它） */
  residual: number | null;
  /** 残差拆解：按资产市值快照可解释的“市场/估值变化” */
  residualMarketExplained: number | null;
  /** 残差拆解：无法解释部分（缺少资产快照等） */
  residualUnexplained: number | null;
  /** 残差拆解：按类别汇总的市场贡献 */
  marketByCategory?: Record<AssetCategory, number>;
  /** 残差拆解：贡献最大的资产（按绝对值排序，取前 N） */
  topMarketMovers?: { assetName: string; delta: number; category: AssetCategory }[];

  lines: DailyTradeLine[];
};

function safeNum(x: unknown): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : 0;
}

export function buildDailyTradeSummaries(params: {
  assets: SimpleAsset[];
  snapshots: Snapshot[];
  assetDailySnapshots?: AssetDailySnapshot[];
}): DailyTradeSummary[] {
  const { assets, snapshots, assetDailySnapshots } = params;

  const byDate = new Map<string, DailyTradeSummary>();
  const ensureDay = (date: string): DailyTradeSummary => {
    if (!byDate.has(date)) {
      byDate.set(date, {
        date,
        buyAmountCny: 0,
        sellAmountCny: 0,
        externalCashIn: 0,
        externalCashOut: 0,
        externalNetFlow: 0,
        residual: null,
        residualMarketExplained: null,
        residualUnexplained: null,
        lines: [],
      });
    }
    return byDate.get(date)!;
  };

  for (const a of assets) {
    const an = a.name || '(未命名)';
    const aid = a.id;

    const th = a.tradeHistory ?? [];
    for (const t of th) {
      const date = t.tradeDate;
      if (typeof date !== 'string' || date.length < 8) continue;
      const qty = safeNum(t.shares);
      const px = safeNum(t.unitPriceCny);
      if (!(qty > 0) || !(px >= 0)) continue;
      const amt = qty * px;
      const day = ensureDay(date);
      if (t.side === 'buy') day.buyAmountCny += amt;
      else day.sellAmountCny += amt;
      day.lines.push({
        kind: 'trade',
        date,
        assetId: aid,
        assetName: an,
        side: t.side,
        qty,
        unitPriceCny: px,
        amountCny: amt,
        fundingSourceName: t.fundingSourceAssetName,
        transferId: t.transferId,
      });
    }

    const cl = a.cashLedger ?? [];
    for (const e of cl) {
      const date = e.entryDate;
      if (typeof date !== 'string' || date.length < 8) continue;
      const amt = safeNum(e.amount);
      if (!(amt > 0)) continue;
      const internal = typeof e.transferId === 'string' && e.transferId.length > 0;
      const day = ensureDay(date);
      if (!internal) {
        if (e.side === 'in') day.externalCashIn += amt;
        else day.externalCashOut += amt;
      }
      day.lines.push({
        kind: 'cash',
        date,
        assetId: aid,
        assetName: an,
        side: e.side,
        amount: amt,
        note: e.note,
        relatedAssetName: e.relatedAssetName,
        transferId: e.transferId,
        internal,
      });
    }
  }

  const orderedSnaps = [...snapshots]
    .filter((s) => typeof s?.date === 'string' && typeof s?.totalValue === 'number')
    .sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 0; i < orderedSnaps.length; i++) {
    const s = orderedSnaps[i]!;
    const day = ensureDay(s.date);
    const total =
      typeof s.totalValueCny === 'number' && Number.isFinite(s.totalValueCny)
        ? s.totalValueCny
        : s.totalValue;
    day.snapshotTotal = total;
    if (i > 0) {
      const prev = orderedSnaps[i - 1]!;
      const prevTotal =
        typeof prev.totalValueCny === 'number' &&
        Number.isFinite(prev.totalValueCny)
          ? prev.totalValueCny
          : prev.totalValue;
      const diff = total - prevTotal;
      day.snapshotDiff = diff;
      day.snapshotPct =
        prevTotal !== 0 ? (diff / prevTotal) * 100 : 0;
    }
  }

  for (const d of byDate.values()) {
    d.externalNetFlow = d.externalCashIn - d.externalCashOut;
    d.residual =
      typeof d.snapshotDiff === 'number'
        ? d.snapshotDiff - d.externalNetFlow
        : null;
    d.lines.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'cash' ? 1 : -1;
      const idA = (a as any).transferId ?? '';
      const idB = (b as any).transferId ?? '';
      return String(idA).localeCompare(String(idB));
    });
  }

  // 用“每日资产市值快照”拆解残差为：市场可解释 + 未解释
  if (assetDailySnapshots && assetDailySnapshots.length > 0) {
    const snaps = [...assetDailySnapshots].sort((a, b) => a.date.localeCompare(b.date));
    const byDay = new Map(snaps.map((s) => [s.date, s] as const));
    const dates = [...byDate.keys()].sort((a, b) => a.localeCompare(b));
    for (let i = 1; i < dates.length; i++) {
      const day = dates[i]!;
      const prev = dates[i - 1]!;
      const curSnap = byDay.get(day);
      const prevSnap = byDay.get(prev);
      if (!curSnap || !prevSnap) continue;
      const curMap = new Map(curSnap.items.map((it) => [it.assetId, it] as const));
      const prevMap = new Map(prevSnap.items.map((it) => [it.assetId, it] as const));

      const m: Record<AssetCategory, number> = {
        Stock: 0,
        Fund: 0,
        ETF: 0,
        Cash: 0,
        Gold: 0,
      };
      const movers: { assetName: string; delta: number; category: AssetCategory }[] = [];

      const allIds = new Set<string>([...curMap.keys(), ...prevMap.keys()]);
      for (const id of allIds) {
        const c = curMap.get(id);
        const p = prevMap.get(id);
        if (!c || !p) continue;
        // 只在同币种时解释（目前快照口径是未折算直接相加；跨币种不强行解释）
        if (c.currency !== p.currency) continue;
        const delta = (c.value ?? 0) - (p.value ?? 0);
        m[c.category] = (m[c.category] ?? 0) + delta;
        movers.push({ assetName: c.name, delta, category: c.category });
      }

      movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
      const explained = Object.values(m).reduce((s, x) => s + x, 0);
      const row = byDate.get(day);
      if (!row) continue;
      row.marketByCategory = m;
      row.topMarketMovers = movers.slice(0, 5);
      row.residualMarketExplained =
        row.residual !== null ? explained : null;
      row.residualUnexplained =
        row.residual !== null ? row.residual - explained : null;
    }
  }

  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}

