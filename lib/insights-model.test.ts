import { describe, expect, it } from 'vitest';
import {
  addCalendarDaysYmd,
  aggregateByCategory,
  filterSnapshotsByTimeframe,
  formatTrendAxisCny,
} from '@/lib/insights-model';
import type { SimpleAsset } from '@/types/asset';
import type { Snapshot } from '@/lib/snapshots';

describe('addCalendarDaysYmd', () => {
  it('subtracts days across month boundary', () => {
    expect(addCalendarDaysYmd('2026-03-15', -31)).toBe('2026-02-12');
  });
});

describe('filterSnapshotsByTimeframe', () => {
  const snaps: Snapshot[] = [
    { date: '2026-01-01', totalValue: 1, totalValueCny: 100 },
    { date: '2026-02-01', totalValue: 1, totalValueCny: 110 },
    { date: '2026-03-01', totalValue: 1, totalValueCny: 120 },
  ];

  it('returns all for ALL', () => {
    expect(filterSnapshotsByTimeframe(snaps, 'ALL', '2026-03-28')).toEqual(snaps);
  });

  it('filters by lookback from anchor', () => {
    const out = filterSnapshotsByTimeframe(snaps, '1M', '2026-03-28');
    // 约 31 天回溯自 3/28 → 不早于 2/25，故不含 2/1
    expect(out.map((s) => s.date)).toEqual(['2026-03-01']);
  });

  it('excludes future dates relative to anchor', () => {
    const withFuture: Snapshot[] = [
      ...snaps,
      { date: '2026-04-01', totalValue: 1, totalValueCny: 130 },
    ];
    const out = filterSnapshotsByTimeframe(withFuture, 'ALL', '2026-03-28');
    expect(out.map((s) => s.date)).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
    ]);
  });
});

describe('formatTrendAxisCny', () => {
  it('formats 万 and 亿 compactly', () => {
    expect(formatTrendAxisCny(12_345)).toContain('万');
    expect(formatTrendAxisCny(1.23e8)).toMatch(/亿/);
  });
});

describe('aggregateByCategory', () => {
  it('sums USD cash into CNY when rates provided', () => {
    const assets: SimpleAsset[] = [
      {
        id: '1',
        name: 'USD',
        category: 'Cash',
        value: 100,
        currency: 'USD',
      },
    ];
    const rates = { CNY: 7.2, USD: 1, EUR: 0.9 } as const;
    const m = aggregateByCategory(assets, rates);
    expect(m.Cash).toBeCloseTo(720, 5);
  });
});
