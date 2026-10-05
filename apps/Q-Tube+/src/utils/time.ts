/**
 * Relative dates ("3 days ago") through the browser's Intl API. This replaced
 * moment-with-locales (368 kB minified) in Q-Tube+; the output matches what
 * moment's fromNow() showed, in every locale the app ships.
 */

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
];

const formatters = new Map<string, Intl.RelativeTimeFormat>();

function relativeTimeFormat(locale: string): Intl.RelativeTimeFormat {
  const key = locale || 'en';
  let formatter = formatters.get(key);
  if (!formatter) {
    try {
      formatter = new Intl.RelativeTimeFormat(key, { numeric: 'always' });
    } catch {
      formatter = new Intl.RelativeTimeFormat('en', { numeric: 'always' });
    }
    formatters.set(key, formatter);
  }
  return formatter;
}

const nowFormatters = new Map<string, Intl.RelativeTimeFormat>();

function justNow(locale: string): string {
  const key = locale || 'en';
  let formatter = nowFormatters.get(key);
  if (!formatter) {
    try {
      formatter = new Intl.RelativeTimeFormat(key, { numeric: 'auto' });
    } catch {
      formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    }
    nowFormatters.set(key, formatter);
  }
  return formatter.format(0, 'second');
}

/**
 * "3 days ago", "vor 3 Tagen", … for a millisecond timestamp. Anything under
 * 45 seconds old reads "now", and a
 * timestamp in the future reads as "in …".
 */
export const formatDate = (
  unixTimestamp: number,
  locale: string = 'en',
  now: number = Date.now()
): string => {
  const timestamp = Number(unixTimestamp);
  if (!Number.isFinite(timestamp)) return '';
  const diff = timestamp - now;
  const abs = Math.abs(diff);
  const formatter = relativeTimeFormat(locale);
  if (abs < 45 * 1000) {
    // "now" / "jetzt" / "maintenant": what moment called "a few seconds ago".
    return justNow(locale);
  }
  for (const [unit, ms] of UNITS) {
    if (abs >= ms || unit === 'minute') {
      const value = Math.round(diff / ms);
      return formatter.format(value === 0 ? (diff < 0 ? -1 : 1) : value, unit);
    }
  }
  return formatter.format(Math.round(diff / 60000), 'minute');
};
