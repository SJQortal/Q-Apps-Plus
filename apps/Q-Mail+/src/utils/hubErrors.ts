/**
 * What `qortalRequest` rejects with depends on who answered (checked against
 * Hub's source, Qortal-Hub/src/qortal/qortal-requests.ts and get.ts, and
 * Core's q-apps.js):
 *
 * - Core errors are `{ error: number, message }`;
 * - Hub UI errors `{ error: string, message }` (the same string twice);
 * - SAVE_FILE a bare string;
 * - Core's own timeout the string "The request timed out" (q-apps.js), Hub's
 *   `{ error: 'timeout', message: 'Request timed out after 30000 ms (action: …)' }`
 *   (MessagesToBackground.tsx: 30 s for everything but publishes);
 * - Hub's Cancel on a publish resolves (!) with `{ error: { cancelled: true } }`.
 *
 * Adapted from Q-Share+ (apps/Q-Share+/src/utils/hubErrors.ts).
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
// roots (Qortal-Hub/src/i18n/locales/*/question.json), plus English "cancel".
const DECLINE = /declin|cancel|rechaz|refus|ablehn|abgelehnt|отклон|拒否|拒绝|kieltäyt|keeldus|rifiut|recus|رفض/i;

/** True when the user said no (or cancelled) in a Hub dialog: stay quiet, it is not an error. */
export function isHubDecline(error: unknown): boolean {
  const e = error as { error?: { cancelled?: unknown } } | null;
  if (e && typeof e === "object" && e.error && typeof e.error === "object" && e.error.cancelled) return true;
  return DECLINE.test(errorMessage(error, ""));
}

/** Every string Hub put on the error (`error` and `message` can differ), joined. */
function allText(error: unknown): string {
  if (typeof error === "string") return error;
  const e = error as { error?: unknown; message?: unknown } | null;
  return [e?.error, e?.message].filter((v): v is string => typeof v === "string").join(" ");
}

/** True for q-apps.js's own timeout and Hub's "Request timed out after … ms" (either field). */
export function isHubTimeout(error: unknown): boolean {
  return /timed out/i.test(allText(error));
}

// Hub's no_action_public_node string in its twelve languages
// (get.ts getListItems/addListItems/deleteListItems throw it on a gateway node).
const PUBLIC_NODE =
  /public node|öffentlichen node|nodo p[uú]b+lico|avaliku|julkisen solmun|n[oœ]e?ud public|パブリックノード|nó público|публичн|公共节点|نود عام/i;

/**
 * True when Hub refused the action because the node is a public one (GO's
 * default): lists (blocks, follows) can't be read or changed there. Show a
 * quiet "not available" line, never a red error.
 */
export function isPublicNodeRefusal(error: unknown): boolean {
  return PUBLIC_NODE.test(errorMessage(error, ""));
}

/**
 * Hub answers every failed GET_USER_ACCOUNT, a declined Authenticate dialog
 * included, with this one English string (qortal-requests.ts, the
 * GET_USER_ACCOUNT case). It says no more than a decline does.
 */
export function isAccountRefusal(error: unknown): boolean {
  return /unable to (get|fetch) user account/i.test(errorMessage(error, ""));
}

/**
 * Hub answers a dialog-backed request with a timeout after 30 s
 * (MessagesToBackground.tsx) but leaves its dialog up for 60 s
 * (get.ts getUserPermission) and applies a late Accept anyway. Check again
 * after this long, when the dialog is gone either way.
 */
export const HUB_DIALOG_GRACE_MS = 35_000;
