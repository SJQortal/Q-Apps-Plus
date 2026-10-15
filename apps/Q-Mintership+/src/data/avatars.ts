/**
 * Avatars that arrive in the end, without a refresh.
 *
 * Core answers `THUMBNAIL/<name>/qortal_avatar?async=true` with a 404 while
 * it is still fetching or building the avatar (it starts that on the first
 * request), so a failed load doesn't mean "no avatar". After a name's first
 * failure one status read tells the two apart: a name that never published
 * an avatar keeps its letter for the session; any other is tried again with
 * backoff (each try nudges Core to keep fetching), paused while the tab is
 * hidden or nothing shows the name, until it loads or the tries run out.
 *
 * One entry per name, shared by every NameAvatar showing it: one image
 * request, one status read and one retry timer, however often the name shows.
 */
import { useCallback, useSyncExternalStore } from 'react';
import { getJson, seg } from './core';
import { avatarUrl } from './accounts';

/** Waits before each try again: about 4 minutes in all. */
export const AVATAR_RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 15_000, 30_000, 60_000, 60_000, 60_000];

/** Core's statuses that mean the avatar will never load: nothing to wait for. */
const NEVER = new Set(['NOT_PUBLISHED', 'BLOCKED', 'UNSUPPORTED']);

type Phase = 'trying' | 'loaded' | 'waiting' | 'none';

export interface AvatarView {
  /** The image to show, or null to show the letter. */
  src: string | null;
  loaded: boolean;
}

interface Entry {
  phase: Phase;
  /** Tries so far after the first; part of `src`, so a retry is a new request. */
  retries: number;
  statusRead: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  /** A retry whose wait is over, held while the tab is hidden or nothing shows the name. */
  due: boolean;
  view: AvatarView;
  listeners: Set<() => void>;
}

const entries = new Map<string, Entry>();
const NO_IMAGE: AvatarView = { src: null, loaded: false };

function srcFor(name: string, retries: number): string {
  return retries ? `${avatarUrl(name)}&retry=${retries}` : avatarUrl(name);
}

function entryFor(name: string): Entry {
  let entry = entries.get(name);
  if (!entry) {
    entry = {
      phase: 'trying',
      retries: 0,
      statusRead: false,
      timer: null,
      due: false,
      view: { src: srcFor(name, 0), loaded: false },
      listeners: new Set(),
    };
    entries.set(name, entry);
  }
  return entry;
}

function set(entry: Entry, phase: Phase, name: string): void {
  entry.phase = phase;
  entry.view =
    phase === 'trying' || phase === 'loaded'
      ? { src: srcFor(name, entry.retries), loaded: phase === 'loaded' }
      : NO_IMAGE;
  for (const listener of [...entry.listeners]) listener();
}

function hidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

function retry(name: string, entry: Entry): void {
  entry.timer = null;
  if (entry.phase !== 'waiting') return;
  if (hidden() || entry.listeners.size === 0) {
    entry.due = true;
    watchVisibility();
    return;
  }
  entry.due = false;
  entry.retries += 1;
  set(entry, 'trying', name);
}

function schedule(name: string, entry: Entry): void {
  if (entry.retries >= AVATAR_RETRY_DELAYS_MS.length) {
    set(entry, 'none', name);
    return;
  }
  set(entry, 'waiting', name);
  entry.timer = setTimeout(() => retry(name, entry), AVATAR_RETRY_DELAYS_MS[entry.retries]);
}

let watching = false;
function watchVisibility(): void {
  if (watching || typeof document === 'undefined') return;
  watching = true;
  document.addEventListener('visibilitychange', () => {
    if (hidden()) return;
    for (const [name, entry] of entries) if (entry.due) retry(name, entry);
  });
}

/** The image loaded: every place showing the name shows it. */
export function avatarLoaded(name: string, src: string): void {
  const entry = entries.get(name);
  if (!entry || entry.view.src !== src || entry.phase === 'loaded') return;
  set(entry, 'loaded', name);
}

/** The image failed: find out whether to wait for it, once per name and try. */
export function avatarFailed(name: string, src: string): void {
  const entry = entries.get(name);
  if (!entry || entry.phase !== 'trying' || entry.view.src !== src) return;
  if (entry.statusRead) {
    schedule(name, entry);
    return;
  }
  entry.statusRead = true;
  set(entry, 'waiting', name);
  getJson<{ status?: string }>(`/arbitrary/resource/status/THUMBNAIL/${seg(name)}/qortal_avatar`)
    .then((body) => (typeof body?.status === 'string' ? body.status : null))
    .catch(() => null)
    .then((status) => {
      if (entry.phase !== 'waiting' || entry.timer) return;
      if (status && NEVER.has(status)) set(entry, 'none', name);
      else schedule(name, entry);
    });
}

function subscribe(name: string, listener: () => void): () => void {
  const entry = entryFor(name);
  entry.listeners.add(listener);
  if (entry.due) queueMicrotask(() => entry.due && retry(name, entry));
  return () => {
    entry.listeners.delete(listener);
  };
}

/** What a NameAvatar for `name` shows now; null name → no image. */
export function useAvatar(name: string | null): AvatarView {
  const subscribeName = useCallback(
    (listener: () => void) => (name ? subscribe(name, listener) : () => {}),
    [name]
  );
  return useSyncExternalStore(
    subscribeName,
    () => (name ? entryFor(name).view : NO_IMAGE),
    () => NO_IMAGE
  );
}

/** Tests: forget every avatar and its timers. */
export function resetAvatars(): void {
  for (const entry of entries.values()) if (entry.timer) clearTimeout(entry.timer);
  entries.clear();
}
