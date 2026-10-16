/**
 * The Explorer's session state (jotai, default store):
 *
 * - the trail: the accounts opened one from another, for the crumbs on an
 *   account page (session only);
 * - compare picks: up to 4 accounts to compare (session only);
 * - recent explorations: the last 8 accounts opened, newest first, kept on
 *   this device only while Settings → Explorer → "Remember accounts I
 *   explore on this device" is on. Addresses only, nothing else.
 *
 * Every localStorage access is guarded: a private window or blocked site
 * data leaves the list empty and the Explorer working.
 */
import { atom, getDefaultStore, useAtomValue } from 'jotai';
import { STORAGE_PREFIX } from '../constants/plus';
import { SETTINGS_KEYS } from './settings';

const store = getDefaultStore();

// ---- Trail -------------------------------------------------------------------

/** The most crumbs kept: older ones fall off the front. */
export const TRAIL_MAX = 20;

/** The accounts opened one from another, oldest first; the last is the one on screen. */
export const trailAtom = atom<string[]>([]);

/**
 * The trail after opening `address`: back to it when it is already in the
 * trail (the rest is cut), one more crumb when it was reached from an
 * Explorer link, otherwise a new trail that starts with it.
 */
export function nextTrail(trail: string[], address: string, viaExplorer: boolean): string[] {
  const at = trail.indexOf(address);
  if (at >= 0) return at === trail.length - 1 ? trail : trail.slice(0, at + 1);
  if (!viaExplorer) return [address];
  return [...trail, address].slice(-TRAIL_MAX);
}

/** Record an account opened (account page). */
export function openInTrail(address: string, viaExplorer: boolean): void {
  const trail = store.get(trailAtom);
  const next = nextTrail(trail, address, viaExplorer);
  if (next !== trail) store.set(trailAtom, next);
}

export function useTrail(): string[] {
  return useAtomValue(trailAtom);
}

/** Whether a link's router state says it came from inside the Explorer. */
export function cameFromExplorer(state: unknown): boolean {
  return Boolean(state) && (state as { via?: unknown }).via === 'explorer';
}

/**
 * An account opened by one of its names: what was typed or picked, and the
 * name Core matched (Core ignores case and look-alike letters, so they can
 * differ). Carried in the router state, so the account page can say so.
 */
export interface NameMatch {
  viaName: string;
  matched: string;
}

/** The name an account page was opened from, if its router state has one. */
export function nameMatchOf(state: unknown): NameMatch | null {
  if (!state || typeof state !== 'object') return null;
  const { viaName, matched } = state as Partial<Record<keyof NameMatch, unknown>>;
  if (typeof viaName !== 'string' || !viaName) return null;
  return { viaName, matched: typeof matched === 'string' && matched ? matched : viaName };
}

// ---- Compare picks -------------------------------------------------------------

export const COMPARE_MAX = 4;
export const COMPARE_FULL = 'Compare holds 4 accounts. Remove one first.';

/** The accounts picked to compare, in the order they were picked. */
export const comparePicksAtom = atom<string[]>([]);

export type PickResult = 'added' | 'removed' | 'already' | 'full';

export function addPick(address: string): PickResult {
  const picks = store.get(comparePicksAtom);
  if (picks.includes(address)) return 'already';
  if (picks.length >= COMPARE_MAX) return 'full';
  store.set(comparePicksAtom, [...picks, address]);
  return 'added';
}

export function removePick(address: string): PickResult {
  const picks = store.get(comparePicksAtom);
  if (picks.includes(address))
    store.set(
      comparePicksAtom,
      picks.filter((a) => a !== address)
    );
  return 'removed';
}

/** Add, or remove when it is picked already. A 5th is refused ('full'). */
export function togglePick(address: string): PickResult {
  return store.get(comparePicksAtom).includes(address) ? removePick(address) : addPick(address);
}

export function clearPicks(): void {
  store.set(comparePicksAtom, []);
}

export function useComparePicks(): string[] {
  return useAtomValue(comparePicksAtom);
}

// ---- Recent explorations ---------------------------------------------------------

export const RECENT_KEY = `${STORAGE_PREFIX}explorer-recent`;
export const RECENT_MAX = 8;

const ADDRESS_RE = /^[QA][1-9A-HJ-NP-Za-km-z]{33}$/;

/** What this device remembers, newest first (empty when storage can't be read). */
export function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list)
      ? list
          .filter((a): a is string => typeof a === 'string' && ADDRESS_RE.test(a))
          .slice(0, RECENT_MAX)
      : [];
  } catch {
    return [];
  }
}

/**
 * Settings → Explorer → "Remember accounts I explore on this device" (on
 * unless turned off). Read from storage itself, where the switch writes it:
 * nothing can be remembered where storage can't be read.
 */
export function rememberExplorations(): boolean {
  try {
    return window.localStorage.getItem(SETTINGS_KEYS.explorerRemember) !== 'false';
  } catch {
    return false;
  }
}

export const recentAtom = atom<string[]>(readRecent());

/** Remember an account opened, when the setting is on. */
export function recordRecent(address: string): void {
  if (!ADDRESS_RE.test(address) || !rememberExplorations()) return;
  const next = [address, ...store.get(recentAtom).filter((a) => a !== address)].slice(
    0,
    RECENT_MAX
  );
  store.set(recentAtom, next);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Kept for this session only.
  }
}

/** Forget every recent exploration on this device. */
export function clearRecent(): void {
  store.set(recentAtom, []);
  try {
    window.localStorage.removeItem(RECENT_KEY);
  } catch {
    // Nothing stored that could be read either.
  }
}

export function useRecent(): string[] {
  return useAtomValue(recentAtom);
}

/** Tests: a fresh session (the recent list read again from storage). */
export function resetExplorerState(): void {
  store.set(trailAtom, []);
  store.set(comparePicksAtom, []);
  store.set(recentAtom, readRecent());
}
