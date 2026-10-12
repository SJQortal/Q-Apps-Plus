/**
 * Which of the user's names the mailboxes list under Inbox. Two local
 * choices, per account, on this device only (nothing is published):
 * - names hidden by hand (the name's menu in the mailboxes, "Hide from the
 *   list"; Settings → Mail lists them to show again):
 *   `qmail_hidden_inbox_names_<address>` = JSON array of lower-cased names;
 * - "Hide names with nothing in the inbox" (Settings → Mail, off by default):
 *   `qmail_hide_empty_inbox_names_<address>` = "true" while on.
 *
 * Only the list of names changes: a hidden name's mail stays in the combined
 * Inbox, and its own inbox opens again once it is shown.
 */
import { useEffect, useState } from "react";

export const HIDDEN_INBOX_NAMES_PREFIX = "qmail_hidden_inbox_names_";
export const HIDE_EMPTY_INBOX_NAMES_PREFIX = "qmail_hide_empty_inbox_names_";
/** Fired on window when either choice changes, so the mailboxes follow at once. */
export const INBOX_NAMES_CHANGED_EVENT = "qmail-inbox-names-changed";

const normalizeAddress = (address?: string | null): string => (typeof address === "string" ? address.trim() : "");
const normalizeName = (name: string): string => name.trim().toLowerCase();

const keyFor = (prefix: string, address?: string | null): string => {
  const normalized = normalizeAddress(address);
  return normalized ? `${prefix}${normalized}` : "";
};

// Where storage is blocked, the choices of this session.
const sessionValues = new Map<string, string | null>();

/** Tests only: forget this session's choices. */
export const resetInboxNamesSession = (): void => {
  sessionValues.clear();
};

const read = (key: string): string | null => {
  if (sessionValues.has(key)) return sessionValues.get(key) ?? null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string | null): void => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    sessionValues.delete(key);
  } catch {
    sessionValues.set(key, value);
  }
  try {
    window.dispatchEvent(new CustomEvent(INBOX_NAMES_CHANGED_EVENT));
  } catch {
    // No window (tests without a DOM).
  }
};

/** Lower-cased names hidden by hand. */
export const readHiddenInboxNames = (address?: string | null): string[] => {
  const key = keyFor(HIDDEN_INBOX_NAMES_PREFIX, address);
  if (!key) return [];
  try {
    const parsed = JSON.parse(read(key) || "[]");
    return Array.isArray(parsed) ? parsed.filter((name): name is string => typeof name === "string" && Boolean(name)) : [];
  } catch {
    return [];
  }
};

export const setInboxNameHidden = (address: string | null | undefined, name: string, hidden: boolean): void => {
  const key = keyFor(HIDDEN_INBOX_NAMES_PREFIX, address);
  const normalized = normalizeName(name);
  if (!key || !normalized) return;
  const current = readHiddenInboxNames(address).filter(entry => entry !== normalized);
  const next = hidden ? [...current, normalized] : current;
  write(key, next.length ? JSON.stringify(next) : null);
};

export const readHideEmptyInboxNames = (address?: string | null): boolean => {
  const key = keyFor(HIDE_EMPTY_INBOX_NAMES_PREFIX, address);
  return Boolean(key) && read(key) === "true";
};

export const writeHideEmptyInboxNames = (address: string | null | undefined, hide: boolean): void => {
  const key = keyFor(HIDE_EMPTY_INBOX_NAMES_PREFIX, address);
  if (key) write(key, hide ? "true" : null);
};

export interface InboxNamesPreference {
  /** Lower-cased names hidden by hand. */
  hidden: string[];
  hideEmpty: boolean;
}

/** Both choices for this account, following changes from Settings, the mailboxes and other tabs. */
export function useInboxNamesPreference(address?: string | null): InboxNamesPreference {
  const readAll = (): InboxNamesPreference => ({
    hidden: readHiddenInboxNames(address),
    hideEmpty: readHideEmptyInboxNames(address),
  });
  const [value, setValue] = useState(readAll);
  useEffect(() => {
    const refresh = () =>
      setValue(previous => {
        const next = readAll();
        return next.hideEmpty === previous.hideEmpty && next.hidden.join("\n") === previous.hidden.join("\n") ? previous : next;
      });
    refresh();
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith(HIDDEN_INBOX_NAMES_PREFIX) || event.key.startsWith(HIDE_EMPTY_INBOX_NAMES_PREFIX)) {
        refresh();
      }
    };
    window.addEventListener(INBOX_NAMES_CHANGED_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(INBOX_NAMES_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
    // readAll reads `address` only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);
  return value;
}

/**
 * The names to list under Inbox: the hidden ones out, and with `hideEmpty`
 * the ones whose inbox has loaded with nothing left in it (all archived).
 * The name being viewed always stays.
 */
export function visibleInboxNames(
  names: string[],
  preference: InboxNamesPreference,
  isEmpty: (name: string) => boolean,
  activeName?: string | null
): string[] {
  const hidden = new Set(preference.hidden);
  const active = activeName ? normalizeName(activeName) : "";
  return names.filter(name => {
    const normalized = normalizeName(name);
    if (normalized === active) return true;
    if (hidden.has(normalized)) return false;
    return !(preference.hideEmpty && isEmpty(name));
  });
}
