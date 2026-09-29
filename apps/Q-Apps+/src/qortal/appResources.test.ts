import { describe, expect, it, vi } from 'vitest';
import {
  APP_SEARCH_TTL_MS,
  appSearchParams,
  describeStatus,
  getAppResourceStatus,
  isAppResourcesStale,
  searchAppResources,
} from './appResources';
import { NoQortalError } from './request';
import { callsFor, installQortalMock } from '../test/setup';

const rows = [
  { name: 'Q-Mail+', service: 'APP', size: 2_100_000, created: 1000, updated: 2000, metadata: { title: 'Q-Mail+' } },
  { name: 'Q-Mail', service: 'APP', size: 1_900_000, created: 500, updated: 900 },
];

describe('searchAppResources', () => {
  it('makes one batched search with names + exactMatchNames and a bounded limit', async () => {
    const fn = installQortalMock({ SEARCH_QDN_RESOURCES: () => rows });
    const byName = await searchAppResources(['Q-Mail+', 'Q-Mail', 'Q-Tube+']);
    expect(callsFor(fn, 'SEARCH_QDN_RESOURCES')).toHaveLength(1);
    expect(fn.mock.calls[0][0]).toEqual({
      action: 'SEARCH_QDN_RESOURCES',
      service: 'APP',
      names: ['Q-Mail+', 'Q-Mail', 'Q-Tube+'],
      exactMatchNames: true,
      includeMetadata: true,
      mode: 'LATEST',
      limit: 3,
      offset: 0,
    });
    expect(Object.keys(byName).sort()).toEqual(['Q-Mail', 'Q-Mail+']);
    expect(byName['Q-Mail+'].size).toBe(2_100_000);
    expect(byName['Q-Mail+'].metadata?.title).toBe('Q-Mail+');
    expect(byName['Q-Tube+']).toBeUndefined();
  });

  it('never sends limit 0 and drops duplicate names', () => {
    const params = appSearchParams(['A', 'A', 'B']);
    expect(params.names).toEqual(['A', 'B']);
    expect(params.limit).toBe(2);
    expect(appSearchParams([]).limit).toBe(0); // guarded by the caller: an empty list never searches
  });

  it('shares one request between concurrent identical searches', async () => {
    const fn = installQortalMock({ SEARCH_QDN_RESOURCES: () => rows });
    const [a, b] = await Promise.all([
      searchAppResources(['Q-Mail', 'Q-Mail+']),
      searchAppResources(['Q-Mail+', 'Q-Mail']), // same set, different order
    ]);
    expect(a).toBe(b);
    expect(callsFor(fn, 'SEARCH_QDN_RESOURCES')).toHaveLength(1);
  });

  it('reuses the cached result until the TTL passes, and fresh forces a new search', async () => {
    vi.useFakeTimers();
    try {
      const fn = installQortalMock({ SEARCH_QDN_RESOURCES: () => rows });
      await searchAppResources(['Q-Mail+']);
      await searchAppResources(['Q-Mail+']);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(isAppResourcesStale(['Q-Mail+'])).toBe(false);
      await searchAppResources(['Q-Mail+'], { fresh: true });
      expect(fn).toHaveBeenCalledTimes(2);
      vi.advanceTimersByTime(APP_SEARCH_TTL_MS + 1);
      expect(isAppResourcesStale(['Q-Mail+'])).toBe(true);
      await searchAppResources(['Q-Mail+']);
      expect(fn).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns nothing for an empty list without calling the host', async () => {
    const fn = installQortalMock({ SEARCH_QDN_RESOURCES: () => rows });
    expect(await searchAppResources([])).toEqual({});
    expect(fn).not.toHaveBeenCalled();
  });

  it('rejects with NoQortalError outside Hub and does not cache the failure', async () => {
    await expect(searchAppResources(['Q-Mail+'])).rejects.toBeInstanceOf(NoQortalError);
    const fn = installQortalMock({ SEARCH_QDN_RESOURCES: () => rows });
    await searchAppResources(['Q-Mail+']);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('ignores malformed rows and keeps the newest row per name', async () => {
    installQortalMock({
      SEARCH_QDN_RESOURCES: () => [
        null,
        { service: 'APP' },
        { name: 'X+', updated: 1 },
        { name: 'X+', updated: 5, size: 7 },
        { name: 'X+', updated: 3 },
      ],
    });
    const byName = await searchAppResources(['X+']);
    expect(byName['X+'].updated).toBe(5);
    expect(byName['X+'].size).toBe(7);
  });
});

describe('getAppResourceStatus', () => {
  it('asks GET_QDN_RESOURCE_STATUS for the APP by name and caches a READY answer', async () => {
    const fn = installQortalMock({ GET_QDN_RESOURCE_STATUS: () => ({ status: 'READY', percentLoaded: 100 }) });
    const status = await getAppResourceStatus('Q-Mail+');
    expect(fn.mock.calls[0][0]).toEqual({ action: 'GET_QDN_RESOURCE_STATUS', service: 'APP', name: 'Q-Mail+' });
    expect(status.status).toBe('READY');
    await getAppResourceStatus('Q-Mail+');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('describes statuses in plain words', () => {
    expect(describeStatus('READY')).toBe('Downloaded on this node');
    expect(describeStatus('DOWNLOADING')).toBe('Fetching from peers');
    expect(describeStatus('SOMETHING_ELSE')).toBe('something else');
  });
});
