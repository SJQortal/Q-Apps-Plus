import { describe, expect, it } from 'vitest';
import { formatRoughDuration, formatTimeSpan } from './format';

const DAY = 86_400_000;

describe('formatRoughDuration', () => {
  it('says days up to eight weeks, then months, then years and months', () => {
    expect(formatRoughDuration(22 * DAY)).toBe('22 days');
    expect(formatRoughDuration(55 * DAY)).toBe('55 days');
    expect(formatRoughDuration(90 * DAY)).toBe('3 months');
    expect(formatRoughDuration(365 * DAY)).toBe('1 year');
    expect(formatRoughDuration(457 * DAY)).toBe('1 year 3 months');
    expect(formatRoughDuration(800 * DAY)).toBe('2 years 2 months');
  });
});

describe('formatTimeSpan', () => {
  it('says a span within a day by its hours, across days by its dates', () => {
    const at = (d: number, h: number, m: number) => new Date(2026, 9, d, h, m).getTime();
    expect(formatTimeSpan(at(16, 21, 36), at(16, 21, 55))).toBe('16 Oct 2026, 21:36–21:55');
    expect(formatTimeSpan(at(16, 21, 36), at(16, 21, 36))).toBe('16 Oct 2026, 21:36');
    expect(formatTimeSpan(at(7, 9, 0), at(2, 9, 0))).toBe('2 Oct 2026 – 7 Oct 2026');
  });
});
