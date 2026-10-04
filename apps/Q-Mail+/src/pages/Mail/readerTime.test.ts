import { describe, expect, it } from 'vitest'
import { exactMailDate, relativeMailDate } from './readerTime'

const at = (y: number, m: number, d: number, h = 0, min = 0, s = 0) => new Date(y, m - 1, d, h, min, s).getTime()

// Wednesday 30 September 2026, 15:30 local time.
const now = at(2026, 9, 30, 15, 30)

describe('relativeMailDate', () => {
  it('counts minutes, then hours within today', () => {
    expect(relativeMailDate(now - 10_000, now)).toBe('Just now')
    expect(relativeMailDate(now + 120_000, now)).toBe('Just now')
    expect(relativeMailDate(now - 59 * 60_000, now)).toBe('59 min ago')
    expect(relativeMailDate(at(2026, 9, 30, 9, 0), now)).toBe('6 h ago')
  })

  it('says Yesterday with the time, then the weekday within a week', () => {
    expect(relativeMailDate(at(2026, 9, 29, 23, 10), now)).toBe('Yesterday 23:10')
    expect(relativeMailDate(at(2026, 9, 29, 7, 5), now)).toBe('Yesterday 07:05')
    expect(relativeMailDate(at(2026, 9, 24, 16, 0), now)).toBe('Thu 16:00')
  })

  it('shows day and month this year, and the year before that', () => {
    expect(relativeMailDate(at(2026, 9, 23, 15, 0), now)).toBe('23 Sep')
    expect(relativeMailDate(at(2026, 1, 5, 12, 0), now)).toBe('5 Jan')
    expect(relativeMailDate(at(2025, 12, 31, 12, 0), now)).toBe('31 Dec 2025')
  })

  it('is empty for missing or invalid stamps', () => {
    expect(relativeMailDate(undefined, now)).toBe('')
    expect(relativeMailDate('x', now)).toBe('')
    expect(relativeMailDate(0, now)).toBe('')
  })
})

describe('exactMailDate', () => {
  it('spells out the weekday and month with seconds', () => {
    expect(exactMailDate(at(2026, 9, 30, 15, 30, 9))).toBe('Wednesday, 30 September 2026, 15:30:09')
    expect(exactMailDate(String(at(2025, 1, 2, 3, 4, 5)))).toBe('Thursday, 2 January 2025, 03:04:05')
    expect(exactMailDate(null)).toBe('')
  })
})
