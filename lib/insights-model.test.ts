import { describe, expect, it } from 'vitest';
import {
  addCalendarDaysYmd,
  aggregateByCategory,
  filterSnapshotsByTimeframe,
  formatTrendAxisCny,
  getTrendPeriodNavChangeInDisplay,
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

  it('returns full range for CUSTOM when range covers all dates', () => {
    const out = filterSnapshotsByTimeframe(snaps, 'CUSTOM', '2026-03-28', {
      start: '2025-12-01',
      end: '2026-03-28',
    });
    expect(out).toEqual(snaps);
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
    const out = filterSnapshotsByTimeframe(withFuture, 'CUSTOM', '2026-03-28', {
      start: '2025-01-01',
      end: '2026-03-28',
    });
    expect(out.map((s) => s.date)).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
    ]);
  });
});

describe('getTrendPeriodNavChangeInDisplay', () => {
  it('uses NAV on period-start day vs last in window (7D example)', () => {
    const ordered: Snapshot[] = [
      { date: '2026-04-01', totalValue: 1, totalValueCny: 5 },
      { date: '2026-04-11', totalValue: 1, totalValueCny: 10 },
      { date: '2026-04-15', totalValue: 1, totalValueCny: 50 },
      { date: '2026-04-18', totalValue: 1, totalValueCny: 100 },
    ];
    const anchor = '2026-04-18';
    const out = getTrendPeriodNavChangeInDisplay(
      ordered,
      '7D',
      anchor,
      null,
      'CNY',
      null
    );
    expect(out).not.toBeNull();
    expect(out!.diff).toBe(90);
    expect(out!.pct).toBeCloseTo(900, 5);
  });

  it('uses last snapshot on or before period start when no snap on that day', () => {
    const ordered: Snapshot[] = [
      { date: '2026-04-10', totalValue: 1, totalValueCny: 10 },
      { date: '2026-04-16', totalValue: 1, totalValueCny: 100 },
    ];
    const anchor = '2026-04-18';
    const out = getTrendPeriodNavChangeInDisplay(
      ordered,
      '7D',
      anchor,
      null,
      'CNY',
      null
    );
    expect(out).not.toBeNull();
    // 7D from 4/18 → start 4/11; last ≤ 4/11 is 4/10 → 10; last in window 4/16 → 100
    expect(out!.diff).toBe(90);
    expect(out!.pct).toBeCloseTo(900, 5);
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
