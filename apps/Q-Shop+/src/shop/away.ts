/**
 * A seller away for a while (a holiday, a fair): the shop says so, and when
 * orders will be dispatched again, on its page, its products and at checkout,
 * so a buyer knows before paying. Buying stays open (a seller who wants no
 * orders marks products out of stock). In the shop's JSON as
 * `away: {until?, note?}` (additive), `until` a day (ms, local midnight);
 * past that day it no longer shows.
 */
export interface Away {
  /** The day the seller is back, at local midnight (ms). */
  until?: number;
  note?: string;
}

export const MAX_AWAY_NOTE = 200;
const DAY = 86_400_000;

/** The shop's away notice while it holds (until its day has passed), else null. */
export function awayOf(shop: { away?: unknown } | null | undefined, now = Date.now()): Away | null {
  const raw = shop?.away as { until?: unknown; note?: unknown } | undefined;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const until = typeof raw.until === "number" && Number.isFinite(raw.until) && raw.until > 0 ? raw.until : undefined;
  // Back on that day: the notice holds until the day is over.
  if (until !== undefined && now >= until + DAY) return null;
  const note = typeof raw.note === "string" && raw.note.trim() ? raw.note.trim().slice(0, MAX_AWAY_NOTE) : undefined;
  return { ...(until !== undefined && { until }), ...(note && { note }) };
}

/** "Away until 3 November: orders are dispatched after that." */
export function awayText(away: Away, locale?: string): string {
  if (!away.until) return "Away for now: orders are dispatched once the seller is back.";
  const day = new Date(away.until).toLocaleDateString(locale, { day: "numeric", month: "long" });
  return `Away until ${day}: orders are dispatched after that.`;
}

/** "2026-11-03" (a date field's value) as local midnight in ms, or undefined. */
export function dayFromInput(text: string): number | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!m) return undefined;
  const ms = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  return Number.isFinite(ms) ? ms : undefined;
}

/** Local midnight in ms as a date field's value. */
export function dayToInput(ms: number | undefined): string {
  if (!ms) return "";
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** What a form gives: an away notice, or null (the field then goes from the shop). */
export function awayForPublish(values: { away: boolean; awayUntil: string; awayNote: string }): Away | null {
  if (!values.away) return null;
  const until = dayFromInput(values.awayUntil);
  const note = values.awayNote.trim().slice(0, MAX_AWAY_NOTE);
  return { ...(until !== undefined && { until }), ...(note && { note }) };
}
