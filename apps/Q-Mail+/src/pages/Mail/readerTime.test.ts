import { describe, expect, it } from 'vitest'
import { exactMailDate, readerMailDate } from './readerTime'

const at = (y: number, m: number, d: number, h = 0, min = 0, s = 0) => new Date(y, m - 1, d, h, min, s).getTime()

// Wednesday 30 September 2026, 15:30 local time.
const now = at(2026, 9, 30, 15, 30)

describe('readerMailDate', () => {
  it('gives the weekday, day, month and time, also for mail from today', () => {
    expect(readerMailDate(now - 10_000, now)).toBe('Wed 30 Sep, 15:29')
    expect(readerMailDate(at(2026, 9, 30, 9, 0), now)).toBe('Wed 30 Sep, 09:00')
    expect(readerMailDate(at(2026, 9, 29, 23, 10), now)).toBe('Tue 29 Sep, 23:10')
    expect(readerMailDate(at(2026, 8, 2, 8, 58), now)).toBe('Sun 2 Aug, 08:58')
    expect(readerMailDate(String(at(2026, 1, 5, 7, 5)), now)).toBe('Mon 5 Jan, 07:05')
  })

  it('adds the year when it is not this year', () => {
    expect(readerMailDate(at(2025, 12, 31, 23, 59), now)).toBe('Wed 31 Dec 2025, 23:59')
    expect(readerMailDate(at(2025, 5, 11, 14, 3), now)).toBe('Sun 11 May 2025, 14:03')
    expect(readerMailDate(at(2027, 1, 1, 0, 0), now)).toBe('Fri 1 Jan 2027, 00:00')
  })

  it('is empty for missing or invalid stamps', () => {
    expect(readerMailDate(undefined, now)).toBe('')
    expect(readerMailDate('x', now)).toBe('')
    expect(readerMailDate(0, now)).toBe('')
  })
})

describe('exactMailDate', () => {
  it('spells out the weekday and month with seconds', () => {
    expect(exactMailDate(at(2026, 9, 30, 15, 30, 9))).toBe('Wednesday, 30 September 2026, 15:30:09')
    expect(exactMailDate(String(at(2025, 1, 2, 3, 4, 5)))).toBe('Thursday, 2 January 2025, 03:04:05')
    expect(exactMailDate(null)).toBe('')
  })
})
