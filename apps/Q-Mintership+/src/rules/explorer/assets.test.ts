import { describe, expect, it } from 'vitest';
import {
  allocation,
  assetAvatarIdentifier,
  assetHue,
  assetInitials,
  assetMetaOf,
  assetsTotals,
  assetViews,
  bidLevels,
  buyOrderOf,
  dealOf,
  avatarAssetId,
  avatarPublishers,
  holdingOf,
  matchesAsset,
  orderLevelOf,
  ownedNotHeld,
  pricesFrom,
  qortWords,
  quantityWords,
  recentTradeOf,
  saleNow,
  shareOf,
  shareWords,
  sortAssets,
  worthOf,
  type AssetMeta,
  type Holding,
} from './assets';

const A = `Q${'a'.repeat(33)}`;
const B = `Q${'b'.repeat(33)}`;
const U = 100_000_000n;

const meta = (assetId: number, name: string, owner: string, units: bigint): AssetMeta => ({
  assetId,
  name,
  owner,
  description: '',
  quantity: units * U,
  isDivisible: true,
  isUnspendable: false,
});

describe('reading Core’s answers', () => {
  it('an asset from /assets, its quantity in atomic units up to 10^18', () => {
    expect(
      assetMetaOf({
        assetId: 11,
        owner: B,
        name: 'igorcoin',
        description: 'd',
        quantity: 109400000000,
        isDivisible: true,
        isUnspendable: false,
      })
    ).toEqual({
      assetId: 11,
      name: 'igorcoin',
      owner: B,
      description: 'd',
      quantity: 109_400_000_000n,
      isDivisible: true,
      isUnspendable: false,
    });
    expect(assetMetaOf({ assetId: 3, name: 'TEST', quantity: 1e18 })?.quantity).toBe(10n ** 18n);
    expect(assetMetaOf({ name: 'no id' })).toBeNull();
  });

  it('a holding from /assets/balances; QORT and nothing held are left out', () => {
    expect(
      holdingOf({ address: A, assetId: 6, balance: '2370.00000000', assetName: 'Q-Asset' })
    ).toEqual({ assetId: 6, name: 'Q-Asset', balance: 2370n * U });
    expect(
      holdingOf({ address: A, assetId: 0, balance: '6868.98667763', assetName: 'QORT' })
    ).toBeNull();
    expect(holdingOf({ address: A, assetId: 9, balance: '0E-8', assetName: 'Native' })).toBeNull();
    expect(holdingOf({ address: A, assetId: 9, balance: '1.00000000' })?.name).toBe('Asset #9');
  });
});

describe('a trade with its orders', () => {
  // Core's own answer (Simon's node): Simon's order paid 529 QORT for igorcoin's 23 igorcoin.
  const row = {
    trade: {
      initiatingOrderId: 'order-i',
      targetOrderId: 'order-t',
      targetAmount: '23.00000000',
      initiatorAmount: '529.00000000',
      timestamp: 1785356277321,
    },
    initiatingOrder: { creator: A, haveAssetId: 0, wantAssetId: 11 },
    targetOrder: { creator: B, haveAssetId: 11, wantAssetId: 0 },
  };

  it('the order that gave QORT bought', () => {
    expect(dealOf(row)).toEqual({
      at: 1785356277321,
      buyer: A,
      seller: B,
      units: 23n * U,
      qort: 529n * U,
      orderId: 'order-i',
    });
    const sold = {
      ...row,
      trade: { ...row.trade, initiatorAmount: '23.00000000', targetAmount: '529.00000000' },
      initiatingOrder: { creator: B, haveAssetId: 11, wantAssetId: 0 },
      targetOrder: { creator: A, haveAssetId: 0, wantAssetId: 11 },
    };
    expect(dealOf(sold)).toMatchObject({ buyer: A, seller: B, units: 23n * U, qort: 529n * U });
    expect(
      dealOf({ ...row, initiatingOrder: { creator: A, haveAssetId: 6, wantAssetId: 11 } })
    ).toBeNull();
  });
});

describe('prices from the latest trades', () => {
  // Core's own rows (Simon's node, 2026-10-21): Q-Asset sold for QORT, igorcoin bought with it.
  const rows = [
    {
      assetId: 6,
      otherAssetId: 0,
      otherAmount: '621.25000000',
      amount: '3500.00000000',
      timestamp: 2,
    },
    {
      assetId: 6,
      otherAssetId: 0,
      otherAmount: '327.48750000',
      amount: '1845.00000000',
      timestamp: 1,
    },
    {
      assetId: 0,
      otherAssetId: 11,
      otherAmount: '23.00000000',
      amount: '529.00000000',
      timestamp: 5,
    },
    { assetId: 6, otherAssetId: 11, otherAmount: '1.00000000', amount: '9.00000000', timestamp: 9 },
  ];
  const prices = pricesFrom(rows.map(recentTradeOf).filter((t) => t !== null));

  it('takes each asset’s newest trade with QORT, either way round', () => {
    expect(prices.get(6)).toEqual({
      perUnit: 17_750_000n,
      units: 3500n * U,
      qort: 62_125_000_000n,
      at: 2,
    });
    expect(prices.get(11)?.perUnit).toBe(23n * U);
    // A trade between two assets says nothing in QORT.
    expect(prices.size).toBe(2);
  });

  it('worth: the holding at that price, exact to the atomic unit', () => {
    expect(worthOf(2370n * U, prices.get(6)!)).toBe(42_067_500_000n);
    expect(qortWords(42_067_500_000n)).toBe('420.68');
    expect(qortWords(400_000n)).toBe('under 0.01');
    expect(qortWords(0n)).toBe('0');
  });
});

describe('what buyers would pay now', () => {
  // crowetic's soak (Simon, 2026-10-21): one sold for 700 QORT, so 70,000 "worth" 49,000,000.
  const order = (creator: string, price: string, amount: string, fulfilled = '0') =>
    buyOrderOf({ creator, price, amount, fulfilled })!;

  it('reads an open buy order: what it still wants', () => {
    expect(order(B, '0.17750000', '30000', '25900')).toEqual({
      creator: B,
      price: 17_750_000n,
      units: 4_100n * U,
    });
    expect(buyOrderOf({ creator: B, price: '1', amount: '5', fulfilled: '5' })).toBeNull();
  });

  it('sells into the best price first, until the holding or the buyers run out', () => {
    // Q-Asset: 4,100 at 0.1775, then 25,000 at 0.1666 (crowetic's 27,810.37 on Simon's node).
    const book = [order(B, '0.16660000', '25000'), order(B, '0.17750000', '4100')];
    const sale = saleNow(2_781_037_000_000n, book, A);
    expect(sale.qort).toBe(
      72_775_000_000n + ((2_781_037_000_000n - 410_000_000_000n) * 16_660_000n) / U
    );
    expect(sale.unsold).toBe(0n);
    expect(sale.bestBid).toBe(17_750_000n);
    // More than the buyers want: the rest is unsold.
    const big = saleNow(40_000n * U, book, A);
    expect(big.sold).toBe(29_100n * U);
    expect(big.unsold).toBe(10_900n * U);
    expect(big.atLeast).toBe(false);
    expect(saleNow(40_000n * U, book, A, true).atLeast).toBe(true);
  });

  it('no buyers: nothing, whatever its last trade said', () => {
    expect(saleNow(70_000n * U, [], A)).toEqual({
      qort: 0n,
      sold: 0n,
      unsold: 70_000n * U,
      atLeast: false,
    });
  });

  it('never sells to the account’s own buy orders', () => {
    const sale = saleNow(6n * U, [order(A, '20', '6'), order(B, '18', '4')], A);
    expect(sale).toMatchObject({ qort: 72n * U, sold: 4n * U, unsold: 2n * U, bestBid: 18n * U });
  });

  it('the book’s price levels', () => {
    expect(orderLevelOf({ price: '0.19200000', unfulfilled: '22310.00000000' })).toEqual({
      price: 19_200_000n,
      units: 22_310n * U,
    });
    expect(
      bidLevels([order(B, '1', '2'), order(A, '2', '1'), order(B, '1', '3')]).map((l) => [
        l.price,
        l.units,
      ])
    ).toEqual([
      [2n * U, U],
      [U, 5n * U],
    ]);
  });
});

describe('the account’s assets', () => {
  const catalogue = new Map([
    [6, meta(6, 'Q-Asset', B, 10_000_000n)],
    [11, meta(11, 'igorcoin', A, 1_094n)],
    [12, meta(12, 'GBC', A, 1n)],
    [13, meta(13, 'unpriced', B, 100n)],
  ]);
  const holdings: Holding[] = [
    { assetId: 6, name: 'Q-Asset', balance: 2370n * U },
    { assetId: 11, name: 'igorcoin', balance: 23n * U },
    { assetId: 13, name: 'unpriced', balance: 50n * U },
  ];
  const prices = pricesFrom([
    { assetId: 6, otherAssetId: 0, amount: 3500n * U, otherAmount: 62_125_000_000n, timestamp: 2 },
    { assetId: 0, otherAssetId: 11, amount: 529n * U, otherAmount: 23n * U, timestamp: 5 },
  ]);
  const views = assetViews(holdings, A, catalogue, prices);

  it('each with its asset, price, worth, share and whether the account owns it', () => {
    expect(views.find((v) => v.assetId === 11)).toMatchObject({ worth: 529n * U, owned: true });
    expect(views.find((v) => v.assetId === 11)?.share).toBeCloseTo(23 / 1094, 7);
    expect(views.find((v) => v.assetId === 13)).toMatchObject({ share: 0.5, owned: false });
    expect(views.find((v) => v.assetId === 13)?.worth).toBeUndefined();
    expect(shareWords(views.find((v) => v.assetId === 6)!.share!)).toBe('0.02 %');
  });

  it('assets it owns and holds none of', () => {
    expect(ownedNotHeld(catalogue, holdings, A).map((a) => a.assetId)).toEqual([12]);
  });

  it('sorts by worth (unpriced last), share, name or age', () => {
    expect(sortAssets(views, 'worth').map((v) => v.assetId)).toEqual([11, 6, 13]);
    expect(sortAssets(views, 'share').map((v) => v.assetId)).toEqual([13, 11, 6]);
    expect(sortAssets(views, 'name').map((v) => v.name)).toEqual([
      'igorcoin',
      'Q-Asset',
      'unpriced',
    ]);
    expect(sortAssets(views, 'id').map((v) => v.assetId)).toEqual([6, 11, 13]);
  });

  it('finds an asset by its name or its number', () => {
    expect(matchesAsset(views[0], 'q-a')).toBe(true);
    expect(matchesAsset(views[0], '#6')).toBe(true);
    expect(matchesAsset(views[0], '6')).toBe(true);
    expect(matchesAsset(views[0], 'igor')).toBe(false);
  });

  it('adds up what the priced ones are worth, and splits it for the bar', () => {
    expect(assetsTotals(views)).toMatchObject({
      held: 3,
      priced: 2,
      worth: 529n * U + 42_067_500_000n,
      saleRead: 0,
    });
    const sold = assetViews(
      holdings,
      A,
      catalogue,
      prices,
      new Map([
        [6, saleNow(2370n * U, [buyOrderOf({ creator: B, price: '0.1775', amount: '4100' })!], A)],
        [11, saleNow(23n * U, [buyOrderOf({ creator: B, price: '2', amount: '1' })!], A)],
        [13, saleNow(50n * U, [], A)],
      ])
    );
    expect(assetsTotals(sold)).toMatchObject({
      saleRead: 3,
      sale: 42_067_500_000n + 2n * U,
      saleAll: 1,
      salePart: 1,
      saleNone: 1,
    });
    expect(sortAssets(sold, 'sale').map((v) => v.assetId)).toEqual([6, 11, 13]);
    const parts = allocation(views);
    expect(parts.map((p) => p.assetId)).toEqual([11, 6]);
    expect(parts[0].fraction + parts[1].fraction).toBeCloseTo(1, 5);
    const many = Array.from({ length: 7 }, (_, i) => ({
      assetId: i + 1,
      name: `a${i}`,
      balance: U,
      worth: BigInt(10 - i) * U,
      owned: false,
    }));
    const five = allocation(many);
    expect(five).toHaveLength(5);
    expect(five[4]).toMatchObject({ assetId: null, name: '3 others', worth: (4n + 5n + 6n) * U });
  });
});

describe('words', () => {
  it('shares of all there is', () => {
    expect(shareWords(1)).toBe('100 %');
    expect(shareWords(0.71)).toBe('71 %');
    expect(shareWords(0.1)).toBe('10 %');
    expect(shareWords(0.021)).toBe('2.1 %');
    expect(shareWords(0.0024)).toBe('0.24 %');
    expect(shareWords(0.00004)).toBe('under 0.01 %');
    // Simon's 0.1 soak of 1,000,000,000: above none, so never "0 %".
    expect(shareWords(shareOf(10_000_000n, 10n ** 17n)!)).toBe('under 0.01 %');
    expect(shareWords(0.99996)).toBe('99.99 %');
  });

  it('big quantities in whole units', () => {
    expect(quantityWords(10n ** 18n)).toBe('10,000,000,000');
    expect(quantityWords(1_094n * U)).toBe('1,094');
    expect(quantityWords(150_000_000n)).toBe('1.5');
  });
});

describe('avatars', () => {
  it('the identifier the Q-Assets app publishes under, and back', () => {
    expect(assetAvatarIdentifier(88, 'BHC Coin')).toBe('asset88_BHC Coin_aavatar');
    expect(avatarAssetId('asset18_Fitness Club_aavatar')).toBe(18);
    expect(avatarAssetId('assetAvatar_default')).toBeNull();
  });

  it('only images for this very asset, its owner’s primary name first', () => {
    const resources = [
      { publisher: 'Biohackers Corner', identifier: 'asset88_BHC Coin_aavatar' },
      { publisher: 'Simon James', identifier: 'asset88_BHC Coin_aavatar' },
      { publisher: 'Someone', identifier: 'asset88_BHC_aavatar' },
    ];
    expect(avatarPublishers(resources, { assetId: 88, name: 'BHC Coin' }, 'Simon James')).toEqual([
      'Simon James',
      'Biohackers Corner',
    ]);
    expect(avatarPublishers(resources, { assetId: 87, name: 'BHC' }, null)).toEqual([]);
  });

  it('the coin’s letters', () => {
    expect(assetInitials('GEMCOIN')).toBe('G');
    expect(assetInitials('igorcoin')).toBe('I');
    expect(assetInitials('BHC')).toBe('BHC');
    expect(assetInitials('BHC Coin')).toBe('BC');
    expect(assetInitials('Bean Token')).toBe('BT');
    expect(assetInitials('Ben’s Tickets')).toBe('BT');
    expect(assetInitials('Q-Asset')).toBe('QA');
    expect(assetInitials('10Coin')).toBe('10');
    expect(assetInitials('🐉')).toBe('🐉');
    expect(assetInitials('💦')).toBe('💦');
    expect(assetInitials('https://kick.com/jesusavgn')).toBe('KC');
    expect(assetInitials('viinakõri')).toBe('V');
    expect(assetInitials('  ')).toBe('#');
  });

  it('neighbouring assets get colours far apart', () => {
    expect(assetHue(1)).toBe(138);
    expect(Math.abs(assetHue(2) - assetHue(1))).toBeGreaterThan(90);
  });
});
