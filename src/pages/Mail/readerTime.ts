/**
 * Dates for the reader: a short relative form for the header and the exact
 * timestamp behind a tap, hover or long-press.
 */
import moment from 'moment'

export function relativeMailDate(timestamp: number | string | undefined | null, now: number = Date.now()): string {
  const n = Number(timestamp)
  if (!Number.isFinite(n) || n <= 0) return ''
  const then = moment(n)
  const ref = moment(now)
  const minutes = ref.diff(then, 'minutes')
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = ref.diff(then, 'hours')
  if (hours < 24 && then.isSame(ref, 'day')) return `${hours} h ago`
  if (then.isSame(ref.clone().subtract(1, 'day'), 'day')) return `Yesterday ${then.format('HH:mm')}`
  if (ref.diff(then, 'days') < 7) return then.format('ddd HH:mm')
  if (then.isSame(ref, 'year')) return then.format('D MMM')
  return then.format('D MMM YYYY')
}

export function exactMailDate(timestamp: number | string | undefined | null): string {
  const n = Number(timestamp)
  if (!Number.isFinite(n) || n <= 0) return ''
  return moment(n).format('dddd, D MMMM YYYY, HH:mm:ss')
}

/** Minimal HTML escaping for values interpolated into the forward header. */
export function escapeHtmlText(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
