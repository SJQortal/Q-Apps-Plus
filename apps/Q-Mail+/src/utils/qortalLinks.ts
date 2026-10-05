/**
 * qortal:// links in message bodies, opened the way Hub opens them.
 *
 * Clicks on qortal:// links can't be left to Core's q-apps.js: it reads
 * every link as SERVICE/name, so on `qortal://use-group/action-join/groupid-N`
 * it asks Core for the status of a "USE-GROUP" resource, gets a 400, throws
 * in JSON.parse before its preventDefault, and the browser follows the link:
 * the whole app frame goes blank (the same happens in the original Q-Mail).
 * In Hub Dev Mode it also falls back to moving the frame to the other app.
 * So the app handles every qortal:// click itself, with the requests Hub
 * offers to apps (checked against Qortal-Hub's source, @16c53b3e):
 *
 * - `qortal://use-group/action-join/groupid-N` → `JOIN_GROUP { groupId }`
 *   (qortal/get.ts joinGroup: Hub fetches the group, shows its name and the
 *   fee, and asks first). Hub's own chat opens its Join Group dialog for the
 *   same link (MessageDisplay.tsx, utils/qortalGroupLinks.ts).
 * - Apps and resources (`qortal://APP/Name/path`, `qortal://SERVICE/name/id`,
 *   `qortal://Name` = a WEBSITE) → `OPEN_NEW_TAB { qortalLink }`
 *   (get.ts openNewTab → Hub's extractComponents → a new tab), which works
 *   in Dev Mode too, where Hub ignores q-apps.js's SET_TAB.
 * - Group calendar links, other `qortal://use-…` actions and payment links
 *   (`qortal://pay?…`) have no app request in Hub: Hub opens them only from
 *   its own chat or its deep-link handler. They are copied, with a line
 *   saying where they open.
 *
 * Nothing here changes the app's location or opens a window.
 */
import { errorMessage, isHubDecline } from "./hubErrors";

/** Hub's own group-link shapes (Qortal-Hub/src/utils/qortalGroupLinks.ts). */
const GROUP_ID = "[1-9]\\d{0,15}";
const EVENT_ID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const JOIN_LINK = new RegExp(`^qortal://use-group/action-join/groupid-(${GROUP_ID})$`, "i");
const CALENDAR_LINK = new RegExp(`^qortal://use-group/action-calendar/groupid-(${GROUP_ID})/eventid-(${EVENT_ID})$`, "i");

/** Hub's SERVICE_PATTERN (Qortal-Hub/src/utils/qappPath.ts). */
const SERVICE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

/** Characters a registered name can never hold once decoded: they would change which resource loads. */
// eslint-disable-next-line no-control-regex
const NAME_BREAKERS = /[/\\?#\u0000-\u001f\u007f]/;

export type QortalLink =
  | { kind: "join"; link: string; groupId: number }
  | { kind: "calendar"; link: string; groupId: number; eventId: string }
  /** Any other qortal://use-… action (Hub opens these only from its own screens). */
  | { kind: "action"; link: string }
  | { kind: "payment"; link: string }
  /** An app or resource; `link` is the form Hub's own Copy link writes (spaces as %20, + as it is). */
  | { kind: "resource"; link: string; service: string; name: string }
  | { kind: "invalid"; link: string };

/** Trailing sentence punctuation is not part of a link (Hub's chat strips the same set). */
export function stripTrailingPunctuation(value: string): string {
  return value.replace(/[),.;!?]+$/, "");
}

function decodeOnce(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/**
 * The name as Hub writes it in a link: decoded once (so "Q-Share%2B" and
 * "Simon%20James" read as their names), then only spaces written as %20.
 * Hub GO decodes the segment once and older Hubs not at all, and both read
 * this form the same. Null when the name is empty or could leave the
 * resource ("..", "/", "?", "#", "\").
 */
function linkName(segment: string): { name: string; written: string } | null {
  const decoded = decodeOnce(segment);
  if (decoded === null) return null;
  const name = decoded.trim();
  if (!name || name === "." || name === ".." || NAME_BREAKERS.test(name)) return null;
  // A literal % would be decoded again by Hub GO: keep the sender's spelling.
  if (name.includes("%")) return { name, written: segment };
  return { name, written: name.replace(/ /g, "%20") };
}

/** True when a path holds a "." or ".." segment in any spelling (Hub refuses those). */
function climbsOut(path: string): boolean {
  const pathname = path.split(/[?#]/, 1)[0];
  return pathname.split("/").some((segment) => {
    const decoded = decodeOnce(segment) ?? segment;
    return decoded === "." || decoded === ".." || decoded.includes("\\");
  });
}

/** What a qortal:// link points at, or null for anything that is not a qortal:// link. */
export function parseQortalLink(raw: string | null | undefined): QortalLink | null {
  const trimmed = stripTrailingPunctuation(String(raw ?? "").trim());
  if (!/^qortal:\/\//i.test(trimmed)) return null;
  const rest = trimmed.slice("qortal://".length).replace(/ /g, "%20");
  const link = `qortal://${rest}`;

  const join = JOIN_LINK.exec(link);
  if (join) return { kind: "join", link, groupId: Number(join[1]) };
  const calendar = CALENDAR_LINK.exec(link);
  if (calendar) return { kind: "calendar", link, groupId: Number(calendar[1]), eventId: calendar[2].toLowerCase() };
  if (/^use-/i.test(rest)) return { kind: "action", link };
  if (/^(?:pay|send)\?/i.test(rest)) return { kind: "payment", link };

  const slash = rest.indexOf("/");
  const queryOrHash = rest.search(/[?#]/);
  const nameOnly = slash === -1 || (queryOrHash !== -1 && queryOrHash < slash);
  let service = "WEBSITE";
  let after = rest;
  if (!nameOnly) {
    service = rest.slice(0, slash);
    after = rest.slice(slash + 1);
    if (!SERVICE.test(service)) return { kind: "invalid", link };
  }
  const nameEnd = after.search(nameOnly ? /[?#]/ : /[/?#]/);
  const segment = nameEnd === -1 ? after : after.slice(0, nameEnd);
  const tail = nameEnd === -1 ? "" : after.slice(nameEnd);
  const name = linkName(segment);
  if (!name || climbsOut(tail)) return { kind: "invalid", link };
  const written = nameOnly ? `qortal://${name.written}${tail}` : `qortal://${service}/${name.written}${tail}`;
  return { kind: "resource", link: written, service: service.toUpperCase(), name: name.name };
}

/** A short description for the link's title (hover and screen readers). */
export function describeQortalLink(target: QortalLink): string {
  switch (target.kind) {
    case "join":
      return `Join group ${target.groupId} (Hub asks first)`;
    case "calendar":
      return "Group calendar event: opens in Hub's group chat. Click to copy the link";
    case "action":
      return "Hub opens this link only from its own screens. Click to copy it";
    case "payment":
      return "Payment link. Click to copy it";
    case "resource":
      return target.service === "APP" || target.service === "WEBSITE"
        ? `Open ${target.name} in a new tab`
        : `Open ${target.name}'s ${target.service.toLowerCase()} in a new tab`;
    case "invalid":
      return "Not a complete Qortal link";
  }
}

export type LinkOutcome = { alertType: "success" | "error" | "info"; msg: string } | null;

type QortalRequest = (request: Record<string, unknown>) => Promise<unknown>;

export interface OpenLinkDeps {
  /** Hub's qortalRequest (the injected global by default). */
  request?: QortalRequest;
  /** Copies text; resolves true when it worked. */
  copy: (text: string) => Promise<boolean>;
}

/** Links whose request is still waiting on Hub: a second click must not open a second dialog. */
const pending = new Set<string>();

function hubRequest(deps: OpenLinkDeps): QortalRequest | null {
  if (deps.request) return deps.request;
  // The bare name, not globalThis.qortalRequest: Hub's q-apps.js declares it
  // with a top-level const, which never becomes a window property.
  return typeof qortalRequest === "function" ? (qortalRequest as unknown as QortalRequest) : null;
}

async function copyWithNote(link: string, note: string, deps: OpenLinkDeps): Promise<LinkOutcome> {
  const copied = await deps.copy(link);
  return copied
    ? { alertType: "info", msg: `${note} Link copied.` }
    : { alertType: "error", msg: `${note} Copying failed. The link is ${link}` };
}

/**
 * Opens a qortal:// link through Hub and says how it went: null when there
 * is nothing to say (a tab opened, the user said no, or the same link is
 * still waiting on Hub).
 */
export async function openQortalLink(raw: string, deps: OpenLinkDeps): Promise<LinkOutcome> {
  const target = parseQortalLink(raw);
  if (!target || target.kind === "invalid") {
    return { alertType: "error", msg: "This Qortal link is incomplete, so Hub can't open it." };
  }
  if (target.kind === "calendar") {
    return copyWithNote(target.link, "Group calendar links open only in Hub's group chat.", deps);
  }
  if (target.kind === "action") {
    return copyWithNote(target.link, "Hub opens this kind of Qortal link only from its own screens.", deps);
  }
  if (target.kind === "payment") {
    return copyWithNote(target.link, "Q-Mail+ doesn't send QORT from links in mail. Check who it pays before you use it.", deps);
  }

  const request = hubRequest(deps);
  if (!request) return { alertType: "error", msg: "Qortal links open only inside Qortal Hub." };
  if (pending.has(target.link)) return null;
  pending.add(target.link);
  try {
    if (target.kind === "join") {
      await request({ action: "JOIN_GROUP", groupId: target.groupId });
      return {
        alertType: "success",
        msg: `Join request for group ${target.groupId} sent. It counts once the transaction confirms (a closed group's admins approve it first).`,
      };
    }
    await request({ action: "OPEN_NEW_TAB", qortalLink: target.link });
    return null;
  } catch (error) {
    if (isHubDecline(error)) return null;
    const fallback = target.kind === "join" ? "Hub couldn't send the join request." : "Hub couldn't open this link.";
    return { alertType: "error", msg: errorMessage(error, fallback) };
  } finally {
    pending.delete(target.link);
  }
}
