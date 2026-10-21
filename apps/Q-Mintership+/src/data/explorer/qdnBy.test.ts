import { beforeEach, describe, expect, it } from 'vitest';
import { fetchCallsFor, mockFetchRoute } from '../../test/setup';
import { queryLoadCounts, resetQueries } from '../query';
import {
  autoQdnNames,
  formatSize,
  getQdnOfName,
  qdnNameKey,
  QDN_NAME_LIMIT,
  searchQdnNames,
  summarizeQdn,
  type QdnOfName,
  type QdnSearchResult,
} from './qdnBy';

beforeEach(() => resetQueries());

const resource = (name: string, service: string, identifier: string | null, created: number) => ({
  name,
  service,
  ...(identifier ? { identifier } : {}),
  size: 300,
  created,
  latestSignature: 'x',
});

describe('getQdnOfName', () => {
  it('reads one name, newest first, and keeps only rows of exactly that name', async () => {
    mockFetchRoute('/arbitrary/resources/searchsimple', [
      resource('Maps', 'APP', null, 3),
      // A wider match (another name that starts the same): never counted.
      resource('Maps Two', 'WEBSITE', 'default', 2),
      resource('Maps', 'JSON', 'settings', 1),
    ]);
    const result = await getQdnOfName('Maps');
    expect(result).toEqual({
      name: 'Maps',
      capped: false,
      resources: [
        { name: 'Maps', service: 'APP', identifier: null, size: 300, created: 3 },
        { name: 'Maps', service: 'JSON', identifier: 'settings', size: 300, created: 1 },
      ],
    });
    expect(fetchCallsFor('/arbitrary/')).toEqual([
      '/arbitrary/resources/searchsimple?name=Maps&limit=100&reverse=true',
    ]);
    expect(qdnNameKey('Maps')).toBe('xqdnname:Maps');
  });

  it('never keeps an encrypted resource’s identifier', async () => {
    mockFetchRoute('/arbitrary/resources/searchsimple', [
      resource('Maps', 'MAIL_PRIVATE', 'qortal_qmail_secret', 2),
      resource('Maps', 'MAIL', 'qortal_qmail_old', 1),
    ]);
    const result = await getQdnOfName('Maps');
    expect(result.resources.map((r) => r.identifier)).toEqual([null, null]);
    expect(JSON.stringify(result)).not.toMatch(/qortal_qmail/);
  });

  it('says when a name filled the page', async () => {
    mockFetchRoute(
      '/arbitrary/resources/searchsimple',
      Array.from({ length: QDN_NAME_LIMIT }, (_, i) => resource('Maps', 'DOCUMENT', `d${i}`, i))
    );
    expect((await getQdnOfName('Maps')).capped).toBe(true);
  });
});

describe('autoQdnNames', () => {
  const names = Array.from({ length: 30 }, (_, i) => `n${i}`);

  it('takes the primary name, then the ones registered most recently', () => {
    expect(autoQdnNames(names, 'n2')).toEqual([
      'n2',
      'n29',
      'n28',
      'n27',
      'n26',
      'n25',
      'n24',
      'n23',
      'n22',
      'n21',
    ]);
    // The primary among the newest is not taken twice.
    expect(autoQdnNames(names, 'n29', 3)).toEqual(['n29', 'n28', 'n27']);
    expect(autoQdnNames(names, null, 2)).toEqual(['n29', 'n28']);
    expect(autoQdnNames(['a', 'b'], 'a')).toEqual(['a', 'b']);
  });
});

describe('searchQdnNames', () => {
  it('reads at most 4 names at once, and skips the rest once stopped', async () => {
    let running = 0;
    let most = 0;
    mockFetchRoute('/arbitrary/resources/searchsimple', async (url: URL) => {
      running += 1;
      most = Math.max(most, running);
      await new Promise((r) => setTimeout(r, 5));
      running -= 1;
      return [resource(url.searchParams.get('name') ?? '', 'APP', null, 1)];
    });
    const seen: string[] = [];
    let stop = false;
    await searchQdnNames(
      Array.from({ length: 12 }, (_, i) => `n${i}`),
      {
        onResult: (name: string, result: QdnSearchResult) => {
          seen.push(name);
          expect(result.ok).toBe(true);
          if (seen.length === 6) stop = true;
        },
        stopped: () => stop,
      }
    );
    expect(most).toBe(4);
    // The 4 running when Stop came finish; nothing new starts.
    expect(seen.length).toBeLessThan(12);
    expect(queryLoadCounts().xqdnname).toBe(seen.length);
  });

  it('reports a failed name without stopping the others', async () => {
    mockFetchRoute('/arbitrary/resources/searchsimple', (url: URL) =>
      url.searchParams.get('name') === 'bad'
        ? new Response('{"error":5}', { status: 500 })
        : [resource(url.searchParams.get('name') ?? '', 'APP', null, 1)]
    );
    const results = new Map<string, QdnSearchResult>();
    await searchQdnNames(['good', 'bad', 'fine'], {
      onResult: (name, result) => results.set(name, result),
    });
    expect(Object.fromEntries([...results].map(([name, r]) => [name, r.ok]))).toEqual({
      good: true,
      bad: false,
      fine: true,
    });
  });
});

describe('summarizeQdn', () => {
  const of = (name: string, rows: Array<[string, number]>, capped = false): QdnOfName => ({
    name,
    capped,
    resources: rows.map(([service, created]) => ({
      name,
      service,
      identifier: service.endsWith('_PRIVATE') ? null : `${service}-${created}`,
      size: 10,
      created,
    })),
  });

  it('counts per service, marks partial counts, and lists only what isn’t encrypted', () => {
    const summary = summarizeQdn([
      of('a', [
        ['JSON', 5],
        ['APP', 9],
      ]),
      of(
        'b',
        [
          ['JSON', 7],
          ['MAIL_PRIVATE', 8],
        ],
        true
      ),
    ]);
    expect(summary.total).toBe(4);
    expect(summary.counts).toEqual([
      { service: 'APP', count: 1, partial: false, encrypted: false },
      { service: 'JSON', count: 2, partial: true, encrypted: false },
      { service: 'MAIL_PRIVATE', count: 1, partial: true, encrypted: true },
    ]);
    expect(summary.listed.map((r) => r.created)).toEqual([9, 7, 5]);
    expect(summary.encrypted).toBe(1);
    expect(summary.capped).toEqual(['b']);
  });
});

describe('formatSize', () => {
  it('reads sizes in plain units', () => {
    expect(formatSize(1)).toBe('1 byte');
    expect(formatSize(240)).toBe('240 bytes');
    expect(formatSize(1_229)).toBe('1.2 KB');
    expect(formatSize(52_000_000)).toBe('49.6 MB');
  });
});
