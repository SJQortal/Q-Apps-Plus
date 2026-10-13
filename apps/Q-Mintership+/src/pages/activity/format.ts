/**
 * Activity's numbers in words: blocks become time at the live block time,
 * shares become whole percentages, and nothing shows as NaN.
 */
import { heightToTime, type ChainNow } from '../../data/chain';
import { formatCount, formatDate, formatRelative } from '../../utils/format';

export const NONE = '—';

/** "87%", or a dash when there was nothing to count. */
export function percent(value: number | null): string {
  return value === null ? NONE : `${Math.round(value * 100)}%`;
}

/** "45 min", "1 hour", "2.3 hours", "18 hours", "1.4 days", "6 days": short enough for a table cell. */
export function compactDuration(ms: number): string {
  const minutes = ms / 60_000;
  if (minutes < 1) return 'under a minute';
  if (minutes < 59.5) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 47.5) return amount(hours, 'hour');
  return amount(hours / 24, 'day');
}

/** One decimal under 10 ("2.3 hours"), whole numbers above; "1 hour", never "1.0 hours". */
function amount(value: number, unit: string): string {
  const text = value < 9.95 ? value.toFixed(1).replace(/\.0$/, '') : String(Math.round(value));
  return `${text} ${unit}${text === '1' ? '' : 's'}`;
}

/** A number of blocks as time at the measured pace, or a dash. */
export function blocksAsTime(blocks: number | null, now: Pick<ChainNow, 'msPerBlock'>): string {
  return blocks === null ? NONE : compactDuration(blocks * now.msPerBlock);
}

/** The date a block was made (estimated from the tip and the block time). */
export function blockDate(height: number, now: ChainNow): string {
  return formatDate(heightToTime(now, height));
}

/** "2 days ago", or a plain note when nothing happened in the window. */
export function lastActive(height: number | null, now: ChainNow): string {
  return height === null ? 'None in this window' : formatRelative(heightToTime(now, height));
}

/** "12 of 15". */
export function ofTotal(part: number, total: number): string {
  return `${formatCount(part)} of ${formatCount(total)}`;
}

/** "in the last 30 days" or "in this range". */
export function windowWords(days: number | null): string {
  return days ? `in the last ${days} days` : 'in this range';
}

/** "72.9 s". */
export function blockTimeWords(now: Pick<ChainNow, 'msPerBlock'>): string {
  return `${(now.msPerBlock / 1000).toFixed(1)} s`;
}

/** Progress rounded down to a quarter (0, 25, 50, 75), so a live region changes rarely. */
export function quarterDone(done: number, total: number): number {
  if (!total) return 0;
  return Math.min(75, Math.floor((done / total) * 4) * 25);
}
