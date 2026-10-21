/**
 * The Q-Assets reads (assets.ts; Simon, 2026-10-21), in the mock world: Ben
 * Target holds five assets, GEMCOIN priced by his own trade with Pia
 * Promote, Bean Token and 🐉 by trades between others.
 */
import { describe, expect, it } from 'vitest';
import { fetchCallsFor, mockFetchRoute } from '../../test/setup';
import { ADDR, installWorld } from '../../test/world';
import {
  getAssetAvatars,
  getAssetDeals,
  getAssetList,
  getAssetPrices,
  getAssetSales,
  getHoldings,
  getSellOffers,
  getTopHolders,
  HOLDERS_READ,
} from './assets';

const U = 100_000_000n;
const params = (path: string) => new URL(path, 'http://x').searchParams;

describe('what an account holds', () => {
  it('reads its balances 100 at a time, zero balances and QORT left out', async () => {
    installWorld('learner', { strict: true });
    const ben = await getHoldings(ADDR.banTarget);
    expect(ben.rows.map((h) => [h.assetId, h.name, h.balance])).toEqual([
      [77, 'GEMCOIN', 6n * U],
      [78, 'Bean Token', 2_550_000_000n],
      [79, '🐉', 2n * U],
      [80, 'Moonrise No. 1', U],
      [81, 'The Harbour Lighthouse Restoration Fund', 1_234_567_800_000n],
    ]);
    expect(ben.truncated).toBe(false);
    const [read] = fetchCallsFor('/assets/balances').map(params);
    expect(read.get('address')).toBe(ADDR.banTarget);
    expect(read.get('excludeZero')).toBe('true');
    expect(read.get('limit')).toBe('100');
    // Read once for the session's while.
    await getHoldings(ADDR.banTarget);
    expect(fetchCallsFor('/assets/balances')).toHaveLength(1);
    expect((await getHoldings(ADDR.left)).rows).toEqual([]);
  });

  it('Core’s asset list in one read: owners, quantities and descriptions, no data', async () => {
    installWorld('learner', { strict: true });
    const list = await getAssetList();
    expect(list.get(77)).toMatchObject({
      name: 'GEMCOIN',
      owner: ADDR.promote,
      quantity: 1000n * U,
    });
    expect(list.get(81)?.quantity).toBe(10n ** 18n);
    expect(list.get(1)?.isUnspendable).toBe(true);
    expect(params(fetchCallsFor('/assets?')[0]).get('includeData')).toBe('false');
  });
});

describe('prices', () => {
  it('both ways round in two reads: the asset sold for QORT, and QORT paid for it', async () => {
    installWorld('learner', { strict: true });
    const prices = await getAssetPrices(ADDR.banTarget, [77, 78, 79, 80, 81]);
    const reads = fetchCallsFor('/assets/trades/recent').map(params);
    expect(reads).toHaveLength(2);
    expect(reads[0].getAll('assetid')).toEqual(['77', '78', '79', '80', '81']);
    expect(reads[0].getAll('otherassetid')).toEqual(['0']);
    expect(reads[1].getAll('assetid')).toEqual(['0']);
    expect(reads[1].getAll('otherassetid')).toEqual(['77', '78', '79', '80', '81']);
    expect(reads.every((r) => r.get('limit') === '10')).toBe(true);
    // GEMCOIN: Ben paid 120 QORT for 6. Bean Token: the newer of two sales. 🐉: 75 QORT.
    expect(prices.get(77)?.perUnit).toBe(20n * U);
    expect(prices.get(78)?.perUnit).toBe(U / 2n);
    expect(prices.get(79)?.perUnit).toBe(75n * U);
    expect(prices.has(80)).toBe(false);
  });

  it('40 assets a read', async () => {
    installWorld('learner', { strict: true });
    mockFetchRoute('/assets/trades/recent', []);
    await getAssetPrices(
      ADDR.kicked,
      Array.from({ length: 90 }, (_, i) => i + 1)
    );
    expect(fetchCallsFor('/assets/trades/recent')).toHaveLength(6);
  });
});

describe('avatars', () => {
  it('one search for every asset avatar the Q-Assets app published', async () => {
    installWorld('learner', { strict: true });
    const avatars = await getAssetAvatars();
    const [read] = fetchCallsFor('/arbitrary/resources/search').map(params);
    expect([read.get('service'), read.get('identifier'), read.get('prefix')]).toEqual([
      'IMAGE',
      'asset',
      'true',
    ]);
    expect(read.get('limit')).toBe('100');
    expect(avatars.get(77)).toEqual([
      { publisher: 'Pia Promote', identifier: 'asset77_GEMCOIN_aavatar' },
    ]);
    // Kit's image for Nora's asset is found here; the tab shows only the owner's.
    expect(avatars.get(78)?.[0].publisher).toBe('Kit Kicked');
  });
});

describe('an asset opened', () => {
  it('its biggest holders, the first 100, biggest first', async () => {
    installWorld('learner', { strict: true });
    const holders = await getTopHolders(78);
    expect(holders.rows.map((h) => h.address)).toEqual([
      ADDR.nominator,
      ADDR.learner,
      ADDR.banTarget,
      ADDR.admin,
    ]);
    expect(holders.truncated).toBe(false);
    const [read] = fetchCallsFor('/assets/balances').map(params);
    expect([read.get('assetid'), read.get('reverse'), read.get('limit')]).toEqual([
      '78',
      'true',
      String(HOLDERS_READ),
    ]);
  });

  it('its latest trades with QORT, both ways round, who bought from whom', async () => {
    installWorld('learner', { strict: true });
    const deals = await getAssetDeals(77);
    expect(fetchCallsFor(/\/assets\/trades\/(77\/0|0\/77)\?/)).toHaveLength(2);
    expect(deals).toEqual([
      expect.objectContaining({
        buyer: ADDR.banTarget,
        seller: ADDR.promote,
        units: 6n * U,
        qort: 120n * U,
      }),
    ]);
  });
});

describe('what buyers would pay now', () => {
  it('reads each held asset’s open buy orders, the best first, and never counts its own', async () => {
    installWorld('learner', { strict: true });
    const ben = await getHoldings(ADDR.banTarget);
    const sales = await getAssetSales(ADDR.banTarget, ben.rows);
    const reads = fetchCallsFor('/assets/openorders/0/');
    expect(reads).toHaveLength(5);
    for (const read of reads.map(params)) {
      expect(read.get('reverse')).toBe('true');
      expect(read.get('limit')).toBe('100');
    }
    // GEMCOIN: Ben's own order at 20 skipped; 4 at 18 and 2 at 15.
    expect(sales.get(77)).toMatchObject({ qort: 102n * U, unsold: 0n, bestBid: 18n * U });
    // Bean Token: 25.5 at 0.45.
    expect(sales.get(78)?.qort).toBe(1_147_500_000n);
    // 🐉: no buyers at all.
    expect(sales.get(79)).toMatchObject({ qort: 0n, sold: 0n, unsold: 2n * U });
    // The fund: buyers for 5,000 of 12,345.678.
    expect(sales.get(81)).toMatchObject({ qort: 50_000_000n, unsold: 734_567_800_000n });
  });

  it('an asset’s cheapest sell offers, by price', async () => {
    installWorld('learner', { strict: true });
    expect(await getSellOffers(77)).toEqual([{ price: 22n * U, units: 3n * U }]);
    expect(params(fetchCallsFor('/assets/orderbook/77/0')[0]).get('limit')).toBe('5');
  });
});
