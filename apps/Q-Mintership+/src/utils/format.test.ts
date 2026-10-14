import { describe, expect, it } from 'vitest';
import { formatRoughDuration } from './format';

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
