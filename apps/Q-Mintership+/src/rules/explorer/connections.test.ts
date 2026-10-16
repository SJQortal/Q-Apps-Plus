import { describe, expect, it } from 'vitest';
import type { TxRow } from '../../data/types';
import type { Funding } from '../../data/explorer/account';
import { parseSponsorshipReport } from '../../data/explorer/sponsorship';
import {
  bandWords,
  emptyLinkChecks,
  fundingParts,
  groupFirstPayers,
  levelMoveParts,
  linksOf,
  mintingWithNow,
  monthRange,
  nameDealParts,
  nothingFoundLine,
  siblingsParts,
  sponseesOf,
  sponseesSummary,
  sponsorParts,
  sponsorReportLines,
  whenWords,
} from './connections';
import { partsToPlain, type TxPart } from './txWords';

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const addr = (c: string) => `Q${c.repeat(33)}`;
const ME = addr('m');
const A = addr('a');
const B = addr('b');
const C = addr('c');
const D = addr('d');
const AT = `A${'t'.repeat(33)}`;
let n = 0;
const sig = () => {
  n += 1;
  return `${B58[n % 58]}${B58[Math.floor(n / 58) % 58]}${'s'.repeat(86)}`;
};
/** Mid-month, so the month words don't depend on the time zone. */
const T0 = Date.UTC(2023, 4, 15, 12);
const DAY = 86_400_000;

function tx(type: string, height: number, extra: Partial<TxRow> = {}): TxRow {
  return {
    type,
    timestamp: T0 + (height - 1_000_000) * 60_000,
    signature: sig(),
    txGroupId: 0,
    blockHeight: height,
    approvalStatus: 'NOT_REQUIRED',
    ...extra,
  };
}
const share = (from: string, to: string, height: number, sharePercent = '0.00') =>
  tx('REWARD_SHARE', height, { creatorAddress: from, recipient: to, sharePercent });

/** Accounts as their letter, for readable sentences. */
function plain(parts: TxPart[]): string {
  return partsToPlain(parts).replace(/Q(\w)\1{4}…\1{4}/g, (_, c: string) => c.toUpperCase());
}

describe('linksOf: level moves', () => {
  it('a move it sent names the recipient read from the raw bytes', () => {
    const sent = tx('TRANSFER_PRIVS', 1_061_832, { creatorAddress: ME });
    const links = linksOf([sent], ME, { [sent.signature]: C });
    expect(links.levelMoves).toEqual([
      {
        direction: 'to',
        other: C,
        ref: { height: 1_061_832, timestamp: sent.timestamp, signature: sent.signature },
        tx: sent,
      },
    ]);
    expect(plain(levelMoveParts(links.levelMoves[0]))).toBe('Moved its minting level to C');
  });

  it('a move it sent whose bytes couldn’t be read still shows, without a recipient', () => {
    const sent = tx('TRANSFER_PRIVS', 1_061_832, { creatorAddress: ME });
    const links = linksOf([sent], ME, {});
    expect(links.levelMoves[0].other).toBeNull();
    expect(plain(levelMoveParts(links.levelMoves[0]))).toBe(
      'Moved its minting level to another account (its recipient couldn’t be read)'
    );
  });

  it('a move it received names its creator, with that account’s level now', () => {
    const got = tx('TRANSFER_PRIVS', 1_061_832, { creatorAddress: B });
    const [move] = linksOf([got], ME).levelMoves;
    expect(move).toMatchObject({ direction: 'from', other: B });
    expect(plain(levelMoveParts(move))).toBe('Got its minting level from B');
    expect(plain(levelMoveParts(move, 0))).toBe('Got its minting level from B. B is now level 0.');
  });
});

describe('linksOf: sponsors', () => {
  it('the sponsor is the creator of the earliest share to it, with how long it ran', () => {
    const rows = [
      share(A, ME, 1_371_641),
      share(A, ME, 1_378_875, '-1.00'),
      share(B, ME, 1_400_000, '10.00'),
      share(ME, ME, 1_380_007),
    ];
    const links = linksOf([...rows].reverse(), ME);
    expect(links.sponsors.map((s) => s.sponsor)).toEqual([A, B]);
    expect(links.sponsors[0]).toMatchObject({ percent: '0', blocks: 7_234 });
    expect(links.sponsors[0].txs.map((t) => t.blockHeight)).toEqual([1_378_875, 1_371_641]);
    expect(plain(sponsorParts(links.sponsors[0]))).toBe('Sponsored by A at 0 % for 7,234 blocks');
    expect(plain(sponsorParts(links.sponsors[1]))).toBe('Sponsored by B at 10 %, not removed');
  });

  it('an old removal (-1000000) counts; a removal before any share doesn’t start one', () => {
    const rows = [
      share(A, ME, 900, '-1.00'),
      share(A, ME, 1_000),
      share(A, ME, 1_500, '-1000000.00'),
    ];
    const [sponsorship] = linksOf(rows, ME).sponsors;
    expect(sponsorship.start.height).toBe(1_000);
    expect(sponsorship.blocks).toBe(500);
  });

  it('a self-share is neither a sponsor nor a sponsee', () => {
    const links = linksOf([share(ME, ME, 1_000)], ME);
    expect(links.sponsors).toEqual([]);
    expect(links.sponsees).toEqual([]);
    expect(links.activeShares).toEqual([]);
  });
});

describe('sponsees', () => {
  const rows = [
    share(ME, A, 1_000),
    share(ME, A, 8_000, '-1.00'),
    share(ME, B, 2_000),
    share(ME, C, 3_000),
    share(ME, C, 4_000, '-1.00'),
    share(ME, C, 5_000),
    share(ME, ME, 500),
    share(D, ME, 600),
  ];

  it('lists each account it made a share to once, in the order of the first share', () => {
    const sponsees = sponseesOf(rows, ME);
    expect(sponsees.map((s) => s.address)).toEqual([A, B, C]);
    expect(sponsees[0]).toMatchObject({ blocks: 7_000, active: false, shares: 1 });
    expect(sponsees[1]).toMatchObject({ removal: null, blocks: null, active: true });
    // Sponsored again after a removal: active again, two shares.
    expect(sponsees[2]).toMatchObject({ blocks: 1_000, active: true, shares: 2 });
    expect(sponsees[2].txs).toHaveLength(3);
  });

  it('says how many and over which months', () => {
    const sponsees = [
      { ...sponseesOf(rows, ME)[0], start: { height: 1, timestamp: T0, signature: 'x' } },
      {
        ...sponseesOf(rows, ME)[1],
        start: { height: 2, timestamp: Date.UTC(2025, 2, 14), signature: 'y' },
      },
    ];
    expect(sponseesSummary(sponsees)).toBe('Sponsored 2 accounts (May 2023 – Mar 2025)');
    expect(sponseesSummary([])).toBe('Sponsored no accounts');
  });

  it('“Also sponsored by A (47 others)”', () => {
    expect(plain(siblingsParts(A, 47))).toBe('Also sponsored by A (47 others)');
    expect(plain(siblingsParts(A, 1))).toBe('Also sponsored by A (1 other)');
  });
});

describe('active shares and minting now', () => {
  it('keeps the pairs whose latest row isn’t a removal, either way', () => {
    const rows = [
      share(ME, A, 1_000),
      share(ME, A, 2_000, '-1.00'),
      share(ME, B, 3_000),
      share(C, ME, 4_000, '5.00'),
      share(ME, ME, 500),
    ];
    const links = linksOf(rows, ME);
    expect(links.activeShares.map((s) => [s.other, s.role, s.percent])).toEqual([
      [B, 'minter', '0'],
      [C, 'recipient', '5'],
    ]);
    const online = [
      { minterAddress: C, recipientAddress: ME },
      { minterAddress: ME, recipientAddress: ME },
      { minterAddress: A, recipientAddress: ME },
    ];
    const now = mintingWithNow(links, ME, online);
    expect(now.map((s) => s.other)).toEqual([C]);
  });
});

describe('names bought and sold', () => {
  it('reads the buyer and the seller', () => {
    const bought = tx('BUY_NAME', 2_351_000, {
      creatorAddress: ME,
      seller: B,
      name: 'Spare Room',
      amount: '5.00000000',
    });
    const sold = tx('BUY_NAME', 2_352_000, {
      creatorAddress: C,
      seller: ME,
      name: 'foo',
      amount: '1.00000000',
    });
    const other = tx('BUY_NAME', 2_353_000, { creatorAddress: C, seller: D, name: 'x' });
    const deals = linksOf([bought, sold, other], ME).nameDeals;
    expect(deals.map((d) => [d.kind, d.other, d.name])).toEqual([
      ['bought', B, 'Spare Room'],
      ['sold', C, 'foo'],
    ]);
    expect(plain(nameDealParts(deals[0]))).toBe('Bought the name “Spare Room” from B for 5 QORT');
    expect(plain(nameDealParts(deals[1]))).toBe('Sold the name “foo” to C for 1 QORT');
  });

  it('ignores the genesis-era flags and levels', () => {
    const rows = [
      tx('ACCOUNT_LEVEL', 1, { target: ME, level: 5 }),
      tx('ACCOUNT_FLAGS', 1, { target: ME }),
    ];
    const links = linksOf(rows, ME);
    expect(links).toEqual({
      levelMoves: [],
      sponsors: [],
      sponsees: [],
      activeShares: [],
      nameDeals: [],
    });
    expect(nothingFoundLine(emptyLinkChecks(links, []))).toBe(
      'Also checked, nothing found: level moves, a sponsor, accounts it sponsored, minting with another account now, name sales.'
    );
    // Before the online list is read, "minting with" isn't claimed as checked.
    expect(nothingFoundLine(emptyLinkChecks(links, null))).not.toMatch(/minting with/);
    expect(nothingFoundLine([])).toBeNull();
  });

  it('leaves out unconfirmed rows', () => {
    const waiting = { ...share(A, ME, 1), blockHeight: undefined };
    expect(linksOf([waiting], ME).sponsors).toEqual([]);
  });
});

describe('dates', () => {
  it('words a span of months', () => {
    const mar = Date.UTC(2025, 2, 14);
    const may = Date.UTC(2025, 4, 14);
    expect(monthRange(mar, mar + DAY)).toBe('Mar 2025');
    expect(monthRange(may, mar)).toBe('Mar–May 2025');
    expect(monthRange(T0, mar)).toBe('May 2023 – Mar 2025');
    expect(whenWords(mar, mar)).toBe('14 Mar 2025');
  });
});

describe('where the first QORT came from', () => {
  const base = { height: 1_364_165, timestamp: T0, signature: 'x' };
  it('words each kind of first transaction', () => {
    const payment: Funding = { ...base, kind: 'payment', from: B, amount: '5.43210000' };
    expect(plain(fundingParts(payment, 500))).toBe(
      'First QORT payment received: 5.4321 QORT from B. B has sent 500+ payments.'
    );
    expect(plain(fundingParts(payment, 0))).toBe('First QORT payment received: 5.4321 QORT from B');
    expect(
      plain(fundingParts({ ...base, kind: 'rewardShare', from: A, sharePercent: '0.00' }))
    ).toBe('Its first incoming transaction: a 0 % reward share from A');
    expect(plain(fundingParts({ ...base, kind: 'transferPrivs', from: C }))).toBe(
      'Got its minting level from C'
    );
    expect(plain(fundingParts({ ...base, kind: 'at', from: AT, amount: '1' }))).toBe(
      'First QORT came from an AT (automated contract)'
    );
    expect(
      plain(fundingParts({ ...base, kind: 'genesis', from: null, amount: '1', assetId: 0 }))
    ).toBe('Received 1 QORT in the genesis block');
    expect(
      plain(fundingParts({ ...base, kind: 'transferAsset', from: D, amount: '1' }, 1000))
    ).toBe('Its first incoming transaction: an asset transfer from D. D has sent 1,000+ payments.');
  });

  it('says QORT for the genesis block only when it gave out QORT', () => {
    const genesis: Funding = { ...base, kind: 'genesis', from: null, amount: '100000', assetId: 1 };
    expect(plain(fundingParts(genesis))).toBe(
      'Its first incoming transaction: 100,000 asset #1 in the genesis block'
    );
    expect(plain(fundingParts({ ...genesis, assetName: 'Legacy-QORA' }))).toBe(
      'Its first incoming transaction: 100,000 Legacy-QORA in the genesis block'
    );
  });

  it('band words: none under 100', () => {
    expect(bandWords(0)).toBeNull();
    expect(bandWords(undefined)).toBeNull();
    expect(bandWords(100)).toBe('has sent 100+ payments');
    expect(bandWords(1000)).toBe('has sent 1,000+ payments');
  });

  it('groups a set’s first payers, most accounts first', () => {
    const f = (from: string, kind: Funding['kind'] = 'payment'): Funding => ({
      ...base,
      kind,
      from,
      amount: '1',
    });
    const funding = new Map<string, Funding | null>([
      [addr('1'), f(B)],
      [addr('2'), f(A)],
      [addr('3'), f(B, 'multiPayment')],
      [addr('4'), f(C, 'rewardShare')],
      [addr('5'), null],
    ]);
    expect(groupFirstPayers(funding)).toEqual({
      payers: [
        { from: B, accounts: [addr('1'), addr('3')] },
        { from: A, accounts: [addr('2')] },
      ],
      other: 1,
      none: 1,
    });
  });
});

describe('Core’s own report', () => {
  it('says what each number really counts', () => {
    const report = parseSponsorshipReport(
      {
        address: A,
        level: 6,
        blocksMinted: 900_000,
        transfer: true,
        names: ['Sam Sprout', 'Tia Twig', 'Tia Two'],
        sponseeCount: 2,
        nonRegisteredCount: -1,
        avgBalance: 2,
        arbitraryCount: 1,
        transferAssetCount: 0,
        transferPrivsCount: 2,
        sellCount: 3,
        sellAmount: 1200,
        buyCount: 0,
        buyAmount: 0,
      },
      A
    );
    const lines = sponsorReportLines(report).join('\n');
    expect(lines).toContain(
      'Accounts it ever made a reward share to: 2 (removed shares included).'
    );
    expect(lines).toContain('Names of its sponsees: 3. Core counts names, not accounts');
    expect(lines).toContain('“not registered” figure is -1');
    expect(lines).toContain('1 QDN publish, 0 asset transfers, 2 level moves');
    expect(lines).toContain('sold 1,200 QORT in 3 trades');
    expect(lines).toContain('sent or received a minting level');
  });

  it('reads a report with missing fields as zeros', () => {
    expect(parseSponsorshipReport(null, A)).toMatchObject({
      address: A,
      sponseeCount: 0,
      names: [],
      transfer: false,
    });
  });
});
