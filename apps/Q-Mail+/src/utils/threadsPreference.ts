/**
 * Settings → Mail → "Show group threads": whether Q-Mail+ shows group
 * threads at all (the rail's Threads section, the bottom bar's Threads item,
 * groups as compose targets, thread drafts). Hidden, nothing about threads is
 * fetched: no per-group activity searches on load and no unread polling.
 *
 * Local to this device, per account: `qmail_show_threads_<address>` = "false"
 * when hidden (the key is removed when shown again, the default). Nothing is
 * published; threads and drafts stay where they are and come back with the
 * switch.
 */
import { useEffect, useState } from "react";

export const SHOW_THREADS_STORAGE_PREFIX = "qmail_show_threads_";
/** Fired on window when the setting changes, so an open mailbox follows at once. */
export const SHOW_THREADS_CHANGED_EVENT = "qmail-show-threads-changed";

const normalizeAddress = (address?: string | null): string =>
  typeof address === "string" ? address.trim() : "";

export const showThreadsStorageKey = (address?: string | null): string => {
  const normalized = normalizeAddress(address);
  return normalized ? `${SHOW_THREADS_STORAGE_PREFIX}${normalized}` : "";
};

// The choices of this session where storage is blocked (a private window,
// blocked site data): without it the switch would read back the default.
const sessionChoices = new Map<string, boolean>();

/** Tests only: forget this session's choices. */
export const resetShowGroupThreadsSession = (): void => {
  sessionChoices.clear();
};

/** True (the default) unless this account hid group threads on this device. */
export const readShowGroupThreads = (address?: string | null): boolean => {
  const key = showThreadsStorageKey(address);
  if (!key) return true;
  const chosen = sessionChoices.get(key);
  if (chosen !== undefined) return chosen;
  try {
    return localStorage.getItem(key) !== "false";
  } catch {
    return true;
  }
};

export const writeShowGroupThreads = (address: string | null | undefined, show: boolean): void => {
  const key = showThreadsStorageKey(address);
  if (!key) return;
  try {
    if (show) localStorage.removeItem(key);
    else localStorage.setItem(key, "false");
    sessionChoices.delete(key);
  } catch {
    // Storage blocked: the choice lasts for this session only.
    sessionChoices.set(key, show);
  }
  try {
    window.dispatchEvent(new CustomEvent(SHOW_THREADS_CHANGED_EVENT, { detail: { address: normalizeAddress(address), show } }));
  } catch {
    // No window (tests without a DOM).
  }
};

/** The setting for this account, following changes from Settings and other tabs. */
export function useShowGroupThreads(address?: string | null): boolean {
  const [show, setShow] = useState(() => readShowGroupThreads(address));
  useEffect(() => {
    const refresh = () => setShow(readShowGroupThreads(address));
    refresh();
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === showThreadsStorageKey(address)) refresh();
    };
    window.addEventListener(SHOW_THREADS_CHANGED_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SHOW_THREADS_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [address]);
  return show;
}
