/**
 * What an account made in Q-Mintership+ (madeBy.ts): each prefix parsed from
 * identifiers alone, rows kept only under the account's exact names, the
 * names searched 40 at a time with the service always set, ceilings said,
 * and the encrypted Minter Admin records counted and nothing more.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeAddress, fakeKey } from '../../../e2e/world.mjs';
import { fetchCallsFor, mockFetchRoute } from '../../test/setup';
import { installWorld } from '../../test/world';
import type { QdnRow } from '../types';
import {
  MADE_PAGES,
  NAME_CHUNK,
  chunked,
  exactRows,
  loadMadeBy,
  madeFromRows,
  parseMadeRow,
} from './madeBy';

afterEach(() => vi.useRealTimers());

const BOB = fakeAddress('made-bob');
const SIG40 = fakeKey('made-decision', 64).slice(0, 40);
const row = (name: string, identifier: string, created = 1_000, updated?: number): QdnRow => ({
  name,
  service: 'JSON',
  identifier,
  created,
  ...(updated ? { updated } : {}),
});

describe('madeFromRows', () => {
  it('parses each kind from its identifier alone, newest first', () => {
    const made = madeFromRows(
      ['Nora', 'Spare'],
      [
        {
          kind: 'nomination',
          rows: [
            row('Nora', `qmp-nomination-${BOB}`, 5_000),
            row('Nora', 'qmp-nomination-not-an-address', 6_000),
          ],
          truncated: false,
        },
        { kind: 'support', rows: [row('Spare', `qmp-support-${BOB}`, 4_000)], truncated: false },
        {
          kind: 'vote',
          rows: [
            row('Nora', `qmp-vote-${BOB}-yes-abc123`, 1_000),
            row('Nora', `qmp-vote-${BOB}-no-def456`, 2_000),
            row('Nora', `qmp-vote-${BOB}-maybe-abc123`, 3_000),
          ],
          truncated: false,
        },
        {
          kind: 'comment',
          rows: [
            row('Nora', `qmp-comment-${BOB}-abc123`, 1_000),
            row('Spare', `qmp-comment-${SIG40}-def456`, 2_000, 9_000),
          ],
          truncated: false,
        },
        {
          kind: 'considering',
          rows: [row('Spare', `qmp-considering-${SIG40}`, 3_000)],
          truncated: true,
        },
      ]
    );
    expect(made.nominations).toEqual([
      { name: 'Nora', identifier: `qmp-nomination-${BOB}`, at: 5_000, nominee: BOB },
    ]);
    expect(made.supports.map((s) => [s.name, s.nominee])).toEqual([['Spare', BOB]]);
    expect(made.votes.map((v) => [v.vote, v.at])).toEqual([
      ['no', 2_000],
      ['yes', 1_000],
    ]);
    // An edited comment counts by its newest publish.
    expect(made.comments.map((c) => [c.about, c.key, c.at])).toEqual([
      ['decision', SIG40, 9_000],
      ['nomination', BOB, 1_000],
    ]);
    expect(made.considering.map((c) => [c.about, c.key])).toEqual([['decision', SIG40]]);
    expect(made.unreadable).toBe(2);
    expect(made.namesWithRecords).toEqual(['Nora', 'Spare']);
    expect(made.truncated).toEqual(['considering']);
  });

  it('keeps only rows published under one of the names exactly, each once', () => {
    const kept = exactRows(
      [
        row('Nora', `qmp-nomination-${BOB}`),
        row('Nora Nominator', `qmp-nomination-${BOB}`),
        row('nora', `qmp-nomination-${BOB}`),
        row('Nora', `qmp-nomination-${BOB}`),
      ],
      new Set(['Nora'])
    );
    expect(kept.map((r) => r.name)).toEqual(['Nora']);
    const made = madeFromRows(
      ['Nora'],
      [
        {
          kind: 'nomination',
          rows: [row('Nora Nominator', `qmp-nomination-${BOB}`)],
          truncated: false,
        },
      ]
    );
    expect(made.nominations).toEqual([]);
    expect(made.namesWithRecords).toEqual([]);
  });

  it('counts the encrypted Minter Admin records and keeps nothing else of them', () => {
    const made = madeFromRows(
      ['Nora'],
      [
        {
          kind: 'admin',
          rows: [
            { ...row('Nora', 'qmp-adminpoll-secret1'), service: 'DOCUMENT_PRIVATE' },
            { ...row('Nora', 'qmp-adminvote-secret1'), service: 'DOCUMENT_PRIVATE' },
            { ...row('Someone', 'qmp-adminvote-secret2'), service: 'DOCUMENT_PRIVATE' },
          ],
          truncated: false,
        },
      ]
    );
    expect(made.adminRecords).toBe(2);
    expect(made.namesWithRecords).toEqual(['Nora']);
    expect(JSON.stringify(made)).not.toMatch(/secret/);
  });

  it('only parses rows of the prefix searched', () => {
    expect(parseMadeRow('support', row('Nora', `qmp-nomination-${BOB}`))).toBeNull();
    expect(parseMadeRow('considering', row('Nora', `qmp-considering-${BOB}`))).toMatchObject({
      kind: 'considering',
      item: { key: BOB, about: 'nomination' },
    });
  });
});

describe('loadMadeBy', () => {
  it('searches every prefix with the service, 40 names at a time, and filters by name', async () => {
    installWorld('admin', { strict: true });
    const owner = fakeAddress('made-many-names');
    const names = Array.from({ length: 85 }, (_, i) => `Many ${i}`);
    mockFetchRoute(`/names/address/${owner}`, (url: URL) => {
      const offset = Number(url.searchParams.get('offset'));
      return names.slice(offset, offset + 100).map((name) => ({ name, owner }));
    });
    mockFetchRoute('/arbitrary/resources/searchsimple', (url: URL) => {
      const sp = url.searchParams;
      if (sp.get('identifier') !== 'qmp-nomination-' || sp.get('offset') !== '0') return [];
      const asked = sp.getAll('name');
      // Core's prefix match also finds a longer name.
      return asked.includes('Many 84')
        ? [row('Many 84', `qmp-nomination-${BOB}`, 7_000), row('Many 840', `qmp-support-${BOB}`)]
        : [];
    });
    const made = await loadMadeBy(owner);
    const calls = fetchCallsFor('/arbitrary/resources/searchsimple').map(
      (path) => new URL(path, 'http://x').searchParams
    );
    // Five kinds and the encrypted records, each for 3 chunks of names.
    expect(calls).toHaveLength(6 * 3);
    for (const sp of calls) {
      expect(sp.get('service')).toMatch(/^(JSON|DOCUMENT_PRIVATE)$/);
      expect(sp.get('prefix')).toBe('true');
      expect(sp.get('limit')).toBe('100');
      expect(sp.get('reverse')).toBe('true');
      expect(sp.getAll('name').length).toBeLessThanOrEqual(NAME_CHUNK);
    }
    expect(
      calls
        .filter((sp) => sp.get('identifier') === 'qmp-vote-')
        .map((sp) => sp.getAll('name').length)
    ).toEqual([40, 40, 5]);
    expect(new Set(calls.map((sp) => sp.get('identifier')))).toEqual(
      new Set([
        'qmp-nomination-',
        'qmp-support-',
        'qmp-vote-',
        'qmp-comment-',
        'qmp-considering-',
        'qmp-admin',
      ])
    );
    expect(made.names).toHaveLength(85);
    expect(made.nominations.map((n) => n.name)).toEqual(['Many 84']);
    expect(made.supports).toEqual([]);
    expect(made.namesWithRecords).toEqual(['Many 84']);
  });

  it('stops a search at 3 pages a chunk and says which kind did', async () => {
    installWorld('admin', { strict: true });
    const owner = fakeAddress('made-busy');
    mockFetchRoute(`/names/address/${owner}`, [{ name: 'Busy', owner }]);
    mockFetchRoute('/arbitrary/resources/searchsimple', (url: URL) => {
      const sp = url.searchParams;
      if (sp.get('identifier') !== 'qmp-comment-') return [];
      const offset = Number(sp.get('offset'));
      return Array.from({ length: 100 }, (_, i) =>
        row('Busy', `qmp-comment-${BOB}-c${String(offset + i).padStart(5, '0')}`, offset + i)
      );
    });
    const made = await loadMadeBy(owner);
    expect(made.comments).toHaveLength(100 * MADE_PAGES);
    expect(made.truncated).toEqual(['comment']);
  });

  it('reads nothing more for an account with no names', async () => {
    installWorld('admin', { strict: true });
    const owner = fakeAddress('made-nameless');
    mockFetchRoute(`/names/address/${owner}`, []);
    const made = await loadMadeBy(owner);
    expect(made.names).toEqual([]);
    expect(fetchCallsFor('/arbitrary/resources/searchsimple')).toEqual([]);
  });

  it('splits names into chunks of 40', () => {
    expect(chunked(Array.from({ length: 81 }, (_, i) => i)).map((c) => c.length)).toEqual([
      40, 40, 1,
    ]);
  });
});
