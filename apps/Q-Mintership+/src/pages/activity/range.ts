/**
 * Custom ranges for Activity: date inputs in local time, and the checks a
 * range must pass (both dates, in order, not before MINTER, a year at most).
 */
import type { ActivityWindow } from '../../state/settings';
import { formatDate } from '../../utils/format';

export const WINDOW_DAYS: readonly ActivityWindow[] = [30, 60, 90, 180];
export const DAY_MS = 86_400_000;
/** Custom ranges up to a year: longer reads would hit the paging ceiling. */
const MAX_RANGE_DAYS = 366;

export interface CustomRange {
  fromMs: number;
  toMs: number;
}

/** "2026-10-12" in local time, for a date input. */
export function toDateInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A date input's value as local midnight (or the last ms of that day). */
export function fromDateInput(value: string, endOfDay = false): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const start = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + (endOfDay ? 1 : 0));
  const ms = start.getTime() - (endOfDay ? 1 : 0);
  return Number.isFinite(ms) ? ms : null;
}

/** Why a custom range can't be used, or null. */
export function customRangeProblem(
  from: number | null,
  to: number | null,
  limits: { earliest?: number; latest: number }
): string | null {
  if (from === null || to === null) return 'Pick both dates.';
  if (from > to) return 'The start date is after the end date.';
  if (from > limits.latest) return 'The start date is in the future.';
  if (limits.earliest !== undefined && to < limits.earliest)
    return `MINTER started on ${formatDate(limits.earliest)}.`;
  if ((to - from) / DAY_MS > MAX_RANGE_DAYS) return 'Pick a range of a year or less.';
  return null;
}
