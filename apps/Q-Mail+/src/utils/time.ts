/**
 * Date formatting without a date library. The patterns use moment's tokens
 * (the app used moment with its default English locale until 2026-10), so
 * every string stays exactly as it was: English names, local time.
 */

const MONTH_LONG = new Intl.DateTimeFormat('en-US', { month: 'long' })
const MONTH_SHORT = new Intl.DateTimeFormat('en-US', { month: 'short' })
const WEEKDAY_LONG = new Intl.DateTimeFormat('en-US', { weekday: 'long' })
const WEEKDAY_SHORT = new Intl.DateTimeFormat('en-US', { weekday: 'short' })

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const pad = (value: number, length = 2) => String(value).padStart(length, '0')

const PATTERN_TOKENS = /YYYY|MMMM|MMM|MM|dddd|ddd|DD|D|HH|H|hh|h|mm|ss|A|\[[^\]]*\]/g

/**
 * Formats `date` in local time with a subset of moment's tokens:
 * YYYY, MMMM, MMM, MM, dddd, ddd, DD, D, HH, H, hh, h, mm, ss, A and
 * `[literal]` text. Anything else is copied as is.
 */
export function formatDatePattern(date: Date, pattern: string): string {
  return pattern.replace(PATTERN_TOKENS, (token) => {
    const hours = date.getHours()
    switch (token) {
      case 'YYYY':
        return pad(date.getFullYear(), 4)
      case 'MMMM':
        return MONTH_LONG.format(date)
      case 'MMM':
        return MONTH_SHORT.format(date)
      case 'MM':
        return pad(date.getMonth() + 1)
      case 'dddd':
        return WEEKDAY_LONG.format(date)
      case 'ddd':
        return WEEKDAY_SHORT.format(date)
      case 'DD':
        return pad(date.getDate())
      case 'D':
        return String(date.getDate())
      case 'HH':
        return pad(hours)
      case 'H':
        return String(hours)
      case 'hh':
        return pad(hours % 12 || 12)
      case 'h':
        return String(hours % 12 || 12)
      case 'mm':
        return pad(date.getMinutes())
      case 'ss':
        return pad(date.getSeconds())
      case 'A':
        return hours < 12 ? 'AM' : 'PM'
      default:
        return token.slice(1, -1)
    }
  })
}

/** True when both dates fall on the same local calendar day. */
export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Whole local calendar days from `from` to `to` (positive when `to` is later). */
export function calendarDaysBetween(from: Date, to: Date): number {
  const fromDay = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const toDay = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((toDay - fromDay) / DAY)
}

/** Whole minutes from `then` to `now`, truncated toward zero. */
export function minutesBetween(then: number, now: number): number {
  return Math.trunc((now - then) / MINUTE)
}

export function formatTimestamp(timestamp: number): string {
  const elapsedTime = minutesBetween(timestamp, Date.now())

  if (elapsedTime < 1) {
    return 'Just now'
  } else if (elapsedTime < 60) {
    return `${elapsedTime}m`
  } else if (elapsedTime < 1440) {
    return `${Math.floor(elapsedTime / 60)}h`
  } else {
    return formatDatePattern(new Date(timestamp), 'MMM D')
  }
}

export function formatEmailDate(timestamp: number, now: number = Date.now()) {
  const date = new Date(timestamp)
  const reference = new Date(now)

  if (isSameLocalDay(date, reference)) {
    // Received today: the time.
    return formatDatePattern(date, 'h:mm A')
  } else if (date.getFullYear() === reference.getFullYear()) {
    // This year: month and day.
    return formatDatePattern(date, 'MMM D')
  } else {
    // Older: the full date.
    return formatDatePattern(date, 'MMM D, YYYY')
  }
}

export function formatFullTimestamp(
  timestamp: number | string | undefined | null
): string {
  const numericTimestamp = Number(timestamp)
  if (!Number.isFinite(numericTimestamp)) {
    return "-"
  }

  return formatDatePattern(new Date(numericTimestamp), "YYYY-MM-DD HH:mm:ss")
}

/**
 * The short date for a list row (docs/DESIGN.md → UX #13): today → the time,
 * the last six days → the weekday, this year → day and month, else the full
 * date. Pair it with `formatFullTimestamp` in a `title` for the exact stamp.
 */
export function formatRelativeDate(
  timestamp: number | string | undefined | null,
  now: number = Date.now()
): string {
  const numericTimestamp = Number(timestamp)
  if (!Number.isFinite(numericTimestamp) || numericTimestamp <= 0) {
    return ""
  }
  const date = new Date(numericTimestamp)
  const reference = new Date(now)
  if (isSameLocalDay(date, reference)) {
    return formatDatePattern(date, 'h:mm A')
  }
  const daysAgo = calendarDaysBetween(date, reference)
  if (daysAgo > 0 && daysAgo < 7) {
    return formatDatePattern(date, 'ddd')
  }
  if (date.getFullYear() === reference.getFullYear()) {
    return formatDatePattern(date, 'D MMM')
  }
  return formatDatePattern(date, 'D MMM YYYY')
}
