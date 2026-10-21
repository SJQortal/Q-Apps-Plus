import { describe, expect, it } from 'vitest';
import { clampActivityRead } from './settings';

describe('Activity’s first read', () => {
  it('keeps to whole pages of 100, from 100 to 20,000', () => {
    expect(clampActivityRead(500)).toBe(500);
    expect(clampActivityRead(150)).toBe(200);
    expect(clampActivityRead(1)).toBe(100);
    expect(clampActivityRead(0)).toBe(100);
    expect(clampActivityRead(50_000)).toBe(20_000);
    // Anything stored that isn't a number is the default.
    expect(clampActivityRead('lots')).toBe(1_000);
    expect(clampActivityRead(Number.NaN)).toBe(1_000);
  });
});
