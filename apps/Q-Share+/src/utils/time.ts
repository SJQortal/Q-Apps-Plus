/**
 * Relative dates without moment (which shipped every locale, ~300 kB).
 * Output matches what the original app showed: "3 hours ago", "Just now",
 * "5m", "Sep 29".
 */
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const MONTH = 30 * DAY
const YEAR = 365 * DAY

function toMillis(value: number | string | Date): number {
  if (value instanceof Date) return value.getTime()
  const n = Number(value)
  return Number.isFinite(n) ? n : Date.parse(String(value))
}

/** "a few seconds ago", "2 minutes ago", "3 days ago", "a year ago" — moment.fromNow() wording. */
export function fromNow(timestampMs: number, now = Date.now()): string {
  const diff = now - timestampMs
  const future = diff < 0
  const abs = Math.abs(diff)
  const unit = (n: number, singular: string, aOrAn = 'a'): string =>
    n <= 1 ? `${aOrAn} ${singular}` : `${n} ${singular}s`
  let text: string
  if (abs < 45_000) text = 'a few seconds'
  else if (abs < 90_000) text = 'a minute'
  else if (abs < 45 * MINUTE) text = unit(Math.round(abs / MINUTE), 'minute')
  else if (abs < 90 * MINUTE) text = 'an hour'
  else if (abs < 22 * HOUR) text = unit(Math.round(abs / HOUR), 'hour', 'an')
  else if (abs < 36 * HOUR) text = 'a day'
  else if (abs < 26 * DAY) text = unit(Math.round(abs / DAY), 'day')
  else if (abs < 45 * DAY) text = 'a month'
  else if (abs < 320 * DAY) text = unit(Math.round(abs / MONTH), 'month')
  else if (abs < 548 * DAY) text = 'a year'
  else text = unit(Math.round(abs / YEAR), 'year')
  return future ? `in ${text}` : `${text} ago`
}

function shortDate(timestampMs: number): string {
  return new Date(timestampMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function compact(timestampMs: number, now = Date.now()): string {
  const elapsed = Math.floor((now - timestampMs) / MINUTE)
  if (elapsed < 1) return 'Just now'
  if (elapsed < 60) return `${elapsed}m`
  if (elapsed < 1440) return `${Math.floor(elapsed / 60)}h`
  return shortDate(timestampMs)
}

export function formatTimestamp(timestamp: number): string {
  return compact(timestamp)
}

export function formatTimestampSeconds(timestamp: number): string {
  return compact(timestamp * 1000)
}

export const formatDate = (unixTimestamp: number | string): string => {
  return fromNow(toMillis(unixTimestamp))
}

export const formatDateSeconds = (unixTimestamp: number): string => {
  return fromNow(unixTimestamp * 1000)
}
