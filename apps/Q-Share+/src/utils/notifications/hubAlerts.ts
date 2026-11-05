/**
 * Alerts from Qortal Hub while Q-Share+ is closed (Hub's NOTIFICATION_* API).
 *
 * Hub keeps rules per account and hands them to its node, which pushes an
 * event when a brand-new QDN resource matches one; Hub shows it in its bell
 * and as a system notification, whether or not the app is open (desktop; GO
 * only while it keeps running). Re-publishing an existing resource never
 * matches, so adding a share to an existing collection can't raise an alert:
 * collection adds wait for the in-app list.
 *
 * Rules (identifier filters, so comments written in the original Q-Share
 * match too):
 * - one per share, for its comments: `qcomment_v1_qshare_<key>_` as a prefix;
 * - one per comment of yours, for replies to it: `_reply_<last 6>_` anywhere.
 * Hub sends every app's rules to the node in one message, so the newest
 * HUB_SHARE_RULES shares and HUB_REPLY_RULES comments get one.
 *
 * Hub stores the rules between sessions; the app re-sends them only when they
 * changed (a new share or comment), so the permission banner never shows on
 * its own. Links use paths only: Hub's fallback (reloading the app at the
 * link) breaks on `#` and `?`.
 */
import { QSHARE_COMMENT_BASE } from "../../constants/Identifiers";
import { REPLY_KEY_LENGTH, shareCommentKey, type Activity } from "./activity";
import { HUB_DIALOG_GRACE_MS, isHubTimeout } from "../hubErrors";

export const HUB_SHARE_RULES = 30;
export const HUB_REPLY_RULES = 20;
/** The published app's name, written literally: Hub never decodes `%2B` in app names. */
export const HUB_APP_NAME = "Q-Share+";
/** How long to wait for Hub to answer whether it has the API at all. */
export const HUB_PROBE_TIMEOUT_MS = 5_000;
const STORAGE_PREFIX = "qshareplus-hub-alerts-";
const TITLE_MAX = 60;

export interface HubRule {
  notificationId: string;
  link: string;
  image: string;
  message: { en: string };
  filters: {
    service: "BLOG_COMMENT";
    identifier: string;
    prefix?: boolean;
    excludeBlocked: boolean;
  };
}

interface HubAlertsRecord {
  enabled: boolean;
  /** Ids of the rules Hub has from us. */
  registered: string[];
  /** The rules as last sent, to skip sending the same again. */
  signature: string;
}

const EMPTY: HubAlertsRecord = { enabled: false, registered: [], signature: "" };

export function readHubAlerts(address: string): HubAlertsRecord {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_PREFIX + address) ?? "null");
    if (!raw || typeof raw !== "object") return EMPTY;
    return {
      enabled: raw.enabled === true,
      registered: Array.isArray(raw.registered) ? raw.registered.filter((i: unknown) => typeof i === "string") : [],
      signature: typeof raw.signature === "string" ? raw.signature : "",
    };
  } catch {
    return EMPTY;
  }
}

function writeHubAlerts(address: string, record: HubAlertsRecord): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + address, JSON.stringify(record));
  } catch {
    /* blocked storage: the rules still work in Hub */
  }
}

const enc = encodeURIComponent;
const shorten = (title: string) => (title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX - 1)}…` : title);
const AVATAR = "/arbitrary/THUMBNAIL/{name}/qortal_avatar?async=true";

/** The rules for an account's newest shares and comments. */
export function buildHubRules(activity: Activity): HubRule[] {
  const shares = [...activity.shares.values()].sort((a, b) => b.created - a.created).slice(0, HUB_SHARE_RULES);
  const comments = [...activity.comments.values()].sort((a, b) => b.created - a.created).slice(0, HUB_REPLY_RULES);
  return [
    ...shares.map((share): HubRule => {
      const key = shareCommentKey(share.identifier);
      const title = share.title.trim();
      return {
        notificationId: `qshare-c-${key}`,
        link: `qortal://APP/${HUB_APP_NAME}/share/${enc(share.name)}/${enc(share.identifier)}/comments`,
        image: AVATAR,
        message: {
          en: title ? `{name} commented on your share “${shorten(title)}”` : "{name} commented on your share",
        },
        filters: {
          service: "BLOG_COMMENT",
          identifier: `${QSHARE_COMMENT_BASE}${key}_`,
          prefix: true,
          excludeBlocked: true,
        },
      };
    }),
    ...comments.map((comment): HubRule => {
      const key = comment.identifier.slice(-REPLY_KEY_LENGTH);
      return {
        notificationId: `qshare-r-${key}`,
        link: `qortal://APP/${HUB_APP_NAME}/comment/{name}/{identifier}`,
        image: AVATAR,
        message: { en: "{name} replied to your comment" },
        filters: { service: "BLOG_COMMENT", identifier: `_reply_${key}_`, excludeBlocked: true },
      };
    }),
  ];
}

/** Whether this Hub has the notification API: it answers NOTIFICATION_HAS_PERMISSION at all. */
export async function hubAlertsAvailable(): Promise<boolean> {
  try {
    const answer = await qortalRequestWithTimeout({ action: "NOTIFICATION_HAS_PERMISSION" }, HUB_PROBE_TIMEOUT_MS);
    return typeof answer === "boolean";
  } catch {
    return false;
  }
}

/** Hub's stored answer: true or false, or null when Hub didn't answer at all. */
async function hasPermission(): Promise<boolean | null> {
  try {
    return (await qortalRequest({ action: "NOTIFICATION_HAS_PERMISSION" })) === true;
  } catch {
    return null;
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Hub's permission for this session (NOTIFICATION_ADD needs it each session).
 * Silent when the user allowed it before; otherwise Hub slides down a banner.
 * The request times out after 30 s while the banner stays up for 60, and a
 * late Allow still counts: after a timeout, ask again once the banner is gone.
 */
async function askPermission(): Promise<boolean> {
  try {
    return (await qortalRequest({ action: "NOTIFICATION_PERMISSION" })) === true;
  } catch (error) {
    if (!isHubTimeout(error)) return false; // the user said no
    await wait(HUB_DIALOG_GRACE_MS);
    return (await hasPermission()) === true;
  }
}

async function send(address: string, rules: HubRule[], previous: HubAlertsRecord): Promise<void> {
  const ids = rules.map((rule) => rule.notificationId);
  if (rules.length) await qortalRequest({ action: "NOTIFICATION_ADD", notifications: rules });
  const stale = previous.registered.filter((id) => !ids.includes(id));
  if (stale.length) await qortalRequest({ action: "NOTIFICATION_REMOVE", notificationIds: stale });
  writeHubAlerts(address, { enabled: true, registered: ids, signature: JSON.stringify(rules) });
}

/**
 * Turn Hub alerts on: ask for permission (Hub shows its banner), then send the
 * rules. Resolves false when the user said no or Hub didn't answer.
 */
export async function enableHubAlerts(address: string, activity: Activity): Promise<boolean> {
  if (!(await askPermission())) return false;
  await send(address, buildHubRules(activity), readHubAlerts(address));
  return true;
}

/**
 * Turn them off: take our rules out of Hub. The record is cleared only once
 * Hub has removed them, so a failed removal can be tried again.
 */
export async function disableHubAlerts(address: string): Promise<void> {
  const record = readHubAlerts(address);
  if (record.registered.length) {
    await qortalRequest({ action: "NOTIFICATION_REMOVE", notificationIds: record.registered });
  }
  writeHubAlerts(address, EMPTY);
}

/**
 * Bring Hub's rules up to date when they changed (a new share or comment).
 * Nothing at all when alerts are off or nothing changed. If the user took the
 * permission back in Hub, alerts are switched off here too.
 */
export async function syncHubAlerts(address: string, activity: Activity): Promise<"off" | "unchanged" | "sent"> {
  const record = readHubAlerts(address);
  if (!record.enabled) return "off";
  const rules = buildHubRules(activity);
  if (JSON.stringify(rules) === record.signature) return "unchanged";
  const permitted = await hasPermission();
  // Taken back in Hub (which removed the rules itself): off here too. No answer: try next time.
  if (permitted === false) {
    writeHubAlerts(address, EMPTY);
    return "off";
  }
  if (permitted === null) return "unchanged";
  if (!(await askPermission())) return "unchanged";
  await send(address, rules, record);
  return "sent";
}

/** The in-app list was seen: mark this app's alerts in Hub's bell as seen too. */
export async function markHubAlertsSeen(address: string): Promise<void> {
  const record = readHubAlerts(address);
  if (!record.enabled || !record.registered.length) return;
  try {
    await qortalRequest({ action: "NOTIFICATION_MARK_SEEN", notificationIds: record.registered });
  } catch {
    /* an older Hub without it: nothing to mark */
  }
}
