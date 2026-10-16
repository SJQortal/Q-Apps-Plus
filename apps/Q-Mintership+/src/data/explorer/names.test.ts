import { beforeEach, describe, expect, it } from 'vitest';
import { queryLoadCounts, resetQueries } from '../query';
import { fetchCallsFor, mockFetchRoute } from '../../test/setup';
import { ADDR } from '../../test/world';
import { nameContainsKey, searchNamesContaining } from './names';

beforeEach(() => resetQueries());

describe('names that contain some text', () => {
  it('asks Core for one page of 10 names matching anywhere, and keeps well-formed rows', async () => {
    let seen: URLSearchParams | null = null;
    mockFetchRoute('/names/search', (url: URL) => {
      seen = url.searchParams;
      return [
        { name: 'Q-Maps', owner: ADDR.nominator },
        { name: 'Q-Maps', owner: ADDR.nominator },
        { name: 'Qortal Maps', owner: ADDR.learner },
        { name: 'No owner' },
        { name: 'Bad', owner: 'nope' },
      ];
    });
    expect(await searchNamesContaining(' maps ')).toEqual([
      { name: 'Q-Maps', owner: ADDR.nominator },
      { name: 'Qortal Maps', owner: ADDR.learner },
    ]);
    expect(seen!.get('query')).toBe('maps');
    expect(seen!.get('prefix')).toBe('false');
    expect(seen!.get('limit')).toBe('10');
  });

  it('is kept for the session under one key per spelling, any case', async () => {
    mockFetchRoute('/names/search', () => []);
    expect(nameContainsKey(' MAPS ')).toBe('xnamecontains:maps');
    await searchNamesContaining('Maps');
    await searchNamesContaining('maps');
    expect(fetchCallsFor('/names/search')).toHaveLength(1);
    expect(queryLoadCounts().xnamecontains).toBe(1);
  });

  it('asks nothing for blank text', async () => {
    expect(await searchNamesContaining('  ')).toEqual([]);
    expect(fetchCallsFor('/names/search')).toHaveLength(0);
  });
});
