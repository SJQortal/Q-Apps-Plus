import { beforeEach, describe, expect, it } from 'vitest';
import { findNameOwners, nameMatchKey, rankNameHits, searchNames } from '../../data/nameSearch';
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
    // Ranked: the shorter name first (rankNameHits).
    expect(hits).toEqual([
      { name: 'Norbert', owner: ADDR.learner },
      { name: 'Nora Nominator', owner: ADDR.nominator },
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

describe('findNameOwners (Ready to mint’s search)', () => {
  beforeEach(() => resetQueries());

  it('takes the owners from one small prefix page, cached per query', async () => {
    mockFetchRoute('/names/search', () => [
      { name: 'Lou Left', owner: ADDR.left },
      { name: 'Lou Two', owner: ADDR.left },
      { name: 'Louise', owner: ADDR.learner },
    ]);
    // Ranked: Louise (the shortest) first.
    expect(await findNameOwners(' lou ')).toEqual([ADDR.learner, ADDR.left]);
    await findNameOwners('LOU');
    expect(fetchCallsFor('/names/search')).toHaveLength(1);
    // The page had room, so an exact name would have been on it: no exact lookup.
    expect(fetchCallsFor(/^\/names\/(?!search|primary)/)).toHaveLength(0);
  });

  it('looks the exact name up when the page is full without it', async () => {
    mockFetchRoute('/names/search', () =>
      Array.from({ length: 10 }, (_, i) => ({ name: `Bob ${i}`, owner: ADDR.learner }))
    );
    mockFetchRoute('/names/Bob', () => ({ name: 'Bob', owner: ADDR.left }));
    expect(await findNameOwners('Bob')).toEqual([ADDR.learner, ADDR.left]);
    expect(fetchCallsFor('/names/Bob')).toHaveLength(1);
  });

  it('skips the exact lookup when the full page has the name', async () => {
    mockFetchRoute('/names/search', () => [
      { name: 'bob', owner: ADDR.left },
      ...Array.from({ length: 9 }, (_, i) => ({ name: `bob ${i}`, owner: ADDR.learner })),
    ]);
    expect(await findNameOwners('Bob')).toEqual([ADDR.left, ADDR.learner]);
    expect(fetchCallsFor(/^\/names\/(?!search)/)).toHaveLength(0);
  });

  it('asks nothing for blank, one-letter or overlong text', async () => {
    expect(await findNameOwners('')).toEqual([]);
    expect(await findNameOwners('a')).toEqual([]);
    expect(await findNameOwners('x'.repeat(81))).toEqual([]);
    expect(nameMatchKey('a')).toBeNull();
    expect(nameMatchKey(' Lou ')).toBe('namematch:lou');
    expect(fetchCallsFor('/names/')).toHaveLength(0);
  });
});

describe('rankNameHits', () => {
  it('puts the name typed first in any capitals, then the shorter names, then A–Z', () => {
    // Core's order: capitals first, so the look-alikes came before the name itself.
    const core = [
      'Crowetic Consulting',
      'Crowetic stupid',
      "Crowetic's Cards",
      'crowetic',
      'crowetic-dev',
      'crowetic2',
    ].map((name, i) => ({ name, owner: `Q${i}` }));
    expect(rankNameHits(core, 'crowetic').map((h) => h.name)).toEqual([
      'crowetic',
      'crowetic2',
      'crowetic-dev',
      'Crowetic stupid',
      "Crowetic's Cards",
      'Crowetic Consulting',
    ]);
    expect(rankNameHits(core, 'CROWETIC')[0].name).toBe('crowetic');
  });
});
