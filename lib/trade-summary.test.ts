import { describe, expect, it } from 'vitest';
import { isSignificantTradeSummaryDay } from '@/lib/trade-summary';

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
