import { describe, expect, it } from 'vitest'
import { calendarDaysBetween, formatDatePattern, formatFullTimestamp } from './time'

// Local times, so the tests hold in any time zone.
const at = (y: number, m: number, d: number, h = 0, min = 0, s = 0) => new Date(y, m - 1, d, h, min, s).getTime()

// A Wednesday at 15:30 local time, well inside the year.
const now = at(2026, 9, 30, 15, 30)

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

describe('formatFullTimestamp', () => {
  it('is YYYY-MM-DD HH:mm:ss in local time, from numbers or numeric strings', () => {
    expect(formatFullTimestamp(at(2026, 9, 30, 15, 30, 7))).toBe('2026-09-30 15:30:07')
    expect(formatFullTimestamp(String(at(2025, 1, 2, 3, 4, 5)))).toBe('2025-01-02 03:04:05')
    expect(formatFullTimestamp(undefined)).toBe('-')
    expect(formatFullTimestamp('nope')).toBe('-')
  })
})
