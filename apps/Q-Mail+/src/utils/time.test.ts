import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  calendarDaysBetween,
  formatDatePattern,
  formatEmailDate,
  formatFullTimestamp,
  formatRelativeDate,
  formatTimestamp,
} from './time'

// Local times, so the tests hold in any time zone.
const at = (y: number, m: number, d: number, h = 0, min = 0, s = 0) => new Date(y, m - 1, d, h, min, s).getTime()

// A Wednesday at 15:30 local time, well inside the year.
const now = at(2026, 9, 30, 15, 30)

afterEach(() => {
  vi.useRealTimers()
})

describe('formatDatePattern', () => {
  it('formats moment-style tokens in English, local time', () => {
    const date = new Date(at(2026, 3, 7, 9, 5, 4))
    expect(formatDatePattern(date, 'YYYY-MM-DD HH:mm:ss')).toBe('2026-03-07 09:05:04')
    expect(formatDatePattern(date, 'dddd, D MMMM YYYY, HH:mm:ss')).toBe('Saturday, 7 March 2026, 09:05:04')
    expect(formatDatePattern(date, 'ddd MMM D, h:mm A')).toBe('Sat Mar 7, 9:05 AM')
    expect(formatDatePattern(date, '[at] hh')).toBe('at 09')
  })

  it('handles noon, midnight and the afternoon in the 12-hour clock', () => {
    expect(formatDatePattern(new Date(at(2026, 1, 1, 0, 0)), 'h:mm A')).toBe('12:00 AM')
    expect(formatDatePattern(new Date(at(2026, 1, 1, 12, 0)), 'h:mm A')).toBe('12:00 PM')
    expect(formatDatePattern(new Date(at(2026, 1, 1, 23, 59)), 'h:mm A')).toBe('11:59 PM')
  })
})

describe('calendarDaysBetween', () => {
  it('counts local calendar days, not 24-hour spans', () => {
    expect(calendarDaysBetween(new Date(at(2026, 9, 29, 23, 59)), new Date(at(2026, 9, 30, 0, 1)))).toBe(1)
    expect(calendarDaysBetween(new Date(at(2026, 3, 1)), new Date(at(2026, 4, 1)))).toBe(31)
    expect(calendarDaysBetween(new Date(now), new Date(now))).toBe(0)
  })
})

describe('formatRelativeDate', () => {
  it('shows the time for today', () => {
    expect(formatRelativeDate(at(2026, 9, 30, 9, 5), now)).toBe('9:05 AM')
    expect(formatRelativeDate(at(2026, 9, 30, 13, 0), now)).toBe('1:00 PM')
  })

  it('shows the weekday for the last six days', () => {
    expect(formatRelativeDate(at(2026, 9, 29, 23, 59), now)).toBe('Tue')
    expect(formatRelativeDate(at(2026, 9, 24, 8, 0), now)).toBe('Thu')
  })

  it('shows day and month for older mail this year, and the year beyond that', () => {
    expect(formatRelativeDate(at(2026, 9, 23, 8, 0), now)).toBe('23 Sep')
    expect(formatRelativeDate(at(2026, 1, 2, 8, 0), now)).toBe('2 Jan')
    expect(formatRelativeDate(at(2025, 12, 31, 8, 0), now)).toBe('31 Dec 2025')
  })

  it('is empty for unknown stamps while the full stamp shows a dash', () => {
    expect(formatRelativeDate(undefined, now)).toBe('')
    expect(formatRelativeDate('nope', now)).toBe('')
    expect(formatRelativeDate(0, now)).toBe('')
    expect(formatFullTimestamp('nope')).toBe('-')
  })
})

describe('formatFullTimestamp', () => {
  it('is YYYY-MM-DD HH:mm:ss in local time, from numbers or numeric strings', () => {
    expect(formatFullTimestamp(at(2026, 9, 30, 15, 30, 7))).toBe('2026-09-30 15:30:07')
    expect(formatFullTimestamp(String(at(2025, 1, 2, 3, 4, 5)))).toBe('2025-01-02 03:04:05')
    expect(formatFullTimestamp(undefined)).toBe('-')
  })
})

describe('formatEmailDate', () => {
  it('shows the time today, month and day this year, the full date before', () => {
    expect(formatEmailDate(at(2026, 9, 30, 8, 7), now)).toBe('8:07 AM')
    expect(formatEmailDate(at(2026, 2, 14, 8, 7), now)).toBe('Feb 14')
    expect(formatEmailDate(at(2024, 11, 3, 8, 7), now)).toBe('Nov 3, 2024')
  })
})

describe('formatTimestamp', () => {
  it('counts minutes and hours, then shows month and day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
    expect(formatTimestamp(now - 20_000)).toBe('Just now')
    expect(formatTimestamp(now + 60_000)).toBe('Just now')
    expect(formatTimestamp(now - 5 * 60_000)).toBe('5m')
    expect(formatTimestamp(now - 3 * 3_600_000 - 59 * 60_000)).toBe('3h')
    expect(formatTimestamp(at(2026, 9, 3, 10, 0))).toBe('Sep 3')
  })
})
