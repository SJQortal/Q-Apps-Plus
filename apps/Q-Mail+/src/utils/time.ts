/**
 * Date formatting without a date library. The patterns use moment's tokens
 * (the app used moment with its default English locale until 2026-10), so
 * every string stays exactly as it was: English names, local time.
 */

const MONTH_LONG = new Intl.DateTimeFormat('en-US', { month: 'long' })
const MONTH_SHORT = new Intl.DateTimeFormat('en-US', { month: 'short' })
const WEEKDAY_LONG = new Intl.DateTimeFormat('en-US', { weekday: 'long' })
const WEEKDAY_SHORT = new Intl.DateTimeFormat('en-US', { weekday: 'short' })

const DAY = 24 * 60 * 60_000

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

/** Whole local calendar days from `from` to `to` (positive when `to` is later). */
export function calendarDaysBetween(from: Date, to: Date): number {
  const fromDay = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const toDay = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((toDay - fromDay) / DAY)
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
