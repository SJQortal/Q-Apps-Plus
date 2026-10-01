/**
 * The notification list, per account, kept on this device (localStorage
 * `qshareplus-notifications-<address>`). Nothing here goes to QDN.
 */
import { useSyncExternalStore } from "react";

export const NOTIFICATIONS_STORAGE_PREFIX = "qshareplus-notifications-";
export const MAX_ITEMS = 100;
const MAX_SEEN = 1000;

export type NotificationKind = "comment" | "reply" | "collection";

export interface ResourceRef {
  name: string;
  identifier: string;
  title?: string;
}

export interface AppNotification {
  /** Stable: the same event never becomes two notifications. */
  id: string;
  /** comment: on your share. reply: to your comment. collection: your share added to one. */
  kind: NotificationKind;
  /** Who commented or added. */
  actor: string;
  time: number;
  read: boolean;
  /** The share it is about, when known. */
  share?: ResourceRef;
  /** The comment (comment and reply). */
  comment?: ResourceRef;
  /** The collection (collection). */
  collection?: ResourceRef;
}

export interface NotificationState {
  items: AppNotification[];
  /** Comments first published before this were looked at (ms); 0 before the first check. */
  commentsCheckedTo: number;
  /** Ids already turned into notifications, or passed over (your own, hidden names). */
  seen: string[];
  /** Collection versions already read: "name/identifier" → its `updated` time. */
  collectionVersions: Record<string, number>;
  /** When the last check finished (ms); 0 before the first. */
  lastCheck: number;
}

export const EMPTY_STATE: NotificationState = {
  items: [],
  commentsCheckedTo: 0,
  seen: [],
  collectionVersions: {},
  lastCheck: 0,
};

const storageKey = (address: string) => `${NOTIFICATIONS_STORAGE_PREFIX}${address}`;
const cache = new Map<string, NotificationState>();
const listeners = new Set<() => void>();

function sanitize(raw: unknown): NotificationState {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof NotificationState, unknown>>;
  const isRef = (v: unknown): v is ResourceRef =>
    !!v &&
    typeof v === "object" &&
    typeof (v as ResourceRef).name === "string" &&
    typeof (v as ResourceRef).identifier === "string";
  const items = Array.isArray(r.items)
    ? r.items.filter(
        (i): i is AppNotification =>
          !!i &&
          typeof i === "object" &&
          typeof (i as AppNotification).id === "string" &&
          ["comment", "reply", "collection"].includes((i as AppNotification).kind) &&
          typeof (i as AppNotification).actor === "string" &&
          typeof (i as AppNotification).time === "number" &&
          (!("share" in i) || (i as AppNotification).share === undefined || isRef((i as AppNotification).share))
      )
    : [];
  return {
    items: items.map((i) => ({ ...i, read: Boolean(i.read) })).slice(0, MAX_ITEMS),
    commentsCheckedTo: typeof r.commentsCheckedTo === "number" ? r.commentsCheckedTo : 0,
    seen: Array.isArray(r.seen) ? r.seen.filter((s): s is string => typeof s === "string").slice(-MAX_SEEN) : [],
    collectionVersions:
      r.collectionVersions && typeof r.collectionVersions === "object"
        ? Object.fromEntries(
            Object.entries(r.collectionVersions as Record<string, unknown>).filter(
              (e): e is [string, number] => typeof e[1] === "number"
            )
          )
        : {},
    lastCheck: typeof r.lastCheck === "number" ? r.lastCheck : 0,
  };
}

export function readNotifications(address: string): NotificationState {
  const hit = cache.get(address);
  if (hit) return hit;
  let state = EMPTY_STATE;
  try {
    const raw = localStorage.getItem(storageKey(address));
    state = raw ? sanitize(JSON.parse(raw)) : EMPTY_STATE;
  } catch {
    state = EMPTY_STATE;
  }
  cache.set(address, state);
  return state;
}

export function writeNotifications(address: string, next: NotificationState): void {
  const state: NotificationState = {
    ...next,
    items: [...next.items].sort((a, b) => b.time - a.time).slice(0, MAX_ITEMS),
    seen: next.seen.slice(-MAX_SEEN),
  };
  cache.set(address, state);
  try {
    localStorage.setItem(storageKey(address), JSON.stringify(state));
  } catch {
    /* storage full or blocked: the list still works for this visit */
  }
  for (const listener of listeners) listener();
}

export function markAllRead(address: string): void {
  const state = readNotifications(address);
  if (!state.items.some((i) => !i.read)) return;
  writeNotifications(address, { ...state, items: state.items.map((i) => ({ ...i, read: true })) });
}

export function markRead(address: string, id: string): void {
  const state = readNotifications(address);
  if (!state.items.some((i) => i.id === id && !i.read)) return;
  writeNotifications(address, { ...state, items: state.items.map((i) => (i.id === id ? { ...i, read: true } : i)) });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    // Another tab of the app changed the list.
    if (event.key?.startsWith(NOTIFICATIONS_STORAGE_PREFIX)) {
      cache.delete(event.key.slice(NOTIFICATIONS_STORAGE_PREFIX.length));
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The account's notification state, kept current. Empty with no address. */
export function useNotificationState(address: string | undefined): NotificationState {
  return useSyncExternalStore(subscribe, () => (address ? readNotifications(address) : EMPTY_STATE));
}

/** For tests. */
export function resetNotificationStore(): void {
  cache.clear();
}
