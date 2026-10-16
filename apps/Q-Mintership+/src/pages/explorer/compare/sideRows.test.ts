import { describe, expect, it } from 'vitest';
import type { FirstSeen } from '../../../data/explorer/account';
import type { AccountInfo } from '../../../data/types';
import type { MyStatus } from '../../../rules/status';
import { cellText, sameForAll, sideRows, type SideFacts } from './sideRows';

const addr = (c: string) => `Q${c.repeat(33)}`;
const H = addr('h');
const S = addr('s');
const T0 = Date.UTC(2023, 4, 15, 12);

const account = (part: Partial<AccountInfo> = {}): AccountInfo => ({
  address: addr('a'),
  publicKey: 'pk',
  level: 3,
  blocksMinted: 210_000,
  blocksMintedAdjustment: 0,
  blocksMintedPenalty: 0,
  ...part,
});
const funded = (from: string, height: number): FirstSeen => ({
  firstOwn: null,
  funding: { kind: 'payment', from, amount: '5', height, timestamp: T0, signature: 'sig' },
  firstSeen: { height, timestamp: T0 },
});
const status = (kind: MyStatus['kind'], wasMember = false) => ({ kind, wasMember }) as MyStatus;

function facts(part: Partial<SideFacts> = {}): SideFacts {
  return {
    account: account(),
    primary: 'Kit',
    names: { names: ['Kit', 'Kit Two', 'Kit Three'], truncated: false },
    first: funded(H, 1_364_165),
    balance: 12.5,
    status: status('formerLeft'),
    sponsor: null,
    sponsees: 0,
    mintingNow: false,
    lastSent: null,
    groups: [],
    qdn: { name: 'Kit', resources: [], capped: false },
    ...part,
  };
}

const row = (rows: ReturnType<typeof sideRows>, key: string) => {
  const found = rows.find((r) => r.key === key);
  if (!found) throw new Error(key);
  return found;
};

describe('side by side', () => {
  it('one row per fact, in the Overview’s words', () => {
    const rows = sideRows([
      facts(),
      facts({
        account: account({ level: 5, blocksMinted: 640_000, blocksMintedPenalty: -5_000_000 }),
        primary: null,
        names: { names: ['Lou A', 'Lou B'], truncated: false },
        first: funded(S, 1_364_170),
        balance: 6480.54123456,
        status: status('member'),
        sponsor: S,
        sponsees: 48,
        sponseesCapped: true,
        mintingNow: true,
        lastSent: { type: 'PAYMENT', height: 2_740_000, timestamp: T0, signature: 's' },
        groups: [{ groupId: 1, groupName: 'General' }],
        qdn: undefined,
      }),
    ]);
    expect(rows.map((r) => r.label)).toEqual([
      'Names',
      'First seen',
      'First QORT from',
      'Level',
      'Blocks minted',
      'Minting penalty',
      'Balance',
      'MINTER status',
      'Sponsor',
      'Sponsored',
      'Minting now',
      'Last sent a transaction',
      'Groups',
      'QDN publishes',
    ]);
    const text = (key: string) => row(rows, key).cells.map((c) => (c ? cellText(c) : '…'));
    expect(text('names')).toEqual(['Kit and 2 more', 'No primary name (2 names)']);
    expect(text('firstSeen')[0]).toMatch(/^15 May 2023 · block 1,364,165$/);
    expect(text('firstQort')).toEqual(['Qhhhhh…hhhh', 'Qsssss…ssss']);
    expect(text('penalty')).toEqual(['None', '−5,000,000 blocks']);
    expect(text('balance')).toEqual(['12.5 QORT', '6,480.54 QORT']);
    expect(text('status')).toEqual(['Former member', 'MINTER member']);
    // The second's links were capped: its sponsor is the first of those read.
    expect(text('sponsor')).toEqual([
      'None found',
      'Qsssss…ssss (the first in its newest 500 read)',
    ]);
    expect(text('sponsored')).toEqual(['None', '48 accounts+']);
    expect(text('mintingNow')).toEqual(['No', 'Yes']);
    expect(text('lastSent')).toEqual(['Never', '15 May 2023 · block 2,740,000']);
    expect(text('groups')).toEqual(['0', '1']);
    // The second has no primary name: no QDN count to give.
    expect(text('qdn')).toEqual(['0 as Kit', 'No primary name']);
  });

  it('a value the same for all reads once; one still out keeps the row open', () => {
    const rows = sideRows([facts(), facts({ primary: 'Lou' })]);
    expect(sameForAll(row(rows, 'level').cells)).toMatchObject({ text: 'Level 3' });
    expect(sameForAll(row(rows, 'firstQort').cells)).toMatchObject({ account: H });
    expect(sameForAll(row(rows, 'names').cells)).toBeNull();
    const reading = sideRows([facts(), facts({ balance: undefined, sponsor: undefined })]);
    expect(row(reading, 'balance').cells[1]).toBeUndefined();
    expect(sameForAll(row(reading, 'balance').cells)).toBeNull();
    expect(sameForAll(row(reading, 'sponsor').cells)).toBeNull();
    // An account with no key has never sent anything: no read needed.
    const keyless = sideRows([
      facts({ account: account({ publicKey: undefined }), lastSent: undefined }),
    ]);
    expect(row(keyless, 'lastSent').cells[0]).toMatchObject({ text: 'Never' });
    expect(sameForAll(row(keyless, 'lastSent').cells)).toBeNull();
    // Names in a cell stay names (shown isolated), with their names known.
    expect(cellText({ key: 'x', account: H }, () => 'Hal')).toBe('Hal');
  });

  it('a read that failed says so in its cell, and never reads “Same for all”', () => {
    const broken = (address: string) =>
      facts({
        account: account({ address }),
        balance: undefined,
        names: undefined,
        lastSent: undefined,
        groups: undefined,
        first: undefined,
        status: undefined,
        sponsor: undefined,
        sponsees: undefined,
        mintingNow: undefined,
        qdn: undefined,
        failed: {
          balance: true,
          names: true,
          lastSent: true,
          groups: true,
          first: true,
          status: true,
          links: true,
          online: true,
          qdn: true,
        },
      });
    const rows = sideRows([broken(addr('a')), broken(addr('b'))]);
    for (const key of [
      'names',
      'firstSeen',
      'firstQort',
      'balance',
      'status',
      'sponsor',
      'sponsored',
      'mintingNow',
      'lastSent',
      'groups',
      'qdn',
    ]) {
      const cells = row(rows, key).cells;
      expect(
        cells.map((c) => c?.text),
        key
      ).toEqual(['Couldn’t read', 'Couldn’t read']);
      expect(cells.every((c) => c?.failed)).toBe(true);
      expect(sameForAll(cells), key).toBeNull();
    }
    // Still reading (nothing failed): undefined, as before.
    expect(row(sideRows([facts({ balance: undefined })]), 'balance').cells[0]).toBeUndefined();
  });

  it('a sponsor from capped links says only the newest 500 were read', () => {
    const rows = sideRows([
      facts({ sponsor: S, sponseesCapped: true }),
      facts({ sponsor: null, sponseesCapped: true }),
    ]);
    const sponsor = row(rows, 'sponsor').cells.map((c) => (c ? cellText(c) : '…'));
    expect(sponsor).toEqual([
      'Qsssss…ssss (the first in its newest 500 read)',
      'None found in its newest 500 reward shares, level moves and name sales',
    ]);
    // Never the same for all with one that was read in full.
    const mixed = sideRows([facts({ sponsor: S, sponseesCapped: true }), facts({ sponsor: S })]);
    expect(sameForAll(row(mixed, 'sponsor').cells)).toBeNull();
  });

  it('a primary name that couldn’t be read is never “No primary name”', () => {
    const rows = sideRows([
      facts({ primary: undefined, qdn: undefined, failed: { primary: true } }),
      facts({ primary: undefined, qdn: undefined, names: { names: [], truncated: false } }),
    ]);
    const names = row(rows, 'names').cells;
    expect(names[0]).toMatchObject({
      text: 'Couldn’t read the primary name (3 names)',
      failed: true,
    });
    // Owning no name says there is no primary name to read.
    expect(names[1]).toMatchObject({ text: 'No registered name' });
    const qdn = row(rows, 'qdn').cells;
    expect(qdn[0]).toMatchObject({ text: 'Couldn’t read', failed: true });
    // Still reading the second: no value yet.
    expect(qdn[1]).toBeUndefined();
    expect(rows.flatMap((r) => r.cells).map((c) => c?.text)).not.toContain('No primary name');
  });
});
