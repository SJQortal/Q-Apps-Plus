import { beforeEach, describe, expect, it } from 'vitest';
import { fetchCalls, fetchCallsMatching, mockFetch } from '../test/setup';
import {
  QDN_PAGE,
  buildSearchUrl,
  invalidateQdnSearches,
  resetQdnSearchCache,
  searchQdn,
  searchQdnAll,
} from './qdnSearch';

const row = (identifier: string) => ({ name: 'alice', service: 'DOCUMENT', identifier });

describe('qdnSearch', () => {
  beforeEach(() => resetQdnSearchCache());

  it('never sends limit=0 or an unlimited search', () => {
    expect(buildSearchUrl({ service: 'DOCUMENT', limit: 0 })).toContain(`limit=${QDN_PAGE}`);
    expect(buildSearchUrl({ service: 'DOCUMENT' })).toContain(`limit=${QDN_PAGE}`);
    expect(buildSearchUrl({ service: 'DOCUMENT', limit: 50 })).toContain('limit=50');
  });

  it('sends the same parameters as the original app', () => {
    const url = buildSearchUrl({
      service: 'DOCUMENT',
      identifier: 'qshare_file_',
      query: 'hello world',
      offset: 20,
      limit: 20,
    });
    expect(url).toBe(
      '/arbitrary/resources/search?mode=ALL&service=DOCUMENT&identifier=qshare_file_&query=hello+world&limit=20&offset=20&includemetadata=false&reverse=true&excludeblocked=true&exactmatchnames=true'
    );
  });

  it('sends one name= per publisher when given several, without repeats', () => {
    expect(
      buildSearchUrl({
        service: 'DOCUMENT',
        identifier: 'qshare_file_',
        names: ['Simon James', 'Q-Share+', 'Simon James'],
        limit: 20,
        offset: 40,
      })
    ).toBe(
      '/arbitrary/resources/search?mode=ALL&service=DOCUMENT&identifier=qshare_file_&name=Simon+James&name=Q-Share%2B&limit=20&offset=40&includemetadata=false&reverse=true&excludeblocked=true&exactmatchnames=true'
    );
    // A single name is sent as before.
    expect(buildSearchUrl({ service: 'DOCUMENT', name: 'alice' })).toContain('&name=alice&limit=');
    expect(buildSearchUrl({ service: 'DOCUMENT', name: 'alice', names: ['alice', 'bob'] })).toContain('&name=alice&name=bob&limit=');
  });

  it('merges identical searches in flight and reuses the result for the session', async () => {
    let resolveFetch: (v: unknown) => void = () => {};
    mockFetch('/arbitrary/resources/search', () => new Promise((r) => (resolveFetch = r)));
    const a = searchQdn({ service: 'DOCUMENT', identifier: 'qshare_file_' });
    const b = searchQdn({ service: 'DOCUMENT', identifier: 'qshare_file_' });
    expect(fetchCalls.length).toBe(1);
    resolveFetch([row('x')]);
    expect(await a).toEqual([row('x')]);
    expect(await b).toEqual([row('x')]);
    expect(await searchQdn({ service: 'DOCUMENT', identifier: 'qshare_file_' })).toEqual([row('x')]);
    expect(fetchCalls.length).toBe(1);
  });

  it('refetches after invalidation or with fresh', async () => {
    mockFetch('/arbitrary/resources/search', [row('y')]);
    await searchQdn({ service: 'DOCUMENT', identifier: 'a' });
    invalidateQdnSearches();
    await searchQdn({ service: 'DOCUMENT', identifier: 'a' });
    await searchQdn({ service: 'DOCUMENT', identifier: 'a' }, { fresh: true });
    expect(fetchCallsMatching('/arbitrary/resources/search').length).toBe(3);
  });

  it('pages through searchQdnAll and stops at a short page, bounded by maxPages', async () => {
    mockFetch(/limit=3&offset=0/, [row('1'), row('2'), row('3')]);
    mockFetch(/limit=3&offset=3/, [row('4')]);
    const all = await searchQdnAll({ service: 'DOCUMENT', identifier: 'q' }, { pageSize: 3 });
    expect(all.rows.map((r) => r.identifier)).toEqual(['1', '2', '3', '4']);
    expect(all.complete).toBe(true);
    expect(fetchCalls.every((u) => !/limit=0\b/.test(u))).toBe(true);

    resetQdnSearchCache();
    mockFetch('/arbitrary/resources/search', [row('a'), row('b'), row('c')]);
    const capped = await searchQdnAll({ service: 'DOCUMENT', identifier: 'q' }, { pageSize: 3, maxPages: 2 });
    expect(capped.rows.length).toBe(6);
    expect(capped.complete).toBe(false);
  });
});
