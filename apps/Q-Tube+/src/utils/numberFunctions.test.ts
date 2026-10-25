import { describe, expect, it } from 'vitest';
import { formatBytes, formatTime, removeTrailingZeros, setNumberWithinBounds } from './numberFunctions';

describe('formatTime', () => {
  it('formats seconds as m:ss below an hour and h:mm:ss above', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(65.9)).toBe('01:05');
    expect(formatTime(3600)).toBe('1:00:00');
    expect(formatTime(3725)).toBe('1:02:05');
  });
});

describe('formatBytes', () => {
  it('uses binary units by default and decimal on request', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536, 1)).toBe('1.5 KB');
    expect(formatBytes(1000, 2, 'Decimal')).toBe('1 KB');
  });
});

describe('bounds and trailing zeros', () => {
  it('clamps into the range and strips zeros', () => {
    expect(setNumberWithinBounds(5, 1, 3)).toBe(3);
    expect(setNumberWithinBounds(-1, 0, 3)).toBe(0);
    expect(setNumberWithinBounds(2, 0, 3)).toBe(2);
    expect(removeTrailingZeros('1.500')).toBe('1.5');
  });
});
