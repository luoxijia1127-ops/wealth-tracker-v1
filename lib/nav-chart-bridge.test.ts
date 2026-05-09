import { describe, expect, it } from 'vitest';

import {
  calendarDaysDiff,
  expandSnapshotsDailyLinear,
  mergeSnapshotsWithNavBridgesForChart,
  type NavChartBridge,
} from '@/lib/nav-chart-bridge';
import type { Snapshot } from '@/lib/snapshots';

describe('calendarDaysDiff', () => {
  it('computes inclusive calendar span between dates', () => {
    expect(calendarDaysDiff('2026-05-01', '2026-05-08')).toBe(7);
    expect(calendarDaysDiff('2026-05-01', '2026-05-02')).toBe(1);
  });
});

describe('mergeSnapshotsWithNavBridgesForChart', () => {
  it('linearly ramps supplemental NAV between trade and track without touching track day double-count', () => {
    const snaps: Snapshot[] = [
      { date: '2026-05-01', totalValue: 10000, totalValueCny: 10000 },
      { date: '2026-05-08', totalValue: 11500, totalValueCny: 11500 },
    ];
    const bridge: NavChartBridge = {
      id: 'b1',
      assetId: 'a1',
      tradeYmd: '2026-05-01',
      trackYmd: '2026-05-08',
      costCny: 1000,
      valueAtTrackCny: 1500,
    };
    const merged = mergeSnapshotsWithNavBridgesForChart(snaps, [bridge]);
    const byDate = Object.fromEntries(merged.map((s) => [s.date, s.totalValueCny]));

    expect(byDate['2026-05-01']).toBeCloseTo(10000 + 1000, 5);
    expect(byDate['2026-05-08']).toBeCloseTo(11500, 5);
    const mid = byDate['2026-05-04'];
    expect(mid).toBeDefined();
    expect(mid!).toBeGreaterThan(10000 + 1000);
    expect(mid!).toBeLessThan(11500);
  });
});

describe('expandSnapshotsDailyLinear', () => {
  it('fills missing calendar days between sparse knots', () => {
    const knots: Snapshot[] = [
      { date: '2026-05-01', totalValue: 1000, totalValueCny: 1000 },
      { date: '2026-05-04', totalValue: 4000, totalValueCny: 4000 },
    ];
    const dense = expandSnapshotsDailyLinear(knots);
    expect(dense.map((s) => s.date)).toEqual([
      '2026-05-01',
      '2026-05-02',
      '2026-05-03',
      '2026-05-04',
    ]);
    expect(dense[0]!.totalValueCny).toBe(1000);
    expect(dense[1]!.totalValueCny).toBeCloseTo(2000, 5);
    expect(dense[2]!.totalValueCny).toBeCloseTo(3000, 5);
    expect(dense[3]!.totalValueCny).toBe(4000);
  });
});
