/**
 * The "Ready to mint" view's reads: the list itself (worked out again from
 * the cached reads whenever the nominations refresh), and a way for each row
 * to watch its own account and name in the read store without loading them,
 * since loadReadyDetails reads only the rows on screen, six at a time.
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react';
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
