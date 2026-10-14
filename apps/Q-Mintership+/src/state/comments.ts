/**
 * Comment state that lives on this device:
 *
 * - muted names, saved in localStorage under the app's prefix (each viewer
 *   decides for themselves; nothing is published);
 * - comments, edits, deletions and hides this viewer just published, shown
 *   at once until QDN has them (they expire after 15 minutes, so a publish
 *   that never arrives doesn't stick).
 */
import { atom, getDefaultStore, useAtomValue, useSetAtom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { useMemo } from 'react';
import { STORAGE_PREFIX } from '../constants/plus';
import { sameComment, type OptimisticComment } from '../data/commentThread';
import type { CommentRecord } from '../data/commentRecords';

export const MUTED_NAMES_KEY = `${STORAGE_PREFIX}muted-names`;
/** More than anyone needs; keeps a tampered list from growing without end. */
const MUTED_MAX = 500;
const EXPIRE_MS = 15 * 60_000;

export const mutedNamesAtom = atomWithStorage<string[]>(MUTED_NAMES_KEY, []);

function cleanList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string' && v.length > 0).slice(0, MUTED_MAX)
    : [];
}

/** The muted names (a set) and a way to mute or unmute one. */
export function useMutedNames(): {
  muted: ReadonlySet<string>;
  setMuted: (name: string, muted: boolean) => void;
} {
  const list = useAtomValue(mutedNamesAtom);
  const set = useSetAtom(mutedNamesAtom);
  const muted = useMemo(() => new Set(cleanList(list)), [list]);
  const setMuted = useMemo(
    () => (name: string, mute: boolean) =>
      set((current) => {
        const clean = cleanList(current).filter((n) => n !== name);
        return mute ? [name, ...clean].slice(0, MUTED_MAX) : clean;
      }),
    [set]
  );
  return { muted, setMuted };
}

export const optimisticCommentsAtom = atom<Record<string, OptimisticComment>>({});
export const optimisticHidesAtom = atom<Record<string, { hidden: boolean; at: number }>>({});

const store = getDefaultStore();

export function addOptimisticComment(entry: Omit<OptimisticComment, 'at'>): void {
  store.set(optimisticCommentsAtom, (current) => ({
    ...current,
    [entry.ref]: { ...entry, at: Date.now() },
  }));
}

export function addOptimisticHide(ref: string, hidden: boolean): void {
  store.set(optimisticHidesAtom, (current) => ({ ...current, [ref]: { hidden, at: Date.now() } }));
}

/** Drop what QDN now shows as published (the loaded bodies and hides are the same). */
export function settleOptimistic(
  loaded: ReadonlyMap<string, CommentRecord>,
  hides: ReadonlyMap<string, boolean>
): void {
  const now = Date.now();
  const comments = store.get(optimisticCommentsAtom);
  const keep = Object.entries(comments).filter(([ref, entry]) => {
    if (now - entry.at > EXPIRE_MS) return false;
    const found = loaded.get(ref);
    return !found || !sameComment(found, entry.record);
  });
  if (keep.length !== Object.keys(comments).length)
    store.set(optimisticCommentsAtom, Object.fromEntries(keep));
  const hidden = store.get(optimisticHidesAtom);
  const keepHides = Object.entries(hidden).filter(
    ([ref, entry]) => now - entry.at <= EXPIRE_MS && hides.get(ref) !== entry.hidden
  );
  if (keepHides.length !== Object.keys(hidden).length)
    store.set(optimisticHidesAtom, Object.fromEntries(keepHides));
}

/** The viewer's not-yet-shown comments under these keys, and their hides. */
export function useOptimisticComments(keys: readonly string[]): {
  comments: OptimisticComment[];
  hides: Map<string, boolean>;
} {
  const all = useAtomValue(optimisticCommentsAtom);
  const allHides = useAtomValue(optimisticHidesAtom);
  const keyList = keys.join('+');
  return useMemo(() => {
    const wanted = new Set(keyList.split('+'));
    const now = Date.now();
    return {
      comments: Object.values(all).filter((o) => wanted.has(o.key) && now - o.at <= EXPIRE_MS),
      hides: new Map(
        Object.entries(allHides)
          .filter(([, v]) => now - v.at <= EXPIRE_MS)
          .map(([ref, v]) => [ref, v.hidden])
      ),
    };
  }, [all, allHides, keyList]);
}

/** Tests start empty. */
export function resetOptimisticComments(): void {
  store.set(optimisticCommentsAtom, {});
  store.set(optimisticHidesAtom, {});
}
