import { describe, expect, it } from 'vitest';
import type { TxRow } from '../../data/types';
import type { FirstSeen, GroupOf } from '../../data/explorer/account';
import type { AccountLinks } from '../../data/explorer/links';
import type { MadeBy } from '../../data/explorer/madeBy';
import type { PaymentPage } from '../../data/explorer/money';
import { MINTER_GROUP_ID } from '../../data/constants';
import {
  bandAddressesOf,
  checkedNoneLine,
  compareText,
  counterpartyCounts,
  counterpartyParts,
  droppedNote,
  gapWords,
  groupsLead,
  groupWords,
  leftOutLine,
  listWords,
  pairFindings,
  pairsOf,
  pairSummary,
  parseComparePath,
  sameFirstPayerParts,
  sameFirstPayers,
  sameSponsorParts,
  sameSponsors,
  sharedCounterparties,
  sharedGroups,
  timelineEvents,
  timelineLine,
  timingRows,
  timingText,
  whereWords,
  type CompareSide,
  type Letter,
} from './compare';
import { partsToPlain, type TxPart } from './txWords';

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const addr = (c: string) => `Q${c.repeat(33)}`;
const A = addr('a');
const B = addr('b');
const C = addr('c');
const D = addr('d');
const H = addr('h');
const K = addr('k');
const S = addr('s');
const AT = `A${'t'.repeat(33)}`;
let n = 0;
const sig = () => {
  n += 1;
  return `${B58[n % 58]}${B58[Math.floor(n / 58) % 58]}${'s'.repeat(86)}`;
};
/** Mid-month, so the month words don't depend on the time zone. */
const T0 = Date.UTC(2023, 4, 15, 12);
const DAY = 86_400_000;
const VERDICTS =
  /\b(alts?|suspicious|same person|fraud|strong(est)?|weak|consolidation|linked accounts|likel(y|ihood)|score)\b/i;

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
const pay = (from: string, to: string, height: number, amount = '1.00000000') =>
  tx('PAYMENT', height, { creatorAddress: from, recipient: to, amount });
const share = (from: string, to: string, height: number, sharePercent = '0.00') =>
  tx('REWARD_SHARE', height, { creatorAddress: from, recipient: to, sharePercent });

/** Accounts as their letter, for readable sentences. */
function plain(parts: TxPart[]): string {
  return partsToPlain(parts).replace(/Q(\w)\1{4}…\1{4}/g, (_, c: string) => c.toUpperCase());
}

const links = (rows: TxRow[], privs: Record<string, string | null> = {}): AccountLinks => ({
  rows: [...rows].sort((a, b) => (b.blockHeight ?? 0) - (a.blockHeight ?? 0)),
  truncated: false,
  privs,
});
const page = (rows: TxRow[], done = true): PaymentPage => ({
  rows,
  nextOffset: rows.length,
  done,
});
const noAssets = { rows: [], truncated: false };
const made = (part: Partial<MadeBy> = {}): MadeBy => ({
  names: [],
  namesTruncated: false,
  namesWithRecords: [],
  nominations: [],
  supports: [],
  votes: [],
  comments: [],
  considering: [],
  adminRecords: 0,
  truncated: [],
  unreadable: 0,
  ...part,
});
const side = (address: string, letter: Letter, part: Partial<CompareSide> = {}): CompareSide => ({
  address,
  letter,
  ...part,
});

describe('the link', () => {
  it('keeps up to 4 valid addresses, each once, and says what it left out', () => {
    const parsed = parseComparePath(
      [A, 'hello', B, A, AT, C, D, addr('e'), encodeURIComponent(' ')].join('/')
    );
    expect(parsed.addresses).toEqual([A, B, C, D]);
    expect(parsed.dropped.map((d) => d.reason)).toEqual(['invalid', 'duplicate', 'at', 'extra']);
    expect(droppedNote(parsed.dropped)).toBe(
      "Left out of this comparison: “hello” isn't a valid Qortal address; Qaaaaa…aaaa was in the link twice; Attttt…tttt is an AT address (an automated contract), not a personal account; Qeeeee…eeee was a 5th account (Compare holds 4)."
    );
    expect(droppedNote([])).toBeNull();
    expect(parseComparePath(undefined)).toEqual({ addresses: [], dropped: [] });
    // Long junk is shortened.
    expect(droppedNote(parseComparePath('x'.repeat(60)).dropped)).toBe(
      `Left out of this comparison: “${'x'.repeat(20)}…” isn't a valid Qortal address.`
    );
  });

  it('lists every pair in letter order', () => {
    expect(pairsOf(2).map((p) => p.label)).toEqual(['A–B']);
    expect(pairsOf(4).map((p) => p.label)).toEqual(['A–B', 'A–C', 'A–D', 'B–C', 'B–D', 'C–D']);
    expect(pairsOf(3)[1]).toMatchObject({ i: 0, j: 2, id: 'a-c' });
    expect(listWords(['A', 'B', 'C'])).toBe('A, B and C');
  });
});

describe('recorded between two accounts', () => {
  it('adds up payments each way, with asset transfers and multi-payments, once each', () => {
    const ab = [pay(A, B, 1_000_100, '10'), pay(A, B, 1_000_300, '20.5')];
    const ba = [pay(B, A, 1_000_200, '2')];
    const asset = tx('TRANSFER_ASSET', 1_000_400, {
      creatorAddress: A,
      recipient: B,
      amount: '3',
      assetId: 0,
    });
    const multi = tx('MULTI_PAYMENT', 1_000_500, {
      creatorAddress: B,
      payments: [
        { recipient: A, amount: '1.25', assetId: 0 },
        { recipient: C, amount: '9', assetId: 0 },
      ],
    });
    const result = pairFindings({
      x: side(A, 'A', { assets: { rows: [asset], truncated: false } }),
      // The asset transfer is in both accounts' pages: counted once.
      y: side(B, 'B', { assets: { rows: [asset, multi], truncated: false } }),
      xy: { rows: [...ab].reverse(), capped: false },
      yx: { rows: ba, capped: false },
    });
    const payments = result.findings.filter((f) => f.kind === 'payment');
    expect(payments.map((f) => plain(f.parts))).toEqual([
      'A paid B 33.5 QORT in 3 payments (May 2023)',
      'B paid A 3.25 QORT in 2 payments (May 2023)',
    ]);
    expect(payments[0]).toMatchObject({
      actor: A,
      other: B,
      height: 1_000_400,
      firstHeight: 1_000_100,
      count: 3,
      evidenceWords: '3 payments',
    });
    expect(payments[0].evidence.map((t) => t.blockHeight)).toEqual([
      1_000_400, 1_000_300, 1_000_100,
    ]);
    // Links, records and trades weren't read yet: pending, not "none found".
    expect(result.empty).toEqual([]);
    expect(result.pending).toEqual([
      'rewardShares',
      'levelMoves',
      'nameSales',
      'records',
      'trades',
    ]);
  });

  it('says when a pair read was capped', () => {
    const rows = Array.from({ length: 100 }, (_, i) => pay(A, B, 1_000_000 + i));
    const [finding] = pairFindings({
      x: side(A, 'A'),
      y: side(B, 'B'),
      xy: { rows, capped: true },
      yx: { rows: [], capped: false },
    }).findings;
    expect(plain(finding.parts)).toBe(
      'A paid B 100 QORT in its newest 100 payments to them (May 2023; older ones not read)'
    );
  });

  it('finds reward shares, level moves and name sales from either account’s links, once each', () => {
    const shareAB = share(A, B, 1_000_100);
    const removal = share(A, B, 1_007_334, '-1.00');
    const level = tx('TRANSFER_PRIVS', 1_010_000, { creatorAddress: B });
    const deal = tx('BUY_NAME', 1_020_000, {
      creatorAddress: B,
      seller: A,
      name: 'Spare Room',
      amount: '5.00000000',
    });
    const other = share(A, C, 1_000_050);
    const result = pairFindings({
      x: side(A, 'A', { links: links([shareAB, removal, other, deal]) }),
      y: side(B, 'B', { links: links([shareAB, removal, level, deal], { [level.signature]: A }) }),
      online: [],
    });
    expect(result.findings.map((f) => [f.kind, plain(f.parts)])).toEqual([
      ['rewardShare', 'A made a reward share to B at 0 %, removed after 7,234 blocks'],
      ['levelMove', 'B moved its minting level to A'],
      ['nameDeal', 'B bought the name “Spare Room” from A for 5 QORT'],
    ]);
    expect(result.findings[0].evidence).toHaveLength(2);
    expect(result.findings[0].evidenceWords).toBe('2 transactions');
    expect(result.empty).toEqual([]);
    expect(result.pending).toEqual(['payments', 'records', 'trades']);
  });

  it('says a reward share that mints now', () => {
    const result = pairFindings({
      x: side(A, 'A', { links: links([share(A, B, 1_000_100)]) }),
      y: side(B, 'B', { links: links([]) }),
      online: [{ minterAddress: A, recipientAddress: B }],
    });
    expect(plain(result.findings[0].parts)).toBe(
      'A made a reward share to B at 0 %, not removed; they are minting with it now'
    );
  });

  it('finds Q-Mintership records either way, under the names they were published under', () => {
    const result = pairFindings({
      x: side(A, 'A', {
        made: made({
          nominations: [
            { name: 'Ann', identifier: 'n1', at: T0 + 2 * DAY, nominee: B },
            { name: 'Ann', identifier: 'n0', at: T0, nominee: B },
            { name: 'Ann', identifier: 'n2', at: T0, nominee: C },
          ],
          votes: [{ name: 'Ann 2', identifier: 'v', at: T0 + DAY, nominee: B, vote: 'no' }],
        }),
      }),
      y: side(B, 'B', {
        made: made({ supports: [{ name: 'Bo', identifier: 's', at: T0, nominee: A }] }),
      }),
    });
    expect(result.findings.map((f) => plain(f.parts))).toEqual([
      'A nominated B (as “Ann”, 2 records)',
      'A voted No on B’s nomination (as “Ann 2”)',
      'B supported A’s nomination (as “Bo”)',
    ]);
    expect(result.findings[0]).toMatchObject({
      timestamp: T0 + 2 * DAY,
      firstTimestamp: T0,
      count: 2,
      evidenceWords: '',
    });
    expect(result.pending).toEqual([
      'payments',
      'rewardShares',
      'levelMoves',
      'nameSales',
      'trades',
    ]);
  });

  it('finds trades only when the buyer received at the other account', () => {
    const trade = (buyer: string, amount: string, at: number) => ({
      timestamp: at,
      qortAmount: amount,
      foreignAmount: '0.1',
      atAddress: AT,
      seller: A,
      buyer,
    });
    const result = pairFindings({
      x: side(A, 'A', {
        trades: {
          rows: [trade(B, '12.5', T0 + DAY), trade(C, '99', T0), trade(B, '0.5', T0)],
          capped: false,
        },
      }),
      // B has no public key: it never sold anything.
      y: side(B, 'B', { trades: null }),
    });
    expect(result.findings).toHaveLength(1);
    expect(plain(result.findings[0].parts)).toBe(
      'A sold 13 QORT to B on the trade portal in 2 trades (May 2023)'
    );
    expect(result.findings[0].trades).toHaveLength(2);
    expect(result.findings[0].evidenceWords).toBe('2 trades');
    expect(result.empty).toEqual([]);
  });

  it('lists what was checked and found nothing', () => {
    const result = pairFindings({
      x: side(A, 'A', { links: links([]), assets: noAssets, made: made(), trades: null }),
      y: side(B, 'B', { links: links([]), assets: noAssets, made: made(), trades: null }),
      xy: { rows: [], capped: false },
      yx: { rows: [], capped: false },
    });
    expect(result.findings).toEqual([]);
    expect(result.pending).toEqual([]);
    expect(checkedNoneLine(result.empty)).toBe(
      'Checked, none found: payments both ways, reward shares, level moves, name sales, Q-Mintership records, trade portal sales.'
    );
    expect(checkedNoneLine([])).toBeNull();
  });

  it('sums up a pair for the grid', () => {
    expect(pairSummary(2, 1, 'done')).toBe('2 recorded, 1 in common');
    expect(pairSummary(0, 0, 'done')).toBe('none found');
    expect(pairSummary(0, 0, 'checking')).toBe('checking…');
    expect(pairSummary(1, 0, 'checking')).toBe('1 recorded so far');
  });

  it('a pair whose reads failed never reads as checking or none found', () => {
    expect(pairSummary(0, 0, 'failed')).toBe('couldn’t read everything');
    expect(pairSummary(1, 2, 'failed')).toBe('1 recorded, 2 in common; some reads failed');
  });
});

describe('in common', () => {
  const funded = (from: string, height: number): FirstSeen => ({
    firstOwn: null,
    funding: {
      kind: 'payment',
      from,
      amount: '5',
      height,
      timestamp: T0 + height,
      signature: sig(),
    },
    firstSeen: { height, timestamp: T0 + height },
  });

  it('the same sponsor, with how many accounts it sponsored', () => {
    const sponsorRows = [share(S, A, 1_000_100), share(S, B, 1_000_200), share(S, C, 1_000_300)];
    const sides = [
      side(A, 'A', { links: links([sponsorRows[0]]) }),
      side(B, 'B', { links: links([sponsorRows[1]]) }),
      side(D, 'C', { links: links([]) }),
    ];
    const [same] = sameSponsors(sides, { [S]: links(sponsorRows) });
    expect(same).toMatchObject({ sponsor: S, letters: ['A', 'B'], sponsees: 3, capped: false });
    expect(plain(sameSponsorParts(same, 3))).toBe(
      'A and B sponsored by S, who sponsored 3 accounts'
    );
    expect(plain(sameSponsorParts({ ...same, sponsees: null }, 2))).toBe('Both sponsored by S');
    expect(sameSponsors(sides.slice(0, 1))).toEqual([]);
  });

  it('the same first payer, with how busy it is', () => {
    const sides = [
      side(A, 'A', { first: funded(H, 1_364_165) }),
      side(B, 'B', { first: funded(H, 1_364_170) }),
      side(C, 'C', { first: funded(K, 1_364_000) }),
    ];
    const [same] = sameFirstPayers(sides);
    expect(same.from).toBe(H);
    expect(plain(sameFirstPayerParts(same, 3, 500))).toBe(
      'A and B got their first QORT payment from H (blocks 1,364,165 and 1,364,170). H has sent 500+ payments.'
    );
    expect(plain(sameFirstPayerParts(same, 2))).toBe(
      'Both got their first QORT payment from H (blocks 1,364,165 and 1,364,170)'
    );
  });

  it('shared counterparties with their direction, compared accounts, ATs and busy payers left out', () => {
    const L = addr('L');
    const M = addr('M');
    const BUSY = addr('z');
    const a = side(A, 'A', {
      sent: page([
        pay(A, K, 1),
        pay(A, K, 2),
        pay(A, K, 3),
        pay(A, L, 4),
        pay(A, B, 5),
        pay(A, AT, 6),
      ]),
      recv: page([pay(M, A, 7), pay(BUSY, A, 8)]),
      assets: noAssets,
    });
    const b = side(B, 'B', {
      sent: page([pay(B, L, 9), pay(B, AT, 10)]),
      recv: page([pay(K, B, 11), pay(K, B, 12), pay(M, B, 13), pay(BUSY, B, 14), pay(A, B, 5)]),
      assets: noAssets,
    });
    const shared = sharedCounterparties([a, b], { [BUSY]: 1000, [K]: 100 });
    expect(shared.rows.map((r) => [plain(counterpartyParts(r, 2)), counterpartyCounts(r)])).toEqual(
      [
        ['A → K → B', 'A sent 3 payments · B received 2 payments'],
        ['Both paid L', 'A sent 1 payment · B sent 1 payment'],
        ['M paid both', 'A received 1 payment · B received 1 payment'],
      ]
    );
    expect(shared.rows[0].rank).toBe(2);
    expect(shared).toMatchObject({ atLeftOut: 1, busyLeftOut: 1 });
    expect(leftOutLine(shared)).toBe(
      'Left out: 1 AT address (automated contracts), 1 account that has sent 1,000+ payments.'
    );
    expect(leftOutLine({ atLeftOut: 0, busyLeftOut: 0 })).toBeNull();
    // One account's pages alone share nothing.
    expect(sharedCounterparties([a, side(B, 'B')]).rows).toEqual([]);
  });

  it('reads the band of every shared payer, so a busy one is left out wherever it ranks', () => {
    const others = Array.from(
      { length: 70 },
      (_, k) => `Q${B58[k % 58]}${B58[Math.floor(k / 58)]}${'z'.repeat(31)}`
    );
    const paidAll = (from: string, height: number) =>
      page(others.map((other, k) => pay(from, other, height + k)));
    const sides = [
      side(A, 'A', { sent: paidAll(A, 1_000_000), recv: page([]), assets: noAssets }),
      side(B, 'B', { sent: paidAll(B, 1_100_000), recv: page([]), assets: noAssets }),
    ];
    const first = [
      { from: H, accounts: [] },
      { from: others[3], accounts: [] },
    ];
    const all = sharedCounterparties(sides);
    expect(all.rows).toHaveLength(70);
    const toRead = bandAddressesOf(first, all);
    // Each once: the first payers, then every shared counterparty, not only the first 40.
    expect(toRead).toHaveLength(71);
    expect(toRead[0]).toBe(H);
    expect(new Set(toRead)).toEqual(new Set([H, ...others]));
    // The 56th listed is busy: left out and counted once its band is in.
    const busy = all.rows[55].address;
    const shared = sharedCounterparties(sides, { [busy]: 1000 });
    expect(shared.rows).toHaveLength(69);
    expect(shared.busyLeftOut).toBe(1);
  });

  it('names the accounts when not all of them share a counterparty', () => {
    const sides = [
      side(A, 'A', { sent: page([pay(A, K, 1)]), recv: page([]) }),
      side(B, 'B', { sent: page([]), recv: page([]) }),
      side(C, 'C', { sent: page([pay(C, K, 2)]), recv: page([]) }),
    ];
    const [row] = sharedCounterparties(sides).rows;
    expect(plain(counterpartyParts(row, 3))).toBe('A and C paid K');
  });

  it('shared groups smallest first, without MINTER', () => {
    const g = (groupId: number, groupName: string, memberCount?: number): GroupOf => ({
      groupId,
      groupName,
      ...(memberCount === undefined ? {} : { memberCount }),
    });
    const minter = g(MINTER_GROUP_ID, 'MINTER', 600);
    const sides = [
      side(A, 'A', {
        groups: [minter, g(1, 'General', 5_200), g(7, 'Book Club', 12), g(2, 'Other')],
      }),
      side(B, 'B', {
        groups: [minter, g(1, 'General', 5_200), g(7, 'Book Club', 12), g(2, 'Other')],
      }),
      side(C, 'C', { groups: [g(1, 'General', 5_200), g(9, 'Solo', 3)] }),
    ];
    const groups = sharedGroups(sides);
    expect(groups.map((x) => [groupWords(x), x.letters.join('')])).toEqual([
      ['Book Club (12 members)', 'AB'],
      ['General (5,200 members)', 'ABC'],
      ['Other', 'AB'],
    ]);
    expect(groupsLead(groups, 3)).toBe('3 groups with two or more of them');
    expect(groupsLead(groups.slice(0, 1), 2)).toBe('Both in 1 group');
  });

  it('timing rows as raw differences', () => {
    const sides = [
      side(A, 'A', { first: funded(H, 1_364_165), links: links([share(A, A, 1_371_000)]) }),
      side(B, 'B', { first: funded(H, 1_364_177), links: links([share(B, B, 1_371_014)]) }),
    ];
    expect(timingRows(sides, { [A]: T0, [B]: T0 + 2 * DAY })).toEqual([
      { key: 'firstSeen', text: 'First seen 12 blocks apart' },
      { key: 'selfShare', text: 'Self-shares created 14 blocks apart' },
      { key: 'joined', text: 'Joined MINTER 2 days apart' },
    ]);
    expect(
      timingText(
        'First seen',
        [
          { letter: 'A', value: 10 },
          { letter: 'C', value: 1_210 },
          { letter: 'B', value: 500 },
        ],
        'blocks',
        3
      )
    ).toBe('First seen 1,200 blocks apart, first to last: A, B, C');
    expect(
      timingText(
        'First seen',
        [
          { letter: 'A', value: 10 },
          { letter: 'B', value: 10 },
        ],
        'blocks',
        2
      )
    ).toBe('First seen in the same block');
    expect(timingText('First seen', [{ letter: 'A', value: 10 }], 'blocks', 2)).toBeNull();
  });
});

describe('the timeline together', () => {
  it('puts every first in order, with the gap to the line before', () => {
    const first = (from: string, height: number): FirstSeen => ({
      firstOwn: {
        type: 'REWARD_SHARE',
        height: height + 7_000,
        timestamp: T0 + (height + 7_000 - 1_000_000) * 60_000,
        signature: sig(),
      },
      funding: {
        kind: 'payment',
        from,
        amount: '5.4321',
        height,
        timestamp: T0 + (height - 1_000_000) * 60_000,
        signature: sig(),
      },
      firstSeen: { height, timestamp: T0 + (height - 1_000_000) * 60_000 },
    });
    const events = timelineEvents([
      {
        address: A,
        letter: 'A',
        first: first(H, 1_364_165),
        links: links([share(A, A, 1_371_000)]),
        primary: { name: 'Kit', registered: T0 + 400 * DAY },
        joinedAt: T0 + 800 * DAY,
        nominatedBy: [{ by: C, at: T0 + 700 * DAY }],
      },
      {
        address: B,
        letter: 'B',
        first: first(H, 1_364_170),
        links: links([share(B, B, 1_371_014)]),
        askedAt: T0 + 790 * DAY,
      },
    ]);
    const nameOf = (address: string) => (address === H ? 'Hal' : address === C ? 'Cy' : null);
    expect(events.map((e) => timelineLine(e, nameOf))).toEqual([
      'Block 1,364,165 · A: first QORT payment from Hal (Qhhhhh…hhhh) (5.4321 QORT)',
      'Block 1,364,170 · B: first QORT payment from Hal (Qhhhhh…hhhh) (5.4321 QORT)',
      'Block 1,371,000 · A: created a self-share (minting with its own key)',
      'Block 1,371,014 · B: created a self-share (minting with its own key)',
      'Block 1,371,165 · A: first transaction it sent: Reward share',
      'Block 1,371,170 · B: first transaction it sent: Reward share',
      `${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(T0 + 400 * DAY))} · A: registered the name “Kit” (its primary name now)`,
      expect.stringMatching(/ · A: nominated by Cy \(Qccccc…cccc\)$/),
      expect.stringMatching(/ · B: asked to join MINTER \(its newest request\)$/),
      expect.stringMatching(/ · A: joined MINTER$/),
    ]);
    expect(gapWords(events[0], events[1])).toBe('5 blocks later');
    expect(gapWords(events[2], events[2])).toBe('Same block');
    expect(gapWords(events[7], events[8])).toBe('3 months later');
    expect(gapWords(events[8], events[9])).toBe('10 days later');
  });

  it('a level move counts once, even when it is also where its first transaction came from', () => {
    const move = tx('TRANSFER_PRIVS', 1_100_000, { creatorAddress: C });
    const events = timelineEvents([
      {
        address: A,
        letter: 'A',
        first: {
          firstOwn: null,
          funding: {
            kind: 'transferPrivs',
            from: C,
            height: 1_100_000,
            timestamp: move.timestamp,
            signature: move.signature,
          },
          firstSeen: { height: 1_100_000, timestamp: move.timestamp },
        },
        links: links([move]),
      },
    ]);
    expect(events.map((e) => plain(e.parts))).toEqual(['got its minting level from C']);
  });
});

describe('copy findings', () => {
  it('the accounts, what was read, every finding with its block, the link; no verdicts', () => {
    const payment = pay(A, B, 1_364_500, '10');
    const text = compareText({
      accounts: [
        { letter: 'A', address: A, name: 'Kit' },
        { letter: 'B', address: B, name: null },
      ],
      checkedAt: 2_761_290,
      neutralLine: 'Nothing here shows who runs an account.',
      coverage: ['Payments between each pair: up to the newest 100 each way.'],
      pairs: [
        {
          label: 'A–B',
          lines: [
            {
              parts: [
                { kind: 'account', address: A },
                { kind: 'text', text: ' paid ' },
                { kind: 'account', address: B },
                { kind: 'text', text: ' 10 QORT in 1 payment (May 2023)' },
              ],
              height: 1_364_500,
              signature: payment.signature,
            },
            {
              parts: [{ kind: 'text', text: 'A sold 12 QORT to B on the trade portal in 1 trade' }],
              timestamp: T0,
            },
          ],
          noneFound: 'Checked, none found: level moves.',
        },
      ],
      emptyPairs: null,
      common: [{ parts: [{ kind: 'text', text: 'Both paid K' }] }],
      commonNotes: ['First seen 5 blocks apart'],
      timeline: ['Block 1,364,165 · A: first QORT payment from H'],
      link: 'qortal://APP/Q-Mintership+/explorer/compare/a/b',
      nameOf: (address) => (address === A ? 'Kit' : null),
    });
    expect(text).toBe(
      [
        'Compare accounts, checked at block 2,761,290',
        'Nothing here shows who runs an account.',
        '',
        `A: Kit (${A})`,
        `B: ${B}`,
        '',
        'What was read:',
        '- Payments between each pair: up to the newest 100 each way.',
        '',
        'Recorded between them:',
        'A–B:',
        `- Kit (Qaaaaa…aaaa) paid Qbbbbb…bbbb 10 QORT in 1 payment (May 2023) (block 1,364,500, ${payment.signature.slice(0, 8)}…)`,
        '- A sold 12 QORT to B on the trade portal in 1 trade (15 May 2023)',
        '  Checked, none found: level moves.',
        '',
        'In common:',
        '- Both paid K',
        '- First seen 5 blocks apart',
        '',
        'Timeline together:',
        '- Block 1,364,165 · A: first QORT payment from H',
        '',
        'qortal://APP/Q-Mintership+/explorer/compare/a/b',
      ].join('\n')
    );
    expect(text).not.toMatch(VERDICTS);
    expect(
      whereWords({ parts: [], height: 5, firstHeight: 1, count: 3, signature: 'abcdefghij' })
    ).toBe(' (blocks 1–5, 3 transactions, newest abcdefgh…)');
  });

  it('partial data says how far it got: still reading, couldn’t read, checked and none found', () => {
    const text = compareText({
      accounts: [
        { letter: 'A', address: A, name: null },
        { letter: 'B', address: B, name: null },
        { letter: 'C', address: C, name: null },
      ],
      checkedAt: null,
      neutralLine: 'Nothing here shows who runs an account.',
      coverage: [],
      pairs: [
        {
          label: 'A–B',
          lines: [{ parts: [{ kind: 'text', text: 'A paid B 1 QORT in 1 payment' }] }],
          noneFound: null,
          status: ['Still reading: reward shares.'],
        },
        {
          label: 'A–C',
          lines: [],
          noneFound: 'Checked, none found: Q-Mintership records.',
          status: ['Couldn’t read: payments both ways.'],
        },
      ],
      emptyPairs: null,
      common: [],
      commonNotes: [],
      commonStatus: [
        'Checked, none found: a shared first payer.',
        'Still checking for a shared sponsor.',
      ],
      timeline: [],
      timelineStatus: 'Still reading for the timeline.',
      link: 'qortal://APP/Q-Mintership+/explorer/compare/a/b/c',
    });
    expect(text).toContain(
      [
        'Recorded between them:',
        'A–B:',
        '- A paid B 1 QORT in 1 payment',
        '  Still reading: reward shares.',
        'A–C:',
        '  Checked, none found: Q-Mintership records.',
        '  Couldn’t read: payments both ways.',
        '',
        'In common:',
        'Checked, none found: a shared first payer.',
        'Still checking for a shared sponsor.',
        '',
        'Timeline together:',
        'Still reading for the timeline.',
        '',
      ].join('\n')
    );
  });
});
