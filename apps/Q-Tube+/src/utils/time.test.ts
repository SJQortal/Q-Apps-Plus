import { describe, expect, it } from 'vitest';
import { formatDate } from './time';

const NOW = Date.UTC(2026, 8, 29, 12, 0, 0);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('formatDate', () => {
  it('reads like moment.fromNow() in English', () => {
    expect(formatDate(NOW - 10_000, 'en', NOW)).toBe('now');
    expect(formatDate(NOW - 5 * MIN, 'en', NOW)).toBe('5 minutes ago');
    expect(formatDate(NOW - 3 * HOUR, 'en', NOW)).toBe('3 hours ago');
    expect(formatDate(NOW - 3 * DAY, 'en', NOW)).toBe('3 days ago');
    expect(formatDate(NOW - 40 * DAY, 'en', NOW)).toBe('1 month ago');
    expect(formatDate(NOW - 70 * DAY, 'en', NOW)).toBe('2 months ago');
    expect(formatDate(NOW - 800 * DAY, 'en', NOW)).toBe('2 years ago');
    expect(formatDate(NOW + 2 * HOUR, 'en', NOW)).toBe('in 2 hours');
  });

  it('follows the locale and falls back to English for unknown ones', () => {
    expect(formatDate(NOW - 3 * DAY, 'de', NOW)).toBe('vor 3 Tagen');
    expect(formatDate(NOW - 3 * DAY, 'zz-nowhere', NOW)).toBe('3 days ago');
  });

  it('accepts string-ish timestamps and rejects garbage', () => {
    expect(formatDate(Number(String(NOW - DAY)), 'en', NOW)).toBe('1 day ago');
    expect(formatDate(Number.NaN, 'en', NOW)).toBe('');
  });
});
