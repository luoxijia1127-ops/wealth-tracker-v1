import { describe, expect, it } from 'vitest';
import { replayListedPosition } from '@/lib/trade-ledger';

describe('replayListedPosition', () => {
  it('aggregates buys into avg cost', () => {
    const r = replayListedPosition([
      {
        id: '1',
        tradeDate: '2025-01-01',
        side: 'buy',
        shares: 10,
        unitPriceCny: 100,
      },
    ]);
    expect(r.error).toBeUndefined();
    expect(r.shares).toBe(10);
    expect(r.avgCost).toBe(100);
  });

  it('rejects oversell', () => {
    const r = replayListedPosition([
      {
        id: '1',
        tradeDate: '2025-01-01',
        side: 'sell',
        shares: 10,
        unitPriceCny: 100,
      },
    ]);
    expect(r.error).toBeDefined();
  });
});
