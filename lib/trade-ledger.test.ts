import { describe, expect, it, vi } from 'vitest';
import {
  ensureBaselineLedger,
  pickListedSyntheticOpenDate,
  replayListedPosition,
} from '@/lib/trade-ledger';
import type { SimpleAsset } from '@/types/asset';

vi.mock('@/lib/date-shanghai', () => ({
  getShanghaiDateString: () => '2026-04-10',
}));

describe('pickListedSyntheticOpenDate', () => {
  it('uses earliest history snapshot date when present', () => {
    const a: SimpleAsset = {
      id: 'a',
      name: '工行',
      category: 'Stock',
      value: 1,
      currency: 'CNY',
      symbol: '601398',
      exchange: 'SH',
      lastCloseDate: '2026-04-09',
      history: [
        { date: '2026-02-01', value: 100 },
        { date: '2026-03-15', value: 110 },
      ],
    };
    expect(pickListedSyntheticOpenDate(a)).toBe('2026-02-01');
  });

  it('falls back to today when no history (avoids shared lastCloseDate)', () => {
    const a: SimpleAsset = {
      id: 'b',
      name: '其它',
      category: 'Stock',
      value: 1,
      currency: 'CNY',
      symbol: '600000',
      exchange: 'SH',
      shares: 100,
      avgCost: 10,
      lastCloseDate: '2026-04-09',
    };
    expect(pickListedSyntheticOpenDate(a)).toBe('2026-04-10');
  });
});

describe('ensureBaselineLedger', () => {
  it('puts synthetic buy on pickListedSyntheticOpenDate', () => {
    const a: SimpleAsset = {
      id: 'c',
      name: '标的',
      category: 'Stock',
      value: 1000,
      currency: 'CNY',
      symbol: '600519',
      exchange: 'SH',
      shares: 10,
      avgCost: 100,
      history: [{ date: '2026-01-05', value: 1000 }],
    };
    const led = ensureBaselineLedger(a);
    expect(led).toHaveLength(1);
    expect(led[0]!.tradeDate).toBe('2026-01-05');
  });
});

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
