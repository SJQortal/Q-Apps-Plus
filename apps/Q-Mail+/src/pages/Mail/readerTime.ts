/**
 * Dates for the reader: the weekday, day, month and time in the header and
 * on each earlier message (the year too when it isn't this year), and the
 * full timestamp with seconds behind a tap, hover or long-press.
 */
import { formatDatePattern } from "../../utils/time";

/** "Sun 2 Aug, 08:58", or "Thu 11 May 2025, 14:03" in another year (local time). */
export function readerMailDate(timestamp: number | string | undefined | null, now: number = Date.now()): string {
  const n = Number(timestamp);
  if (!Number.isFinite(n) || n <= 0) return "";
  const then = new Date(n);
  const sameYear = then.getFullYear() === new Date(now).getFullYear();
  return formatDatePattern(then, sameYear ? "ddd D MMM, HH:mm" : "ddd D MMM YYYY, HH:mm");
}

export function exactMailDate(timestamp: number | string | undefined | null): string {
  const n = Number(timestamp);
  if (!Number.isFinite(n) || n <= 0) return "";
  return formatDatePattern(new Date(n), "dddd, D MMMM YYYY, HH:mm:ss");
}

/** Minimal HTML escaping for values interpolated into the forward header. */
export function escapeHtmlText(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
