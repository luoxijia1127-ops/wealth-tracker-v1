import { describe, expect, it } from 'vitest';
import {
  appendCashMovement,
  deleteCashLedgerEntry,
  replayCashLedger,
  updateCashLedgerEntry,
  usesCashAmountLedger,
} from './cash-ledger';
import type { CashLedgerEntry, SimpleAsset } from '@/types/asset';

function makeCashAsset(
  overrides: Partial<SimpleAsset> = {}
): SimpleAsset {
  return {
    id: 'cash-1',
    category: 'Cash',
    name: '现金',
    value: 0,
    currency: 'CNY',
    updatedAt: 0,
    ...overrides,
  } as SimpleAsset;
}

describe('usesCashAmountLedger', () => {
  it('treats Cash / Custom as balance ledger', () => {
    expect(usesCashAmountLedger(makeCashAsset({ category: 'Cash' }))).toBe(true);
    expect(usesCashAmountLedger(makeCashAsset({ category: 'Custom' }))).toBe(
      true
    );
  });

  it('treats other categories as trade ledger', () => {
    expect(usesCashAmountLedger(makeCashAsset({ category: 'Stock' }))).toBe(
      false
    );
  });
});

describe('replayCashLedger', () => {
  it('sums in / out sequentially and returns final balance', () => {
    const entries: CashLedgerEntry[] = [
      { id: 'a', entryDate: '2026-04-10', side: 'in', amount: 100 },
      { id: 'b', entryDate: '2026-04-11', side: 'out', amount: 30 },
      { id: 'c', entryDate: '2026-04-12', side: 'in', amount: 50 },
    ];
    expect(replayCashLedger(entries).balance).toBeCloseTo(120);
  });

  it('reports error when an entry would overdraw the balance', () => {
    const entries: CashLedgerEntry[] = [
      { id: 'a', entryDate: '2026-04-10', side: 'in', amount: 10 },
      { id: 'b', entryDate: '2026-04-11', side: 'out', amount: 20 },
    ];
    const r = replayCashLedger(entries);
    expect(r.error).toBeTruthy();
    expect(r.balance).toBeCloseTo(10);
  });

  it('flags non-positive amounts as invalid', () => {
    const entries: CashLedgerEntry[] = [
      { id: 'a', entryDate: '2026-04-10', side: 'in', amount: 0 },
    ];
    expect(replayCashLedger(entries).error).toBeTruthy();
  });
});

describe('appendCashMovement / update / delete', () => {
  it('appends a movement and recalculates balance', () => {
    const a = makeCashAsset({ value: 200 });
    const next = appendCashMovement(a, 'in', 50, '2026-04-15');
    expect(next.value).toBeCloseTo(250);
    expect((next.cashLedger ?? []).length).toBe(2);
  });

  it('updates an entry to change the balance consistently', () => {
    const a = makeCashAsset({ value: 100 });
    const withEntry = appendCashMovement(a, 'in', 50, '2026-04-15');
    const firstId = (withEntry.cashLedger ?? [])[0]!.id;
    const patched = updateCashLedgerEntry(withEntry, firstId, { amount: 80 });
    expect(patched.value).toBeCloseTo(130);
  });

  it('deletes the last ledger entry and resets value to 0 when empty', () => {
    const a = makeCashAsset({ value: 0 });
    const withEntry = appendCashMovement(a, 'in', 50, '2026-04-15');
    const id = (withEntry.cashLedger ?? [])[0]!.id;
    const deleted = deleteCashLedgerEntry(withEntry, id);
    expect(deleted.cashLedger).toBeUndefined();
    expect(deleted.value).toBe(0);
  });
});
