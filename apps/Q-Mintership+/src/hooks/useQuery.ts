/**
 * React access to the read store (data/query.ts): subscribe to one key, load
 * it when needed, keep the old value on screen while refreshing, and refresh
 * politely while the view is mounted and the tab is visible.
 */
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { getQueryState, staleVersion, subscribeQuery, type QueryState } from '../data/query';

export interface UseQueryResult<T> extends QueryState<T> {
  /** Load again now (a refresh button or pull-to-refresh). */
  refetch: () => Promise<void>;
  isLoading: boolean;
  isError: boolean;
}

export interface UseQueryOptions {
  /** Refresh every this many ms while visible (backs off after errors). 0 = never. */
  refreshMs?: number;
  /** Don't load (e.g. no signed-in account yet). */
  enabled?: boolean;
}

const IDLE_KEY = '__idle__';

/**
 * `key` must match the key `load` uses inside fetchQuery (each data/ loader
 * documents its key). `load(force)` is the loader.
 */
export function useQuery<T>(
  key: string | null,
  load: (force: boolean) => Promise<T>,
  options: UseQueryOptions = {}
): UseQueryResult<T> {
  const enabled = options.enabled !== false && key !== null;
  const storeKey = enabled ? (key as string) : IDLE_KEY;
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const subscribe = useCallback(
    (listener: () => void) => subscribeQuery(storeKey, listener),
    [storeKey]
  );
  const getSnapshot = useCallback(() => getQueryState<T>(storeKey), [storeKey]);
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const run = useCallback(
    async (force: boolean) => {
      if (!enabled) return;
      try {
        await loadRef.current(force);
      } catch {
        // The store keeps the error; views show it.
      }
    },
    [enabled]
  );

  // First load, and one reload per invalidation (a write, a Refresh button).
  // invalidate() hands the key a new state object, so this re-renders.
  const stale = enabled ? staleVersion(storeKey) : 0;
  useEffect(() => {
    if (!enabled) return;
    if (stale) void run(true);
    else if (state.status === 'idle') void run(false);
  }, [enabled, run, state.status, stale, storeKey]);

  const refreshMs = enabled ? (options.refreshMs ?? 0) : 0;
  usePoliteInterval(
    () => {
      // Several views can poll one key (the shell and the page): a tick skips
      // a key that is loading or that another view loaded since the last one.
      const current = getQueryState<T>(storeKey);
      if (current.fetching) return;
      if (current.status === 'success' && Date.now() - current.updatedAt < refreshMs * 0.75)
        return;
      return run(true);
    },
    refreshMs,
    state.status === 'error'
  );

  const refetch = useCallback(() => run(true), [run]);
  return {
    ...state,
    refetch,
    isLoading: state.status === 'loading' || (state.status === 'idle' && enabled),
    isError: state.status === 'error',
  };
}

/**
 * Call `tick` every `ms` while the page is visible; pause while hidden and
 * catch up once when it comes back. After an error the pause doubles, up to
 * 8× (docs/QORTAL.md → Poll politely).
 */
export function usePoliteInterval(
  tick: () => Promise<unknown> | void,
  ms: number,
  failing = false
): void {
  const tickRef = useRef(tick);
  useEffect(() => {
    tickRef.current = tick;
  });
  const backoff = useRef(1);
  useEffect(() => {
    backoff.current = failing ? Math.min(backoff.current * 2, 8) : 1;
  }, [failing]);

  useEffect(() => {
    if (!ms) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last = Date.now();
    const schedule = () => {
      timer = setTimeout(fire, ms * backoff.current);
    };
    const fire = () => {
      if (document.visibilityState === 'visible') {
        last = Date.now();
        void tickRef.current();
      }
      schedule();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - last > ms) {
        last = Date.now();
        void tickRef.current();
      }
    };
    schedule();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [ms]);
}
