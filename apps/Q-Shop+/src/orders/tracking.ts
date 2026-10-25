/**
 * A shipped order's tracking (Simon, 2026-10-25: a marketplace for the whole
 * world, where parcels cross borders): the carrier and the tracking number,
 * in the seller's encrypted status note as `tracking` (additive). The
 * original shows only the note, so the note carries a "Tracking: …" line
 * too, which this app leaves out of the note it shows (the tracking has its
 * own place, with Copy).
 */
export interface Tracking {
  number: string;
  carrier?: string;
}

/** Carriers offered while typing (any other can be typed). */
export const CARRIERS = [
  "DHL",
  "UPS",
  "FedEx",
  "USPS",
  "Royal Mail",
  "Canada Post",
  "Australia Post",
  "Deutsche Post",
  "La Poste",
  "PostNL",
  "PostNord",
  "Correos",
  "CTT",
  "Poste Italiane",
  "InPost",
  "Omniva",
  "Japan Post",
  "China Post",
  "SF Express",
  "Aramex",
] as const;

export const MAX_TRACKING_NUMBER = 60;
export const MAX_CARRIER = 40;

const clean = (value: unknown, max: number) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** The tracking a status note's JSON carries, or null. */
export function trackingOf(json: unknown): Tracking | null {
  const raw = (json as { tracking?: unknown } | null)?.tracking as { number?: unknown; carrier?: unknown } | undefined;
  if (!raw || typeof raw !== "object") return null;
  const number = clean(raw.number, MAX_TRACKING_NUMBER);
  if (!number) return null;
  const carrier = clean(raw.carrier, MAX_CARRIER);
  return carrier ? { number, carrier } : { number };
}

/** "Tracking: DHL 00340434161234567890". */
export function trackingLine(tracking: Tracking): string {
  return `Tracking: ${tracking.carrier ? `${tracking.carrier} ` : ""}${tracking.number}`;
}

/** The note as published: with the tracking line at its end for the original app, unless it names the number already. */
export function noteWithTracking(note: string, tracking: Tracking | null | undefined): string {
  const text = note.trim();
  if (!tracking || text.includes(tracking.number)) return text;
  return text ? `${text}\n${trackingLine(tracking)}` : trackingLine(tracking);
}

/** The note as this app shows it: without the tracking line it added. */
export function noteWithoutTracking(note: string, tracking: Tracking | null | undefined): string {
  if (!tracking) return note;
  const line = trackingLine(tracking);
  if (note === line) return "";
  return note.endsWith(`\n${line}`) ? note.slice(0, -line.length - 1) : note;
}
