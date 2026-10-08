import { describe, expect, it } from 'vitest'
import { exactMailDate, mailDateAge, mailDateDetail, readerMailDate, readerMailDateParts, spokenMailDate } from './readerTime'

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

describe('spokenMailDate', () => {
  it('spells out the weekday and month, with the year only in another year', () => {
    expect(spokenMailDate(at(2026, 8, 2, 8, 58), now)).toBe('Sunday 2 August, 08:58')
    expect(spokenMailDate(at(2025, 5, 11, 14, 3), now)).toBe('Sunday 11 May 2025, 14:03')
    expect(spokenMailDate(undefined, now)).toBe('')
  })
})

describe('mailDateAge', () => {
  it('counts minutes and hours today, then calendar days', () => {
    expect(mailDateAge(now - 20_000, now)).toBe('just now')
    expect(mailDateAge(now + 60_000, now)).toBe('just now')
    expect(mailDateAge(now + 3600_000, now)).toBe('')
    expect(mailDateAge(now - 60_000, now)).toBe('1 minute ago')
    expect(mailDateAge(now - 59 * 60_000, now)).toBe('59 minutes ago')
    expect(mailDateAge(at(2026, 9, 30, 9, 0), now)).toBe('6 hours ago')
    expect(mailDateAge(at(2026, 9, 30, 14, 0), now)).toBe('1 hour ago')
    expect(mailDateAge(at(2026, 9, 29, 23, 50), now)).toBe('yesterday')
    expect(mailDateAge(at(2026, 9, 25, 12, 0), now)).toBe('5 days ago')
  })

  it('then weeks, months and years', () => {
    expect(mailDateAge(at(2026, 9, 23, 15, 0), now)).toBe('1 week ago')
    expect(mailDateAge(at(2026, 9, 2, 15, 0), now)).toBe('4 weeks ago')
    expect(mailDateAge(at(2026, 8, 30, 15, 0), now)).toBe('1 month ago')
    expect(mailDateAge(at(2026, 8, 2, 8, 58), now)).toBe('1 month ago')
    expect(mailDateAge(at(2026, 7, 31, 8, 58), now)).toBe('1 month ago')
    expect(mailDateAge(at(2026, 7, 30, 8, 58), now)).toBe('2 months ago')
    expect(mailDateAge(at(2025, 10, 1, 8, 0), now)).toBe('11 months ago')
    expect(mailDateAge(at(2025, 9, 30, 8, 0), now)).toBe('1 year ago')
    expect(mailDateAge(at(2023, 6, 3, 19, 22), now)).toBe('3 years ago')
    expect(mailDateAge('x', now)).toBe('')
  })
})

describe('mailDateDetail', () => {
  it('is the full timestamp and how long ago', () => {
    expect(mailDateDetail(at(2026, 8, 2, 8, 58, 20), now)).toBe('Sunday, 2 August 2026, 08:58:20 (1 month ago)')
    expect(mailDateDetail(now + 3600_000, now)).toBe('Wednesday, 30 September 2026, 16:30:00')
    expect(mailDateDetail(null, now)).toBe('')
  })
})

describe('readerMailDateParts', () => {
  it('splits the date into the day (with the year in another year) and the time', () => {
    expect(readerMailDateParts(at(2026, 8, 2, 8, 58), now)).toEqual({ day: 'Sun 2 Aug', time: '08:58' })
    expect(readerMailDateParts(at(2025, 5, 11, 14, 3), now)).toEqual({ day: 'Sun 11 May 2025', time: '14:03' })
    expect(readerMailDateParts(undefined, now)).toBeNull()
  })
})
