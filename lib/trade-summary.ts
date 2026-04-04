import type { AssetDailySnapshot } from '@/lib/asset-daily-snapshots';
import type { FxUsdMidRates } from '@/lib/fx-rates';
import { convertDisplayValueToCny } from '@/lib/fx-rates';
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
      /** 与现金账户成对划转（买入扣款/卖出回款），主列表可隐藏 */
      internalTransfer?: boolean;
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
  /** 外部净流入（增加 - 减少） */
  externalNetFlow: number;
  /** 净值变动 - 外部净流入（可理解为市场涨跌/估值变化/其它） */
  residual: number | null;
  /** 残差拆解：逐资产快照可解释合计（折人民币，含新进/清仓） */
  residualMarketExplained: number | null;
  /** 两日均有该资产时的市值变动合计（折人民币） */
  attributionHeld?: number | null;
  /** 仅新进或仅清仓资产的市值变动合计（折人民币） */
  attributionOpenClose?: number | null;
  /** 残差拆解：仍无法对齐部分（舍入、汇率时点、现金外币流水等） */
  residualUnexplained: number | null;
  /** 残差拆解：按类别汇总的市场贡献 */
  marketByCategory?: Record<AssetCategory, number>;
  /** 残差拆解：贡献最大的资产（按绝对值排序，取前 N） */
  topMarketMovers?: MarketMoverEntry[];
  /** 当日全部逐资产市值变动（|delta| 降序）；明细页用 */
  marketMovers?: MarketMoverEntry[];

  lines: DailyTradeLine[];
};

/** 市值贡献行：delta 为折人民币变动；dailyReturnPct 为当日收益率(%)，清仓/新进时为 null */
export type MarketMoverEntry = {
  assetName: string;
  delta: number;
  category: AssetCategory;
  /** 当日收益率（%），分母为上一日该资产折人民币市值；清仓、新进为 null */
  dailyReturnPct: number | null;
  /** 上一日有持仓、当日已无（清仓） */
  liquidated: boolean;
  /** 上一日无、当日新进 */
  opened: boolean;
};

function safeNum(x: unknown): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : 0;
}

/** 快照项折人民币；无汇率时非人民币资产仍用原数值（与旧行为兼容，偏差进口径差） */
function snapshotItemCny(
  value: number,
  currency: string,
  usdRates: FxUsdMidRates['rates'] | null | undefined
): number {
  if (!Number.isFinite(value)) return 0;
  const code = /^[A-Z]{3}$/.test(currency) ? currency : 'CNY';
  if (usdRates && usdRates.CNY > 0) {
    return convertDisplayValueToCny(value, code, usdRates);
  }
  return value;
}

export type BuildDailyTradeSummariesOptions = {
  /**
   * 为 true（默认）时仅保留净值/外部流/残差至少一项较显著的日期；
   * 为 false 时返回全部有流水或快照的日期，供收益日历等按日查询。
   */
  filterInsignificant?: boolean;
};

export function buildDailyTradeSummaries(
  params: {
    assets: SimpleAsset[];
    snapshots: Snapshot[];
    assetDailySnapshots?: AssetDailySnapshot[];
    /** 有则逐资产与总净值快照同为「折人民币」口径，并包含跨币种持仓变动与新进/清仓 */
    usdRates?: FxUsdMidRates['rates'] | null;
    /**
     * 按快照「上海日」取当日所用汇率表；与 `usdRates` 配合：解析不到时退回 `usdRates`。
     * 有历史时应对「当日市值用当日 R、前一日市值用前一日 R」，与 totalValueCny 口径一致。
     */
    resolveFxRates?: (shanghaiDate: string) => FxUsdMidRates['rates'] | null;
  },
  options?: BuildDailyTradeSummariesOptions
): DailyTradeSummary[] {
  const { assets, snapshots, assetDailySnapshots, usdRates, resolveFxRates } =
    params;
  const filterInsignificant = options?.filterInsignificant ?? true;

  const pickRatesForDay = (shanghaiDate: string): FxUsdMidRates['rates'] | null => {
    const r = resolveFxRates?.(shanghaiDate);
    if (r && r.CNY > 0) return r;
    if (usdRates && usdRates.CNY > 0) return usdRates;
    return null;
  };

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
      const internalTransfer = !!(
        (typeof t.transferId === 'string' && t.transferId.trim().length > 0) ||
        t.fundingSourceAssetId ||
        (typeof t.fundingSourceAssetName === 'string' &&
          t.fundingSourceAssetName.trim().length > 0) ||
        t.cashDestinationAssetId ||
        (typeof t.cashDestinationAssetName === 'string' &&
          t.cashDestinationAssetName.trim().length > 0)
      );
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
        internalTransfer,
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
        Custom: 0,
      };
      const movers: MarketMoverEntry[] = [];

      let heldSum = 0;
      let openCloseSum = 0;

      const allIds = new Set<string>([...curMap.keys(), ...prevMap.keys()]);
      for (const id of allIds) {
        const c = curMap.get(id);
        const p = prevMap.get(id);

        if (c && p) {
          let delta: number;
          const ratesCur = pickRatesForDay(day);
          const ratesPrev = pickRatesForDay(prev);
          if (ratesCur && ratesPrev) {
            delta =
              snapshotItemCny(c.value ?? 0, c.currency, ratesCur) -
              snapshotItemCny(p.value ?? 0, p.currency, ratesPrev);
          } else if (usdRates && usdRates.CNY > 0) {
            delta =
              snapshotItemCny(c.value ?? 0, c.currency, usdRates) -
              snapshotItemCny(p.value ?? 0, p.currency, usdRates);
          } else if (c.currency === p.currency) {
            delta = (c.value ?? 0) - (p.value ?? 0);
          } else {
            continue;
          }
          m[c.category] = (m[c.category] ?? 0) + delta;
          heldSum += delta;
          let dailyReturnPct: number | null = null;
          if (ratesCur && ratesPrev) {
            const prevCny = snapshotItemCny(p.value ?? 0, p.currency, ratesPrev);
            if (Math.abs(prevCny) > 1e-9) {
              dailyReturnPct = (delta / prevCny) * 100;
            }
          } else if (usdRates && usdRates.CNY > 0) {
            const prevCny = snapshotItemCny(p.value ?? 0, p.currency, usdRates);
            if (Math.abs(prevCny) > 1e-9) {
              dailyReturnPct = (delta / prevCny) * 100;
            }
          } else if (c.currency === p.currency) {
            const prevCny = p.value ?? 0;
            if (Math.abs(prevCny) > 1e-9) {
              dailyReturnPct = (delta / prevCny) * 100;
            }
          }
          movers.push({
            assetName: c.name,
            delta,
            category: c.category,
            dailyReturnPct,
            liquidated: false,
            opened: false,
          });
          continue;
        }

        if (c && !p) {
          const v = snapshotItemCny(c.value ?? 0, c.currency, pickRatesForDay(day));
          const delta = v;
          m[c.category] = (m[c.category] ?? 0) + delta;
          openCloseSum += delta;
          movers.push({
            assetName: c.name,
            delta,
            category: c.category,
            dailyReturnPct: null,
            liquidated: false,
            opened: true,
          });
          continue;
        }

        if (!c && p) {
          const v = snapshotItemCny(p.value ?? 0, p.currency, pickRatesForDay(prev));
          const delta = -v;
          m[p.category] = (m[p.category] ?? 0) + delta;
          openCloseSum += delta;
          movers.push({
            assetName: p.name,
            delta,
            category: p.category,
            dailyReturnPct: null,
            liquidated: true,
            opened: false,
          });
        }
      }

      movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
      const explained = heldSum + openCloseSum;
      const row = byDate.get(day);
      if (!row) continue;
      row.marketByCategory = m;
      row.marketMovers = movers;
      row.topMarketMovers = movers.slice(0, 5);
      row.attributionHeld = row.residual !== null ? heldSum : null;
      row.attributionOpenClose = row.residual !== null ? openCloseSum : null;
      row.residualMarketExplained =
        row.residual !== null ? explained : null;
      row.residualUnexplained =
        row.residual !== null ? row.residual - explained : null;
    }
  }

  const all = [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
  return filterInsignificant ? all.filter(isSignificantTradeSummaryDay) : all;
}

/** 当日净值变动、外部现金流、或残差任一有显著变化才展示（过滤「几乎为 0」的日期） */
export function isSignificantTradeSummaryDay(d: DailyTradeSummary): boolean {
  const eps = 0.5;
  if (typeof d.snapshotDiff === 'number' && Math.abs(d.snapshotDiff) >= eps) {
    return true;
  }
  if (Math.abs(d.externalNetFlow) >= eps) return true;
  if (d.residual !== null && Math.abs(d.residual) >= eps) return true;
  return false;
}

/** 主列表展示的流水：排除内部划转；现金仅保留外部增加/减少 */
export function filterTradeLinesForDisplay(lines: DailyTradeLine[]): DailyTradeLine[] {
  return lines.filter((x) => {
    if (x.kind === 'cash') return !x.internal;
    return !x.internalTransfer;
  });
}

/** 内部划转流水（可折叠） */
export function filterInternalTradeLines(lines: DailyTradeLine[]): DailyTradeLine[] {
  return lines.filter((x) => {
    if (x.kind === 'cash') return x.internal;
    return !!x.internalTransfer;
  });
}

