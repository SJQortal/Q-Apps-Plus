import { describe, expect, it } from 'vitest';
import type { SponseeRow } from '../../../data/explorer/sets';
import { sortSponsees } from './sortSponsees';

const row = (address: string, height: number, more: Partial<SponseeRow> = {}): SponseeRow => ({
  address,
  percent: '0',
  start: { height, timestamp: height * 1000, signature: `s-${address}` },
  removal: null,
  blocks: null,
  active: true,
  shares: 1,
  txs: [],
  member: null,
  mintingNow: false,
  banned: false,
  ...more,
});

const A = row('A', 10, { active: false });
const B = row('B', 30, { mintingNow: true, shares: 3 });
const C = row('C', 20, { member: { member: 'C', isAdmin: false, joined: 1 } as never });

describe('sorting the sponsored accounts', () => {
  it('orders them by when, or puts those running, in MINTER or minting first', () => {
    const order = (sort: Parameters<typeof sortSponsees>[1]) =>
      sortSponsees([A, B, C], sort).map((r) => r.address);
    expect(order('first')).toEqual(['A', 'C', 'B']);
    expect(order('latest')).toEqual(['B', 'C', 'A']);
    expect(order('active')).toEqual(['C', 'B', 'A']);
    expect(order('member')).toEqual(['C', 'A', 'B']);
    expect(order('minting')).toEqual(['B', 'A', 'C']);
    expect(order('shares')).toEqual(['B', 'A', 'C']);
  });
});
