/**
 * 类现金的增加、减少流水（无单价），按时间回放得到当前余额 value。
 */

import { getShanghaiDateString } from '@/lib/date-shanghai';
import type { CashLedgerEntry, SimpleAsset } from '@/types/asset';

export function generateCashLedgerId(): string {
  return `cl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** 仅类现金使用余额流水；贵金属与股票/基金一致，走持仓与 tradeHistory */
export function usesCashAmountLedger(asset: SimpleAsset): boolean {
  return asset.category === 'Cash' || asset.category === 'Custom';
}

/** 推断/补全的期初余额流水，用于回放余额，不计入外部净流归因 */
export function isCashBaselineEntry(e: CashLedgerEntry): boolean {
  return e.id.startsWith('cash-baseline-');
}

export function ensureCashBaselineLedger(asset: SimpleAsset): CashLedgerEntry[] {
  const existing =
    asset.cashLedger && asset.cashLedger.length > 0
      ? asset.cashLedger.slice()
      : [];
  if (existing.length > 0) return existing;
  if (!usesCashAmountLedger(asset)) return [];
  const v =
    typeof asset.value === 'number' && !Number.isNaN(asset.value)
      ? asset.value
      : 0;
  if (!(v > 0)) return [];
  return [
    {
      id: `cash-baseline-${asset.id}`,
      entryDate: getShanghaiDateString(),
      side: 'in',
      amount: v,
    },
  ];
}

export type CashReplayResult = {
  balance: number;
  error?: string;
};

export function replayCashLedger(entries: CashLedgerEntry[]): CashReplayResult {
  const sorted = [...entries].sort((a, b) =>
    a.entryDate.localeCompare(b.entryDate) !== 0
      ? a.entryDate.localeCompare(b.entryDate)
      : a.id.localeCompare(b.id)
  );
  let v = 0;
  for (const e of sorted) {
    const amt = e.amount;
    if (!(amt > 0) || Number.isNaN(amt)) {
      return { balance: v, error: '流水中有无效金额' };
    }
    if (e.side === 'in') {
      v += amt;
    } else {
      if (amt > v + 1e-9) {
        return { balance: v, error: '支出超过当时余额' };
      }
      v -= amt;
    }
  }
  return { balance: v };
}

export function applyCashLedgerReplay(
  asset: SimpleAsset,
  history: CashLedgerEntry[]
): SimpleAsset {
  const r = replayCashLedger(history);
  if (r.error) {
    throw new Error(r.error);
  }
  const next: SimpleAsset = {
    ...asset,
    cashLedger: history.length > 0 ? history : undefined,
    value: r.balance,
  };
  if (r.balance <= 0 && history.length === 0) {
    next.value = 0;
  }
  return next;
}

export function appendCashMovement(
  asset: SimpleAsset,
  side: 'in' | 'out',
  amount: number,
  entryDate: string,
  meta?: Pick<
    CashLedgerEntry,
    'relatedAssetId' | 'relatedAssetName' | 'note' | 'transferId'
  >
): SimpleAsset {
  if (!(amount > 0) || Number.isNaN(amount)) {
    throw new Error('金额须为正数');
  }
  const base = ensureCashBaselineLedger(asset);
  const entry: CashLedgerEntry = {
    id: generateCashLedgerId(),
    entryDate,
    side,
    amount,
    ...(meta?.relatedAssetId ? { relatedAssetId: meta.relatedAssetId } : {}),
    ...(meta?.relatedAssetName ? { relatedAssetName: meta.relatedAssetName } : {}),
    ...(meta?.note ? { note: meta.note } : {}),
    ...(meta?.transferId ? { transferId: meta.transferId } : {}),
  };
  const history = [...base, entry];
  return applyCashLedgerReplay({ ...asset, cashLedger: history }, history);
}

export function updateCashLedgerEntry(
  asset: SimpleAsset,
  entryId: string,
  patch: Partial<
    Pick<
      CashLedgerEntry,
      | 'side'
      | 'amount'
      | 'entryDate'
      | 'relatedAssetId'
      | 'relatedAssetName'
      | 'note'
      | 'transferId'
    >
  >
): SimpleAsset {
  const raw = asset.cashLedger ?? [];
  const h = raw.map((e) =>
    e.id === entryId ? { ...e, ...patch } : e
  ) as CashLedgerEntry[];
  return applyCashLedgerReplay({ ...asset, cashLedger: h }, h);
}

export function deleteCashLedgerEntry(
  asset: SimpleAsset,
  entryId: string
): SimpleAsset {
  const h = (asset.cashLedger ?? []).filter((e) => e.id !== entryId);
  if (h.length === 0) {
    return {
      ...asset,
      cashLedger: undefined,
      value: 0,
    };
  }
  return applyCashLedgerReplay({ ...asset, cashLedger: h }, h);
}

/** 从所有类现金资产中移除指定 transferId 的一条流水（重绑资金来源前清理旧联动） */
export function stripCashTransferFromAssets(
  all: SimpleAsset[],
  transferId: string
): SimpleAsset[] {
  if (!transferId) return all;
  return all.map((a) => {
    const rows = a.cashLedger ?? [];
    const hit = rows.find((e) => e.transferId === transferId);
    if (!hit) return a;
    return deleteCashLedgerEntry(a, hit.id);
  });
}
