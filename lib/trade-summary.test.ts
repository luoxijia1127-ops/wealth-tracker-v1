import { describe, expect, it } from 'vitest';
import { appendCashMovement } from '@/lib/cash-ledger';
import {
  buildDailyTradeSummaries,
  isSignificantTradeSummaryDay,
} from '@/lib/trade-summary';
import type { SimpleAsset } from '@/types/asset';

function makeCashAsset(overrides: Partial<SimpleAsset> = {}): SimpleAsset {
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

describe('buildDailyTradeSummaries cash baseline', () => {
  const tradeDate = '2026-05-24';

  it('counts only delta when first cash movement materializes baseline', () => {
    const asset = makeCashAsset({ value: 1000 });
    const updated = appendCashMovement(asset, 'in', 500, tradeDate);
    const summaries = buildDailyTradeSummaries(
      { assets: [updated], snapshots: [] },
      { filterInsignificant: false }
    );
    const day = summaries.find((s) => s.date === tradeDate);
    expect(day?.externalNetFlow).toBeCloseTo(500);
    expect(day?.lines.filter((l) => l.kind === 'cash')).toHaveLength(1);
  });

  it('counts negative delta when balance decreases from baseline', () => {
    const asset = makeCashAsset({ value: 1000 });
    const updated = appendCashMovement(asset, 'out', 200, tradeDate);
    const summaries = buildDailyTradeSummaries(
      { assets: [updated], snapshots: [] },
      { filterInsignificant: false }
    );
    const day = summaries.find((s) => s.date === tradeDate);
    expect(day?.externalNetFlow).toBeCloseTo(-200);
    expect(day?.lines.filter((l) => l.kind === 'cash')).toHaveLength(1);
  });

  it('counts full amount when no baseline exists (zero starting balance)', () => {
    const asset = makeCashAsset({ value: 0 });
    const updated = appendCashMovement(asset, 'in', 1500, tradeDate);
    const summaries = buildDailyTradeSummaries(
      { assets: [updated], snapshots: [] },
      { filterInsignificant: false }
    );
    const day = summaries.find((s) => s.date === tradeDate);
    expect(day?.externalNetFlow).toBeCloseTo(1500);
    expect(day?.lines.filter((l) => l.kind === 'cash')).toHaveLength(1);
  });
});

describe('isSignificantTradeSummaryDay', () => {
  it('returns false when all deltas are near zero', () => {
    expect(
      isSignificantTradeSummaryDay({
        date: '2025-01-01',
        buyAmountCny: 0,
        sellAmountCny: 0,
        externalCashIn: 0,
        externalCashOut: 0,
        externalNetFlow: 0,
        residual: 0,
        residualMarketExplained: null,
        residualUnexplained: null,
        lines: [],
      })
    ).toBe(false);
  });

  it('returns true when snapshot diff is material', () => {
    expect(
      isSignificantTradeSummaryDay({
        date: '2025-01-01',
        snapshotDiff: 10,
        buyAmountCny: 0,
        sellAmountCny: 0,
        externalCashIn: 0,
        externalCashOut: 0,
        externalNetFlow: 0,
        residual: 10,
        residualMarketExplained: null,
        residualUnexplained: null,
        lines: [],
      })
    ).toBe(true);
  });
});
