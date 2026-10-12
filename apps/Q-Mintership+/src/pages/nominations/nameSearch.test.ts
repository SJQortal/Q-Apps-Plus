import { beforeEach, describe, expect, it } from 'vitest';
import { searchNames } from '../../data/nameSearch';
import { resetQueries } from '../../data/query';
import { fetchCallsFor, mockFetchRoute } from '../../test/setup';
import { ADDR } from '../../test/world';

describe('name search (src/data/nameSearch.ts)', () => {
  beforeEach(() => resetQueries());

  it('asks Core for one small prefix page and keeps only well-formed rows', async () => {
    let seen: URLSearchParams | null = null;
    mockFetchRoute('/names/search', (url: URL) => {
      seen = url.searchParams;
      return [
        { name: 'Nora Nominator', owner: ADDR.nominator },
        { name: 'Nora Nominator', owner: ADDR.nominator },
        { name: 'No owner' },
        { name: '', owner: ADDR.learner },
        { name: 'Bad owner', owner: 'not-an-address' },
        { name: 'Norbert', owner: ADDR.learner },
      ];
    });
    const hits = await searchNames('  nor ');
    expect(hits).toEqual([
      { name: 'Nora Nominator', owner: ADDR.nominator },
      { name: 'Norbert', owner: ADDR.learner },
    ]);
    expect(seen!.get('query')).toBe('nor');
    expect(seen!.get('prefix')).toBe('true');
    expect(seen!.get('limit')).toBe('10');
    expect(seen!.get('limit')).not.toBe('0');
  });

  it('skips blank and one-letter queries without asking Core', async () => {
    mockFetchRoute('/names/search', () => [{ name: 'A', owner: ADDR.admin }]);
    expect(await searchNames('')).toEqual([]);
    expect(await searchNames(' a ')).toEqual([]);
    expect(fetchCallsFor('/names/search')).toHaveLength(0);
  });

  it('caches by query, ignoring case, and shares a search already in flight', async () => {
    mockFetchRoute('/names/search', () => [{ name: 'Ada Approved', owner: ADDR.approved }]);
    await Promise.all([searchNames('ada'), searchNames('ada')]);
    await searchNames('ADA');
    expect(fetchCallsFor('/names/search')).toHaveLength(1);
  });

  it('encodes names with spaces, + and non-ASCII letters', async () => {
    mockFetchRoute('/names/search', () => []);
    await searchNames('bob+builder ü');
    const [call] = fetchCallsFor('/names/search');
    expect(call).toContain('query=bob%2Bbuilder%20%C3%BC');
  });

  it('turns an odd answer into no hits', async () => {
    mockFetchRoute('/names/search', () => ({ error: 'nope' }));
    expect(await searchNames('xyz')).toEqual([]);
  });
});
