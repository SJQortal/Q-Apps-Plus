import { describe, expect, it } from 'vitest'
import moment from 'moment'
import { formatFullTimestamp, formatRelativeDate } from './time'

// A Wednesday at 15:30 local time, well inside the year.
const now = moment('2026-09-30T15:30:00').valueOf()

describe('formatRelativeDate', () => {
  it('shows the time for today', () => {
    const stamp = moment('2026-09-30T09:05:00')
    expect(formatRelativeDate(stamp.valueOf(), now)).toBe(stamp.format('LT'))
  })

  it('shows the weekday for the last six days', () => {
    expect(formatRelativeDate(moment('2026-09-29T23:59:00').valueOf(), now)).toBe('Tue')
    expect(formatRelativeDate(moment('2026-09-24T08:00:00').valueOf(), now)).toBe('Thu')
  })

  it('shows day and month for older mail this year, and the year beyond that', () => {
    expect(formatRelativeDate(moment('2026-09-23T08:00:00').valueOf(), now)).toBe('23 Sep')
    expect(formatRelativeDate(moment('2026-01-02T08:00:00').valueOf(), now)).toBe('2 Jan')
    expect(formatRelativeDate(moment('2025-12-31T08:00:00').valueOf(), now)).toBe('31 Dec 2025')
  })

  it('is empty for unknown stamps while the full stamp shows a dash', () => {
    expect(formatRelativeDate(undefined, now)).toBe('')
    expect(formatRelativeDate('nope', now)).toBe('')
    expect(formatFullTimestamp('nope')).toBe('-')
  })
})
