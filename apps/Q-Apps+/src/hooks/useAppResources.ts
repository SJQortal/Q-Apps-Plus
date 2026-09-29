import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  isAppResourcesStale,
  peekAppResources,
  searchAppResources,
  type AppResourceMap,
} from '../qortal/appResources';
import { describeError, hasQortalRequest, NoQortalError } from '../qortal/request';

/** offline = no qortalRequest, i.e. running outside Hub or GO. */
export type AppResourcesStatus = 'loading' | 'ready' | 'error' | 'offline';

export interface AppResourcesState {
  status: AppResourcesStatus;
  byName: AppResourceMap;
  error?: string;
  fetchedAt?: number;
}

/**
 * Live QDN details for a list of app names: one batched search, shared and
 * cached by src/qortal/appResources.ts. Cached data shows at once and is
 * refreshed when the tab becomes visible again after the TTL.
 */
export function useAppResources(names: readonly string[]) {
  const key = names.join('\n');
  const stableNames = useMemo(() => key.split('\n').filter(Boolean), [key]);

  const [state, setState] = useState<AppResourcesState>(() => {
    const cached = peekAppResources(stableNames);
    if (cached) return { status: 'ready', byName: cached.data, fetchedAt: cached.fetchedAt };
    return hasQortalRequest() ? { status: 'loading', byName: {} } : { status: 'offline', byName: {} };
  });

  const load = useCallback(
    async (fresh: boolean) => {
      // The initial state already says loading/offline, so nothing is set
      // before the first await; a reload (fresh) marks loading from the click.
      if (!hasQortalRequest()) return;
      try {
        const byName = await searchAppResources(stableNames, { fresh });
        setState({ status: 'ready', byName, fetchedAt: Date.now() });
      } catch (error) {
        setState((s) => ({
          ...s,
          status: error instanceof NoQortalError ? 'offline' : 'error',
          error: describeError(error),
        }));
      }
    },
    [stableNames]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && isAppResourcesStale(stableNames)) void load(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load, stableNames]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, status: 'loading', error: undefined }));
    return load(true);
  }, [load]);

  return { ...state, reload };
}
