import { describe, expect, it } from 'vitest';
import {
  clampCumulativeForAxis,
  CUMULATIVE_CHART_CAP,
  CUMULATIVE_CHART_FLOOR,
} from '@/lib/investment-return-metrics';

describe('clampCumulativeForAxis', () => {
  it('clamps to floor and cap', () => {
    expect(clampCumulativeForAxis(-2)).toBe(CUMULATIVE_CHART_FLOOR);
    expect(clampCumulativeForAxis(10)).toBe(CUMULATIVE_CHART_CAP);
    expect(clampCumulativeForAxis(0.12)).toBeCloseTo(0.12, 5);
  });
});
