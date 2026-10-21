/**
 * What `qortalRequest` rejects with depends on who answered: Core errors are
 * `{ error: number, message }`, Hub UI errors `{ error: string, message }`,
 * SAVE_FILE a bare string, timeouts the string "The request timed out", and
 * Hub's Cancel on a publish `{ error: { cancelled: true } }`.
 */

/** A readable message from any of those shapes, or `fallback`. */
export function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") return error || fallback;
  const e = error as { error?: unknown; message?: unknown } | null;
  if (typeof e?.error === "string") return e.error || fallback;
  if (typeof e?.message === "string") return e.message || fallback;
  return fallback;
}

// Hub's user_declined_* strings in all twelve of its languages share these
// roots (checked against Hub's locales, 108 strings), plus English "cancel".
const DECLINE = /declin|cancel|rechaz|refus|ablehn|abgelehnt|отклон|拒否|拒绝|kieltäyt|keeldus|rifiut|recus|رفض/i;

/** True when the user said no (or cancelled) in a Hub dialog: stay quiet, it is not an error. */
export function isHubDecline(error: unknown): boolean {
  const e = error as { error?: { cancelled?: unknown } } | null;
  if (e && typeof e === "object" && e.error && typeof e.error === "object" && e.error.cancelled) return true;
  return DECLINE.test(errorMessage(error, ""));
}

/** True for qortalRequest's own timeout and Hub's "Request timed out after … ms". */
export function isHubTimeout(error: unknown): boolean {
  return /timed out/i.test(errorMessage(error, ""));
}

/**
 * Hub answers a dialog-backed request with a timeout after 30 s but leaves its
 * dialog up for 60 s, and applies a late Accept anyway. Check again after this
 * long, when the dialog is gone either way.
 */
export const HUB_DIALOG_GRACE_MS = 35_000;
