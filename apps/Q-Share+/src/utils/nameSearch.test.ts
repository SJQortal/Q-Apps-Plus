import { beforeEach, describe, expect, it } from 'vitest';
import { fetchCallsMatching, mockFetch } from '../test/setup';
import {
  MISSING_AVATAR_RETRY_MS,
  NAME_SEARCH_CONTAINS_LIMIT,
  NAME_SEARCH_PREFIX_LIMIT,
  NAME_SUGGESTION_LIMIT,
  avatarKnownMissing,
  cachedNameSearch,
  nameSearchUrl,
  namesContaining,
  parseNameSearchResults,
  rankNameSuggestions,
  rememberMissingAvatar,
  resetNameSearchCache,
  searchNames,
  splitNameHighlight,
  suggestionAvatarUrl,
} from './nameSearch';

const record = (name: string) => ({ name, reducedName: name.toLowerCase(), owner: 'Qowner', registered: 1 });

describe('nameSearch', () => {
  beforeEach(() => resetNameSearchCache());

  it("encodes the query, so '+', '&', '#' and spaces reach Core as typed", () => {
    expect(nameSearchUrl('Q-Share+ & #1', true, 20)).toBe('/names/search?query=Q-Share%2B+%26+%231&prefix=true&limit=20&offset=0');
    const params = new URL(nameSearchUrl('a+b&c=d#e', false, 40), 'http://localhost').searchParams;
    expect(params.get('query')).toBe('a+b&c=d#e');
    expect(params.get('prefix')).toBe('false');
    expect(params.get('limit')).toBe('40');
  });

  it('reads name records and plain strings, and skips anything else', () => {
    expect(parseNameSearchResults([record('Simon James'), 'Simona', { name: '  ' }, null, 7, { owner: 'x' }])).toEqual(['Simon James', 'Simona']);
    expect(parseNameSearchResults({ error: 1 })).toEqual([]);
  });

  it('runs a prefix and a contains search, merged without repeats, prefix names first', async () => {
    mockFetch('/names/search', (url) =>
      url.searchParams.get('prefix') === 'true'
        ? [record('Simon'), record('Simon James')]
        : [record('-=SiMoN=-'), record('simon'), record('Simon James'), record('Simona')]
    );
    expect(await searchNames(' sim ')).toEqual(['Simon', 'Simon James', '-=SiMoN=-', 'Simona']);
    const calls = fetchCallsMatching('/names/search').map((u) => new URL(u, 'http://localhost').searchParams);
    expect(calls.map((p) => [p.get('query'), p.get('prefix'), p.get('limit')])).toEqual([
      ['sim', 'true', String(NAME_SEARCH_PREFIX_LIMIT)],
      ['sim', 'false', String(NAME_SEARCH_CONTAINS_LIMIT)],
    ]);
  });

  it('caches per query for the session (Core ignores case) and merges searches in flight', async () => {
    let answer: (names: unknown) => void = () => {};
    let calls = 0;
    mockFetch('/names/search', () => {
      calls += 1;
      return calls === 1 ? new Promise((resolve) => (answer = resolve)) : [record('Bob')];
    });
    const first = searchNames('bob');
    const second = searchNames('BOB');
    expect(fetchCallsMatching('/names/search').length).toBe(2);
    answer([record('Bobby')]);
    expect(await first).toEqual(['Bobby', 'Bob']);
    expect(await second).toBe(await first);

    expect(cachedNameSearch('Bob ')).toEqual(['Bobby', 'Bob']);
    expect(await searchNames('bOb')).toEqual(['Bobby', 'Bob']);
    expect(fetchCallsMatching('/names/search').length).toBe(2);
    // An empty query never asks Core.
    expect(await searchNames('   ')).toEqual([]);
    expect(fetchCallsMatching('/names/search').length).toBe(2);
  });

  it('answers with half the names when one search fails, without caching them, and fails when both do', async () => {
    let down = 'contains';
    mockFetch('/names/search', (url) => {
      const prefix = url.searchParams.get('prefix') === 'true';
      if (down === 'both' || (down === 'contains' && !prefix)) throw new Error('node down');
      return prefix ? [record('Carol')] : [record('Caroline')];
    });
    expect(await searchNames('car')).toEqual(['Carol']);
    expect(cachedNameSearch('car')).toBeUndefined();

    down = 'none';
    expect(await searchNames('car')).toEqual(['Carol', 'Caroline']);
    expect(cachedNameSearch('car')).toEqual(['Carol', 'Caroline']);

    down = 'both';
    await expect(searchNames('dave')).rejects.toThrow('node down');
    expect(cachedNameSearch('dave')).toBeUndefined();
  });

  it('ranks the exact name, then prefixes, then names seen publishing, then the rest', () => {
    const names = ['Asimov', 'Simona', 'xsimx', 'Simon James', 'Q-sim', 'sim', 'Simon', 'unrelated'];
    expect(rankNameSuggestions(names, 'Sim', ['Q-sim'])).toEqual([
      'sim',
      'Simon',
      'Simona',
      'Simon James',
      'Q-sim',
      'xsimx',
      'Asimov',
      // Matched by Core some other way (e.g. a reduced spelling): last.
      'unrelated',
    ]);
    // A seen name leads its group.
    expect(rankNameSuggestions(['Simona', 'Simon James'], 'sim', ['Simon James'])).toEqual(['Simon James', 'Simona']);
    // Case-insensitive repeats keep their first spelling.
    expect(rankNameSuggestions(['BOB', 'bob', 'Bobby'], 'bob')).toEqual(['BOB', 'Bobby']);
  });

  it(`shows at most ${NAME_SUGGESTION_LIMIT}, and with no query the seen names in their order`, () => {
    const many = Array.from({ length: 30 }, (_, i) => `name${String(i).padStart(2, '0')}`);
    expect(rankNameSuggestions(many, 'name')).toHaveLength(NAME_SUGGESTION_LIMIT);
    expect(rankNameSuggestions(many, '', ['Zed', 'alice', 'Zed', 'bob'])).toEqual(['Zed', 'alice', 'bob']);
  });

  it('finds the seen names that contain the query', () => {
    expect(namesContaining(['Alice', 'Malice', 'Bob'], 'LIC')).toEqual(['Alice', 'Malice']);
    expect(namesContaining(['Alice', 'Bob'], ' ')).toEqual(['Alice', 'Bob']);
  });

  it('splits a name into the parts that match the query, ignoring case', () => {
    expect(splitNameHighlight('Banana', 'an')).toEqual([
      { text: 'B', match: false },
      { text: 'an', match: true },
      { text: 'an', match: true },
      { text: 'a', match: false },
    ]);
    expect(splitNameHighlight('Simon James', 'SIMON')).toEqual([
      { text: 'Simon', match: true },
      { text: ' James', match: false },
    ]);
    expect(splitNameHighlight('Bob', '')).toEqual([{ text: 'Bob', match: false }]);
    expect(splitNameHighlight('Bob', 'x')).toEqual([{ text: 'Bob', match: false }]);
  });

  it('asks for suggestion avatars async, and skips a missing one for a while', () => {
    expect(suggestionAvatarUrl('Q-Share+ #1')).toBe('/arbitrary/THUMBNAIL/Q-Share%2B%20%231/qortal_avatar?async=true');
    expect(avatarKnownMissing('Bob', 1_000)).toBe(false);
    rememberMissingAvatar('Bob', 1_000);
    expect(avatarKnownMissing('Bob', 1_000 + MISSING_AVATAR_RETRY_MS - 1)).toBe(true);
    expect(avatarKnownMissing('bob', 1_000)).toBe(false);
    // Core may have fetched it since: try again.
    expect(avatarKnownMissing('Bob', 1_000 + MISSING_AVATAR_RETRY_MS)).toBe(false);
    expect(avatarKnownMissing('Bob', 1_000)).toBe(false);
  });
});
