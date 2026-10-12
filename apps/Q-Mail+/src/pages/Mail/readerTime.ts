/**
 * Mail dates. Everywhere a message's date shows (the reader, earlier
 * messages, list rows, sender groups, threads, drafts): the weekday, day,
 * month and time, with the year when it isn't this year. Behind a hover or a
 * tap, the detail: the full timestamp with seconds and how long ago it was.
 * Screen readers get the same date with the names spelt out.
 */
import { calendarDaysBetween, formatDatePattern } from "../../utils/time";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * A usable timestamp, or null. Beyond ±8.64e15 ms a Date is invalid and Intl
 * throws while formatting it, which would take the screen down (a crafted
 * `createdAt` in a message is enough), so those are refused here.
 */
const stamp = (timestamp: number | string | undefined | null): number | null => {
  const n = Number(timestamp);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Number.isNaN(new Date(n).getTime()) ? null : n;
};

/** The two halves of readerMailDate: { day: "Sun 2 Aug" or "Thu 11 May 2025", time: "08:58" }. */
export function readerMailDateParts(
  timestamp: number | string | undefined | null,
  now: number = Date.now()
): { day: string; time: string } | null {
  const n = stamp(timestamp);
  if (n === null) return null;
  const then = new Date(n);
  const sameYear = then.getFullYear() === new Date(now).getFullYear();
  return {
    day: formatDatePattern(then, sameYear ? "ddd D MMM" : "ddd D MMM YYYY"),
    time: formatDatePattern(then, "HH:mm"),
  };
}

/** "Sun 2 Aug, 08:58", or "Thu 11 May 2025, 14:03" in another year (local time). */
export function readerMailDate(timestamp: number | string | undefined | null, now: number = Date.now()): string {
  const parts = readerMailDateParts(timestamp, now);
  return parts ? `${parts.day}, ${parts.time}` : "";
}

/** "Sunday, 2 August 2026, 08:58:20": the full timestamp, local time. */
export function exactMailDate(timestamp: number | string | undefined | null): string {
  const n = stamp(timestamp);
  if (n === null) return "";
  return formatDatePattern(new Date(n), "dddd, D MMMM YYYY, HH:mm:ss");
}

/** The short date for screen readers: "Sunday 2 August, 08:58", "Sunday 11 May 2025, 14:03". */
export function spokenMailDate(timestamp: number | string | undefined | null, now: number = Date.now()): string {
  const n = stamp(timestamp);
  if (n === null) return "";
  const then = new Date(n);
  const sameYear = then.getFullYear() === new Date(now).getFullYear();
  return formatDatePattern(then, sameYear ? "dddd D MMMM, HH:mm" : "dddd D MMMM YYYY, HH:mm");
}

const count = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"} ago`;

/**
 * How long ago, in words: "just now", "5 minutes ago", "3 hours ago" (today),
 * "yesterday", "4 days ago", "2 weeks ago", "3 months ago", "1 year ago".
 * Days count calendar days; "" for a missing stamp or one from the future.
 */
export function mailDateAge(timestamp: number | string | undefined | null, now: number = Date.now()): string {
  const n = stamp(timestamp);
  if (n === null) return "";
  const elapsed = now - n;
  // A sender's clock a little ahead still reads "just now".
  if (elapsed < MINUTE) return elapsed > -5 * MINUTE ? "just now" : "";
  if (elapsed < HOUR) return count(Math.floor(elapsed / MINUTE), "minute");
  const then = new Date(n);
  const ref = new Date(now);
  const days = calendarDaysBetween(then, ref);
  if (days <= 0) return count(Math.floor(elapsed / HOUR), "hour");
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return count(Math.floor(days / 7), "week");
  const months =
    (ref.getFullYear() - then.getFullYear()) * 12 +
    ref.getMonth() -
    then.getMonth() -
    (ref.getDate() < then.getDate() ? 1 : 0);
  if (months < 12) return count(Math.max(1, months), "month");
  return count(Math.floor(months / 12), "year");
}

/** The detail behind a date: "Sunday, 2 August 2026, 08:58:20 (2 months ago)". */
export function mailDateDetail(timestamp: number | string | undefined | null, now: number = Date.now()): string {
  const full = exactMailDate(timestamp);
  if (!full) return "";
  const age = mailDateAge(timestamp, now);
  return age ? `${full} (${age})` : full;
}

/** Minimal HTML escaping for values interpolated into the forward header. */
export function escapeHtmlText(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
