/**
 * The "Ready to mint" view's reads: the list itself (worked out again from
 * the cached reads whenever the nominations refresh), a way for each row
 * to watch its own account and name in the read store without loading them,
 * since loadReadyDetails reads only the rows on screen, six at a time, and
 * the search's name lookups.
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { isAddress } from '../../data/accounts';
import { findNameOwners, nameMatchKey } from '../../data/nameSearch';
import { getQueryState, subscribeQuery, type QueryState } from '../../data/query';
import { READY_KEY, loadReadyToMint } from '../../data/readyToMint';
import { useQuery } from '../../hooks/useQuery';

/**
 * The people ready to mint. `nominationsLoadedAt` is the nominations'
 * `loadedAt`: when they refresh (every minute, or Refresh), the list follows
 * from the same reads, with no GETs of its own.
 */
export function useReadyToMint(nominationsLoadedAt: number | undefined) {
  const ready = useQuery(READY_KEY, (force) => loadReadyToMint({ force }));
  const { refetch } = ready;
  useEffect(() => {
    if (nominationsLoadedAt) void refetch();
  }, [nominationsLoadedAt, refetch]);
  return ready;
}

/** A key's state in the read store, watched but never loaded from here. */
export function useStoredValue<T>(key: string): QueryState<T> {
  const subscribe = useCallback((listener: () => void) => subscribeQuery(key, listener), [key]);
  const snapshot = useCallback(() => getQueryState<T>(key), [key]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Typing pauses this long before a name is looked up. */
export const READY_SEARCH_DEBOUNCE_MS = 300;

const clean = (text: string) => text.trim().replace(/^@/, '');

export interface ReadySearch {
  /** The text searched for: trimmed, without a leading @, once typing pauses. */
  query: string;
  /** The owners of the names that match it. */
  owners: ReadonlySet<string>;
  /** Typing, or names still being looked up. */
  looking: boolean;
  /** The name lookup failed (addresses, and names already read, still match). */
  failed: boolean;
}

/**
 * Ready to mint's search box: once typing pauses, a name is resolved to its
 * owners (one small name search, cached per query; nothing for an address).
 */
export function useReadySearch(text: string): ReadySearch {
  const [query, setQuery] = useState(() => clean(text));
  useEffect(() => {
    const timer = setTimeout(() => setQuery(clean(text)), READY_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);
  const key = isAddress(query) ? null : nameMatchKey(query);
  const names = useQuery(key, () => findNameOwners(query));
  const found = key ? names.data : undefined;
  const owners = useMemo(() => new Set(found ?? []), [found]);
  return {
    query,
    owners,
    looking: clean(text) !== query || (key !== null && names.data === undefined && !names.isError),
    failed: key !== null && names.isError && names.data === undefined,
  };
}
