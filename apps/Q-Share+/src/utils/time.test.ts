import { describe, expect, it } from 'vitest';
import { formatDate, formatTimestamp, fromNow } from './time';

const NOW = Date.UTC(2026, 8, 30, 12, 0, 0);

describe('time helpers (moment-free)', () => {
  it('matches moment.fromNow wording', () => {
    expect(fromNow(NOW - 10_000, NOW)).toBe('a few seconds ago');
    expect(fromNow(NOW - 60_000, NOW)).toBe('a minute ago');
    expect(fromNow(NOW - 5 * 60_000, NOW)).toBe('5 minutes ago');
    expect(fromNow(NOW - 60 * 60_000, NOW)).toBe('an hour ago');
    expect(fromNow(NOW - 3 * 3_600_000, NOW)).toBe('3 hours ago');
    expect(fromNow(NOW - 24 * 3_600_000, NOW)).toBe('a day ago');
    expect(fromNow(NOW - 10 * 86_400_000, NOW)).toBe('10 days ago');
    expect(fromNow(NOW - 40 * 86_400_000, NOW)).toBe('a month ago');
    expect(fromNow(NOW - 400 * 86_400_000, NOW)).toBe('a year ago');
    expect(fromNow(NOW + 3_600_000, NOW)).toBe('in an hour');
  });

  it('accepts the string timestamps stored on QDN', () => {
    expect(formatDate(String(Date.now() - 5 * 60_000))).toBe('5 minutes ago');
  });

  it('formats compact timestamps', () => {
    expect(formatTimestamp(Date.now() - 30_000)).toBe('Just now');
    expect(formatTimestamp(Date.now() - 5 * 60_000)).toBe('5m');
    expect(formatTimestamp(Date.now() - 3 * 3_600_000)).toBe('3h');
  });
});
