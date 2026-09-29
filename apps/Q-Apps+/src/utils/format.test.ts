import { describe, expect, it } from 'vitest';
import { formatBytes, timeAgo } from './format';

describe('formatBytes', () => {
  it('rounds sensibly', () => {
    expect(formatBytes(undefined)).toBe('');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2_048)).toBe('2.0 KB');
    expect(formatBytes(2_100_000)).toBe('2.0 MB');
    expect(formatBytes(15_000_000)).toBe('14 MB');
  });
});

describe('timeAgo', () => {
  const now = 1_700_000_000_000;
  it('uses short units', () => {
    expect(timeAgo(now - 5_000, now)).toBe('just now');
    expect(timeAgo(now - 5 * 60_000, now)).toBe('5 min ago');
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe('3 h ago');
    expect(timeAgo(now - 2 * 86_400_000, now)).toBe('2 d ago');
    expect(timeAgo(now - 21 * 86_400_000, now)).toBe('3 w ago');
    expect(timeAgo(undefined, now)).toBe('');
  });
});
