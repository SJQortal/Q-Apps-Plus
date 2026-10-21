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

/** Every avatar is a THUMBNAIL; people, apps and websites use this identifier. */
export const PERSON_AVATAR = 'qortal_avatar';

/** The identifier a group's avatar is published under, by the group's owner (as Qortal Hub does). */
export function groupAvatarIdentifier(groupId: number): string {
  return `qortal_group_avatar_${groupId}`;
}

/** The QDN service an avatar image is published under: THUMBNAIL, or IMAGE (Q-Assets' asset avatars). */
export type AvatarService = 'THUMBNAIL' | 'IMAGE';

/**
 * One avatar's key in this store: the name alone for a person's avatar (as
 * before), or the identifier and the name for another one, such as a
 * group's (`qortal_group_avatar_<id>`, published by its owner), with the
 * service in front when it isn't THUMBNAIL (an asset's IMAGE).
 */
export function avatarKey(
  name: string,
  identifier: string = PERSON_AVATAR,
  service: AvatarService = 'THUMBNAIL'
): string {
  if (service !== 'THUMBNAIL') return `${service}\u0001${identifier}\u0000${name}`;
  return identifier === PERSON_AVATAR ? name : `${identifier}\u0000${name}`;
}

function refOf(key: string): { name: string; identifier: string; service: AvatarService } {
  const mark = key.indexOf('\u0001');
  const service: AvatarService = mark < 0 ? 'THUMBNAIL' : (key.slice(0, mark) as AvatarService);
  const rest = mark < 0 ? key : key.slice(mark + 1);
  const cut = rest.indexOf('\u0000');
  return cut < 0
    ? { name: rest, identifier: PERSON_AVATAR, service }
    : { identifier: rest.slice(0, cut), name: rest.slice(cut + 1), service };
}

function urlFor(key: string): string {
  const { name, identifier, service } = refOf(key);
  return identifier === PERSON_AVATAR && service === 'THUMBNAIL'
    ? avatarUrl(name)
    : `/arbitrary/${service}/${seg(name)}/${seg(identifier)}?async=true`;
}

function srcFor(name: string, retries: number): string {
  return retries ? `${urlFor(name)}&retry=${retries}` : urlFor(name);
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
  const ref = refOf(name);
  getJson<{ status?: string }>(
    `/arbitrary/resource/status/${ref.service}/${seg(ref.name)}/${seg(ref.identifier)}`
  )
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

/**
 * What an avatar for `name` shows now; null name → no image. `identifier`
 * picks another of the name's THUMBNAILs (a group's avatar), or with
 * `service` IMAGE one of its images (an asset's avatar).
 */
export function useAvatar(
  name: string | null,
  identifier: string = PERSON_AVATAR,
  service: AvatarService = 'THUMBNAIL'
): AvatarView {
  const key = name ? avatarKey(name, identifier, service) : null;
  const subscribeName = useCallback(
    (listener: () => void) => (key ? subscribe(key, listener) : () => {}),
    [key]
  );
  return useSyncExternalStore(
    subscribeName,
    () => (key ? entryFor(key).view : NO_IMAGE),
    () => NO_IMAGE
  );
}

/** Tests: forget every avatar and its timers. */
export function resetAvatars(): void {
  for (const entry of entries.values()) if (entry.timer) clearTimeout(entry.timer);
  entries.clear();
}
