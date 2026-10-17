/**
 * Values already in the read store (data/query.ts), kept up to date,
 * without loading anything: undefined where nothing is loaded yet. Moved
 * from the Explorer's Connections hooks, which re-export it.
 */
import { useEffect, useReducer } from 'react';
import { peekQuery, subscribeQuery } from '../data/query';

/** The values of `keys` in the store now (undefined where nothing is loaded), re-read on change. */
export function useStoreValues<T>(keys: readonly string[]): Array<T | undefined> {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const joined = keys.join('\n');
  useEffect(() => {
    const offs = joined ? joined.split('\n').map((key) => subscribeQuery(key, bump)) : [];
    // A value that arrived between render and subscribing.
    bump();
    return () => offs.forEach((off) => off());
  }, [joined]);
  return keys.map((key) => peekQuery<T>(key));
}
