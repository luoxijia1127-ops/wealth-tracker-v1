import { buildYmdString, parseYmd } from '@/lib/ymd-date-string';
import { describe, expect, it } from 'vitest';

describe('ymd-date-string', () => {
  it('does not pad month/day while typing leading zero', () => {
    expect(buildYmdString('2026', '0', '05')).toBe('2026-0-05');
    const p = parseYmd('2026-0-05');
    expect(p.m).toBe('0');
    expect(buildYmdString('2026', '05', '05')).toBe('2026-05-05');
    expect(parseYmd('2026-05-05').m).toBe('05');
  });

  it('round-trips stored dates without stripping leading zeros in fields', () => {
    const stored = '2026-04-02';
    const p = parseYmd(stored);
    expect(p).toEqual({ y: '2026', m: '04', d: '02' });
    expect(buildYmdString(p.y, p.m, p.d)).toBe(stored);
  });
});
