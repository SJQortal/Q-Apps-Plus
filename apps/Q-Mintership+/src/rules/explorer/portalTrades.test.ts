import { describe, expect, it } from 'vitest';
import {
  chainOfOffer,
  coinPerQort,
  coinWords,
  offerOutcomes,
  periodLabel,
  periodUnit,
  soldAts,
  summariseOffers,
  summarisePortal,
  volumeByPeriod,
  type PortalTrade,
} from './portalTrades';

const QORT = 100_000_000n;
const day = (iso: string) => new Date(`${iso}T12:00:00`).getTime();

const trade = (over: Partial<PortalTrade>): PortalTrade => ({
  chain: 'LITECOIN',
  side: 'sold',
  qort: 100n * QORT,
  coin: QORT / 3n,
  at: `A${Math.random()}`,
  other: 'Qbuyer',
  timestamp: day('2026-05-10'),
  ...over,
});

describe('a trade offer’s coin', () => {
  it('comes from its tags, else its name', () => {
    expect(chainOfOffer('ACCT QORT LTC', 'QORT/LTC ACCT')).toBe('LITECOIN');
    expect(chainOfOffer('ACCT QORT DOGE')).toBe('DOGECOIN');
    expect(chainOfOffer('', 'QORT/ARRR ACCT')).toBe('PIRATECHAIN');
    expect(chainOfOffer('ACCT QORT XMR')).toBeNull();
    expect(chainOfOffer(undefined)).toBeNull();
  });
});

describe('the Q-Trade summary', () => {
  it('adds up each coin and side, in the coins’ own order, with the first and latest', () => {
    const summary = summarisePortal([
      trade({
        chain: 'DOGECOIN',
        qort: 50n * QORT,
        coin: 107n * QORT,
        timestamp: day('2026-03-01'),
      }),
      trade({ qort: 200n * QORT, coin: QORT, timestamp: day('2026-04-01') }),
      trade({ side: 'bought', qort: 30n * QORT, coin: QORT / 10n, other: 'Qseller' }),
    ]);
    expect(summary.coins.map((coin) => coin.chain)).toEqual(['LITECOIN', 'DOGECOIN']);
    expect(summary.coins[0].sold).toEqual({ count: 1, qort: 200n * QORT, coin: QORT });
    expect(summary.coins[0].bought).toEqual({ count: 1, qort: 30n * QORT, coin: QORT / 10n });
    expect(summary.sold).toEqual({ count: 2, qort: 250n * QORT, coin: 108n * QORT });
    expect(summary.first).toBe(day('2026-03-01'));
    expect(summary.last).toBe(day('2026-05-10'));
    expect(summary.biggestSale?.qort).toBe(200n * QORT);
    expect(summary.biggestBuy?.qort).toBe(30n * QORT);
  });

  it('names its partners, most trades first, then most QORT', () => {
    const summary = summarisePortal([
      trade({ other: 'Qa', qort: QORT }),
      trade({ other: 'Qb', qort: 5n * QORT }),
      trade({ other: 'Qb', side: 'bought', qort: QORT }),
      trade({ other: 'Qc', qort: 9n * QORT }),
      trade({ other: '' }),
    ]);
    expect(summary.partners).toEqual([
      { address: 'Qb', sold: 1, bought: 1, qort: 6n * QORT },
      { address: 'Qc', sold: 1, bought: 0, qort: 9n * QORT },
      { address: 'Qa', sold: 1, bought: 0, qort: QORT },
    ]);
  });

  it('keeps the earlier of two biggest trades the same size', () => {
    const early = trade({ qort: 9n * QORT, timestamp: day('2026-01-01') });
    const late = trade({ qort: 9n * QORT, timestamp: day('2026-02-01') });
    expect(summarisePortal([late, early]).biggestSale).toBe(early);
  });
});

describe('its trade offers', () => {
  const deployed = (at: string, chain: 'LITECOIN' | 'DOGECOIN' | null = 'LITECOIN') => ({
    at,
    chain,
    qort: 10n * QORT,
    timestamp: 0,
  });

  it('completed when sold, ended when paid back without a sale, open otherwise', () => {
    const offers = offerOutcomes(
      [deployed('A1'), deployed('A2'), deployed('A3'), deployed('A4', 'DOGECOIN')],
      soldAts([trade({ at: 'A1' }), trade({ at: 'A9', side: 'bought' })]),
      // A sold AT pays back what is left for its fees: still completed.
      new Set(['A1', 'A2'])
    );
    expect(offers.map((offer) => offer.outcome)).toEqual(['completed', 'ended', 'open', 'open']);
    const { total, byCoin } = summariseOffers(offers);
    expect(total).toEqual({ made: 4, completed: 1, ended: 1, open: 2, openQort: 20n * QORT });
    expect(byCoin.map((coin) => [coin.chain, coin.made, coin.open])).toEqual([
      ['LITECOIN', 3, 1],
      ['DOGECOIN', 1, 1],
    ]);
  });

  it('lists offers with no coin it trades now last', () => {
    const { byCoin } = summariseOffers(
      offerOutcomes([deployed('A1', null), deployed('A2')], new Set(), new Set())
    );
    expect(byCoin.map((coin) => coin.chain)).toEqual(['LITECOIN', null]);
  });
});

describe('over time', () => {
  it('months for up to two years, quarters up to eight, then years', () => {
    expect(periodUnit(day('2025-01-15'), day('2026-12-01'))).toBe('month');
    expect(periodUnit(day('2025-01-15'), day('2027-01-01'))).toBe('quarter');
    expect(periodUnit(day('2019-01-15'), day('2026-12-01'))).toBe('quarter');
    expect(periodUnit(day('2018-12-15'), day('2026-12-01'))).toBe('year');
  });

  it('every period from the first trade to the latest, the empty ones too', () => {
    const { unit, periods } = volumeByPeriod([
      trade({ timestamp: day('2026-01-20'), qort: 10n * QORT }),
      trade({ timestamp: day('2026-01-25'), qort: 5n * QORT, chain: 'DOGECOIN' }),
      trade({ timestamp: day('2026-04-02'), qort: 7n * QORT, side: 'bought' }),
    ]);
    expect(unit).toBe('month');
    expect(periods.map((period) => periodLabel(period.start, unit))).toEqual([
      'Jan 2026',
      'Feb 2026',
      'Mar 2026',
      'Apr 2026',
    ]);
    expect(periods[0]).toMatchObject({
      soldQort: 15n * QORT,
      soldCount: 2,
      sold: { LITECOIN: 10n * QORT, DOGECOIN: 5n * QORT },
    });
    expect(periods[1].soldCount + periods[1].boughtCount).toBe(0);
    expect(periods[3]).toMatchObject({ boughtQort: 7n * QORT, boughtCount: 1 });
    expect(volumeByPeriod([])).toEqual({ unit: 'month', periods: [] });
  });

  it('names quarters and years', () => {
    expect(periodLabel(day('2026-07-01'), 'quarter')).toBe('Q3 2026');
    expect(periodLabel(day('2026-01-01'), 'year')).toBe('2026');
  });
});

describe('prices and amounts', () => {
  it('the coin per QORT to 4 significant digits', () => {
    expect(coinPerQort(35n * QORT, 10_000n * QORT)).toBe('0.0035');
    expect(coinPerQort(2_150n * QORT, 1_000n * QORT)).toBe('2.15');
    expect(coinPerQort(0n, QORT)).toBeNull();
  });

  it('coins to 4 decimals from 1 up, exact below', () => {
    expect(coinWords(962_012_345_678n)).toBe('9,620.1235');
    expect(coinWords(351_234n)).toBe('0.00351234');
  });
});
