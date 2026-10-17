/**
 * Plain, short formatting for people: names before addresses, times in days
 * and hours, numbers with separators. English for now (the original app has
 * no translations).
 */

/** "QfX9Kh…yQyH". */
export function shortAddress(address: string): string {
  if (!address || address.length <= 14) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** A name when there is one, otherwise the short address. */
export function displayName(name: string | null | undefined, address: string): string {
  return name?.trim() || shortAddress(address);
}

const NUMBER = new Intl.NumberFormat('en-US');
/** "618,400". */
export function formatCount(value: number): string {
  return NUMBER.format(Math.round(value));
}

/** "1", "2 days", "3 hours", "5 minutes", "under a minute". `ms` may be negative (treated as 0). */
export function formatDuration(ms: number, options: { precise?: boolean } = {}): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (days >= 2)
    return options.precise && hours
      ? `${plural(days, 'day')} ${plural(hours, 'hour')}`
      : plural(days, 'day');
  if (days === 1) return hours ? `1 day ${plural(hours, 'hour')}` : '1 day';
  if (hours >= 1)
    return minutes && (options.precise || hours < 3)
      ? `${plural(hours, 'hour')} ${plural(minutes, 'minute')}`
      : plural(hours, 'hour');
  if (minutes >= 1) return plural(minutes, 'minute');
  return 'under a minute';
}

/**
 * A long wait in round words: days up to 8 weeks, then months, then years
 * and months ("22 days", "5 months", "1 year 3 months").
 */
export function formatRoughDuration(ms: number): string {
  const days = Math.max(0, ms) / 86_400_000;
  if (days < 56) return formatDuration(ms);
  const months = Math.round(days / 30.44);
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = `${years} year${years === 1 ? '' : 's'}`;
  return rest ? `${y} ${rest} month${rest === 1 ? '' : 's'}` : y;
}

/** "2d 4h", "3h 10m", "12m", "45s": the compact countdown form. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m`;
  return `${seconds}s`;
}

/** "3 days ago", "in 5 hours", "just now". */
export function formatRelative(timestamp: number, now = Date.now()): string {
  const diff = timestamp - now;
  if (Math.abs(diff) < 60_000) return 'just now';
  const text = formatDuration(Math.abs(diff));
  return diff < 0 ? `${text} ago` : `in ${text}`;
}

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
/** "12 Oct 2026". */
export function formatDate(timestamp: number): string {
  return DATE.format(new Date(timestamp));
}
/** "12 Oct 2026, 14:33". */
export function formatDateTime(timestamp: number): string {
  return DATE_TIME.format(new Date(timestamp));
}

/** "block 2,757,500". */
const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

/**
 * From one time to another, as briefly as reads clearly: "16 Oct 2026,
 * 21:36–21:55" within a day, "2 Oct 2026 – 7 Oct 2026" across days.
 */
export function formatTimeSpan(from: number, to: number): string {
  const [low, high] = from <= to ? [from, to] : [to, from];
  if (formatDate(low) === formatDate(high)) {
    const a = TIME.format(new Date(low));
    const b = TIME.format(new Date(high));
    return a === b ? `${formatDate(low)}, ${a}` : `${formatDate(low)}, ${a}–${b}`;
  }
  return `${formatDate(low)} – ${formatDate(high)}`;
}

export function formatBlock(height: number): string {
  return `block ${formatCount(height)}`;
}

/** "1 signature", "8 signatures". */
export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${formatCount(n)} ${n === 1 ? singular : pluralForm}`;
}
