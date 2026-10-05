/**
 * Dates for the reader: a short relative form for the header and the exact
 * timestamp behind a tap, hover or long-press.
 */
import { formatDatePattern, isSameLocalDay, minutesBetween } from "../../utils/time";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export function relativeMailDate(timestamp: number | string | undefined | null, now: number = Date.now()): string {
  const n = Number(timestamp);
  if (!Number.isFinite(n) || n <= 0) return "";
  const then = new Date(n);
  const ref = new Date(now);
  const minutes = minutesBetween(n, now);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.trunc((now - n) / HOUR);
  if (hours < 24 && isSameLocalDay(then, ref)) return `${hours} h ago`;
  const yesterday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 1);
  if (isSameLocalDay(then, yesterday)) return `Yesterday ${formatDatePattern(then, "HH:mm")}`;
  // Elapsed days, ignoring a daylight-saving shift in between.
  const zoneShift = (ref.getTimezoneOffset() - then.getTimezoneOffset()) * 60_000;
  if (Math.trunc((now - n - zoneShift) / DAY) < 7) return formatDatePattern(then, "ddd HH:mm");
  if (then.getFullYear() === ref.getFullYear()) return formatDatePattern(then, "D MMM");
  return formatDatePattern(then, "D MMM YYYY");
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
