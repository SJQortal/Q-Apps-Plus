/**
 * useQuery for a list of keys that changes in length (one read per compared
 * account or pair): each entry's key must be the key its loader's
 * fetchQuery uses. Like useQuery, it loads a key that isn't in the store,
 * reloads one marked stale (once per invalidation), keeps old values on
 * screen, and never polls. A null entry reads nothing.
 *
 * A heavy read waits in the limiter's queue without touching the store, so
 * each key is asked for once (per invalidation) rather than every render.
 */
import { useEffect, useReducer, useRef } from 'react';
import { getQueryState, staleVersion, subscribeQuery, type QueryState } from '../../../data/query';
import type { UseQueryResult } from '../../../hooks/useQuery';

export interface QueryEntry<T> {
  key: string;
  load: (force: boolean) => Promise<T>;
}

const IDLE: QueryState<never> = Object.freeze({
  data: undefined,
  error: undefined,
  status: 'idle',
  updatedAt: 0,
  fetching: false,
}) as QueryState<never>;

const quiet = () => undefined;

export function useQueries<T>(
  entries: ReadonlyArray<QueryEntry<T> | null | undefined | false>
): Array<UseQueryResult<T>> {
  const latest = useRef(entries);
  useEffect(() => {
    latest.current = entries;
  });
  /** The stale version each key was last asked for at (0: a first load). */
  const asked = useRef(new Map<string, number>());

  const keys = entries.map((entry) => (entry ? entry.key : ''));
  const joined = keys.join('\n');
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const offs = joined
      .split('\n')
      .filter(Boolean)
      .map((key) => subscribeQuery(key, bump));
    // A value that arrived between render and subscribing.
    bump();
    return () => offs.forEach((off) => off());
  }, [joined]);

  const states = keys.map((key) => (key ? getQueryState<T>(key) : (IDLE as QueryState<T>)));
  const signal = keys
    .map((key, i) => (key ? `${key}|${states[i].status}|${staleVersion(key)}` : ''))
    .join('\n');
  useEffect(() => {
    for (const entry of latest.current) {
      if (!entry) continue;
      const stale = staleVersion(entry.key);
      const idle = getQueryState(entry.key).status === 'idle';
      if (!stale && !idle) continue;
      if (asked.current.get(entry.key) === stale) continue;
      asked.current.set(entry.key, stale);
      entry.load(Boolean(stale)).catch(quiet);
    }
  }, [signal]);

  return states.map((state, i) => ({
    ...state,
    refetch: async () => {
      const entry = latest.current[i];
      if (entry) await entry.load(true).catch(quiet);
    },
    isLoading: state.status === 'loading' || (state.status === 'idle' && Boolean(keys[i])),
    isError: state.status === 'error',
  }));
}
