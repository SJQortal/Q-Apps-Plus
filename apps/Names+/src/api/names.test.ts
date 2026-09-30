import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchCalls,
  fetchCallsFor,
  mockFetchRoute,
  mockQortalRequest,
  qortalCallsFor,
} from '../test/setup';
import {
  ACCOUNT_NAMES_PAGE,
  checkAvatars,
  fetchAccountNames,
  fetchNamesForSale,
  FOR_SALE_PAGE,
  forgetAvatar,
  getUnitFee,
  knownAvatar,
  resetNamesApiCaches,
} from './names';

const row = (i: number) => ({ name: `name${i}`, salePrice: i });

describe('names for sale', () => {
  it('loads page by page, never with limit=0, and reports each page', async () => {
    const total = FOR_SALE_PAGE * 2 + 30;
    mockFetchRoute('/names/forsale', (url) => {
      const limit = Number(url.searchParams.get('limit'));
      const offset = Number(url.searchParams.get('offset'));
      expect(limit).toBe(FOR_SALE_PAGE);
      return Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) =>
        row(offset + i)
      );
    });
    const pages: Array<[number, boolean]> = [];
    const rows = await fetchNamesForSale({ onPage: (r, done) => pages.push([r.length, done]) });
    expect(rows).toHaveLength(total);
    expect(fetchCallsFor('/names/forsale')).toHaveLength(3);
    expect(fetchCalls.some((path) => /limit=0(&|$)/.test(path))).toBe(false);
    expect(pages).toEqual([
      [FOR_SALE_PAGE, false],
      [FOR_SALE_PAGE * 2, false],
      [total, true],
    ]);
  });

  it('stops after one short page', async () => {
    mockFetchRoute('/names/forsale', [row(1), row(2)]);
    await expect(fetchNamesForSale()).resolves.toHaveLength(2);
    expect(fetchCallsFor('/names/forsale')).toHaveLength(1);
  });

  it('throws on a node error instead of storing garbage', async () => {
    mockFetchRoute('/names/forsale', () => new Response('nope', { status: 500 }));
    await expect(fetchNamesForSale()).rejects.toThrow(/500/);
  });
});

describe('account names', () => {
  it('pages GET_ACCOUNT_NAMES and merges duplicates', async () => {
    mockQortalRequest('GET_ACCOUNT_NAMES', (request) => {
      expect(request.limit).toBe(ACCOUNT_NAMES_PAGE);
      const offset = Number(request.offset);
      if (offset === 0) {
        return Array.from({ length: ACCOUNT_NAMES_PAGE }, (_, i) => ({ name: `n${i}`, owner: 'Q1' }));
      }
      return [
        { name: 'n0', owner: 'Q1' },
        { name: 'last', owner: 'Q1' },
      ];
    });
    const names = await fetchAccountNames('Q1');
    expect(names).toHaveLength(ACCOUNT_NAMES_PAGE + 1);
    expect(qortalCallsFor('GET_ACCOUNT_NAMES')).toHaveLength(2);
  });
});

describe('unit fee', () => {
  beforeEach(() => resetNamesApiCaches());

  it('converts from QORT satoshis and fetches once per type', async () => {
    mockFetchRoute('/transactions/unitfee', '125000000');
    await expect(getUnitFee('REGISTER_NAME')).resolves.toBe(1.25);
    await expect(getUnitFee('REGISTER_NAME')).resolves.toBe(1.25);
    await getUnitFee('SELL_NAME');
    expect(fetchCallsFor('/transactions/unitfee')).toEqual([
      '/transactions/unitfee?txType=REGISTER_NAME',
      '/transactions/unitfee?txType=SELL_NAME',
    ]);
  });

  it('forgets a failed lookup so the next call retries', async () => {
    mockFetchRoute('/transactions/unitfee', () => new Response('', { status: 503 }));
    await expect(getUnitFee('BUY_NAME')).rejects.toThrow(/503/);
    mockFetchRoute('/transactions/unitfee', '1000000');
    await expect(getUnitFee('BUY_NAME')).resolves.toBe(0.01);
  });
});

describe('avatar check', () => {
  beforeEach(() => resetNamesApiCaches());

  it('asks for every name in one exact-match search and caches both answers', async () => {
    const search = vi.fn((url) => {
      expect(url.searchParams.get('service')).toBe('THUMBNAIL');
      expect(url.searchParams.get('identifier')).toBe('qortal_avatar');
      expect(url.searchParams.get('prefix')).toBeNull();
      expect(url.searchParams.getAll('name')).toEqual(['alice', 'bob smith', 'carol']);
      expect(url.searchParams.get('limit')).toBe('3');
      return [{ name: 'alice', service: 'THUMBNAIL', identifier: 'qortal_avatar' }];
    });
    mockFetchRoute('/arbitrary/resources/searchsimple', search);

    const first = await checkAvatars(['alice', 'bob smith', 'carol', 'alice']);
    expect([...first.entries()]).toEqual([
      ['alice', true],
      ['bob smith', false],
      ['carol', false],
    ]);
    expect(search).toHaveBeenCalledTimes(1);
    expect(fetchCalls[0]).toContain('name=bob%20smith');

    // Cached: no second request, not even for the names without an avatar.
    await checkAvatars(['carol', 'alice']);
    expect(search).toHaveBeenCalledTimes(1);
    expect(knownAvatar('carol')).toBe(false);

    // After a publish the app forgets one name; only that one is asked again.
    forgetAvatar('carol');
    mockFetchRoute('/arbitrary/resources/searchsimple', (url) => {
      expect(url.searchParams.getAll('name')).toEqual(['carol']);
      return [{ name: 'carol' }];
    });
    await expect(checkAvatars(['alice', 'carol'])).resolves.toEqual(
      new Map([
        ['alice', true],
        ['carol', true],
      ])
    );
  });

  it('merges concurrent callers into one request', async () => {
    const search = vi.fn(() => [{ name: 'alice' }]);
    mockFetchRoute('/arbitrary/resources/searchsimple', search);
    const [a, b] = await Promise.all([checkAvatars(['alice', 'bob']), checkAvatars(['bob'])]);
    expect(a.get('alice')).toBe(true);
    expect(b.get('bob')).toBe(false);
    expect(search).toHaveBeenCalledTimes(1);
  });
});
