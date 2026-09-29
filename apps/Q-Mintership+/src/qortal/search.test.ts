import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCallsFor, mockFetchRoute } from '../test/setup';
import {
  cachedSearchSimple,
  invalidateQdnSearches,
  primeQdnSearch,
  qdnSearchCount,
  resetQdnSearchCache,
  searchSimplePages,
} from './search';

const ROW = { name: 'alice', service: 'BLOG_POST', identifier: 'Minter-board-card-1', created: 1 };

beforeEach(() => {
  resetQdnSearchCache();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('cachedSearchSimple', () => {
  it('merges identical in-flight searches and reuses the result for the TTL', async () => {
    mockFetchRoute('/arbitrary/resources/searchsimple', [ROW]);
    const params = { service: 'BLOG_POST', identifier: 'Minter-board-card-', limit: 20 };
    await Promise.all([cachedSearchSimple(params), cachedSearchSimple(params)]);
    await cachedSearchSimple(params);
    expect(fetchCallsFor('/arbitrary/resources/searchsimple')).toHaveLength(1);
    expect(qdnSearchCount()).toBe(1);
    vi.advanceTimersByTime(180_001);
    await cachedSearchSimple(params);
    expect(qdnSearchCount()).toBe(2);
  });

  it('never asks Core for limit 0', async () => {
    mockFetchRoute('/arbitrary/resources/searchsimple', []);
    await cachedSearchSimple({ service: 'BLOG_POST', identifier: 'x', limit: 0 });
    expect(fetchCallsFor('/arbitrary/resources/searchsimple')[0]).toContain('limit=20');
  });

  it('treats different params as different searches and honours fresh', async () => {
    mockFetchRoute('/arbitrary/resources/searchsimple', [ROW]);
    await cachedSearchSimple({ service: 'BLOG_POST', identifier: 'x', limit: 20 });
    await cachedSearchSimple({ service: 'BLOG_POST', identifier: 'x', limit: 20, offset: 20 });
    await cachedSearchSimple({ service: 'BLOG_POST', identifier: 'x', limit: 20 }, { fresh: true });
    expect(qdnSearchCount()).toBe(3);
  });

  it('serves primed rows without a request and forgets them on invalidate', async () => {
    mockFetchRoute('/arbitrary/resources/searchsimple', []);
    primeQdnSearch({ service: 'BLOG_POST', identifier: 'Minter-board-card-1', limit: 1 }, [ROW]);
    await expect(
      cachedSearchSimple({ service: 'BLOG_POST', identifier: 'Minter-board-card-1', limit: 1 })
    ).resolves.toEqual([ROW]);
    expect(qdnSearchCount()).toBe(0);
    invalidateQdnSearches('Minter-board-card-');
    await cachedSearchSimple({ service: 'BLOG_POST', identifier: 'Minter-board-card-1', limit: 1 });
    expect(qdnSearchCount()).toBe(1);
  });

  it('retries after a failed search instead of caching the failure', async () => {
    mockFetchRoute('/arbitrary/resources/searchsimple', () => {
      throw new Error('offline');
    });
    await expect(cachedSearchSimple({ service: 'BLOG_POST', identifier: 'x' })).rejects.toThrow('offline');
    mockFetchRoute('/arbitrary/resources/searchsimple', [ROW]);
    await expect(cachedSearchSimple({ service: 'BLOG_POST', identifier: 'x' })).resolves.toEqual([ROW]);
  });
});

describe('searchSimplePages', () => {
  it('pages with a ceiling instead of an unlimited search', async () => {
    mockFetchRoute('/arbitrary/resources/searchsimple', (url) => {
      const offset = Number(url.searchParams.get('offset'));
      return offset < 200 ? Array(100).fill(ROW) : Array(5).fill(ROW);
    });
    const rows = await searchSimplePages({ service: 'BLOG_POST', identifier: 'x' });
    expect(rows).toHaveLength(205);
    expect(qdnSearchCount()).toBe(3);
    const capped = await searchSimplePages({ service: 'BLOG_POST', identifier: 'y' }, { maxPages: 1 });
    expect(capped).toHaveLength(100);
  });
});
