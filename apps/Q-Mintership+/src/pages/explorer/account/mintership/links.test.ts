/**
 * Connections' "In Q-Mintership" links (links.ts): one row per other
 * account whatever names it used, the account itself never listed, a
 * nominator's other-name support folded into the nomination, the newest
 * community vote per account, and the round a nomination belongs to.
 */
import { describe, expect, it } from 'vitest';
import { fakeAddress } from '../../../../../e2e/world.mjs';
import type { MadeBy } from '../../../../data/explorer/madeBy';
import type { Nomination, Publisher } from '../../../../data/nominations';
import type { NominationRound } from '../../../../rules/rounds';
import type { VoteRow } from '../../../../rules/communityVotes';
import { mintershipLinks } from './links';

const ME = fakeAddress('links-me');
const NORA = fakeAddress('links-nora');
const JUNE = fakeAddress('links-june');
const BOB = fakeAddress('links-bob');
const CAL = fakeAddress('links-cal');

const publisher = (address: string, name: string): Publisher => ({
  address,
  name,
  isAdmin: false,
  level: 5,
});

const nomination = (over: Partial<Nomination>): Nomination =>
  ({
    nominee: ME,
    nomineeName: null,
    source: 'qdn',
    nomination: null,
    supporters: [],
    state: 'signing',
    publishedAt: 1_000,
    waitingEndsAt: null,
    decision: null,
    latestInvite: null,
    records: [],
    supportRecords: [],
    earlierRoundEnd: null,
    hasJoinRequest: false,
    hasStoredInvite: false,
    ...over,
  }) as Nomination;

const made = (over: Partial<MadeBy>): MadeBy => ({
  names: ['Me', 'Me Too'],
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
  ...over,
});

const vote = (voter: string, name: string, value: 'yes' | 'no', castAt: number): VoteRow => ({
  voter,
  name,
  nominee: ME,
  vote: value,
  castAt,
});

describe('mintershipLinks', () => {
  it('lists who nominated, supported and voted on them, each account once', () => {
    const rounds: NominationRound[] = [
      {
        signature: 'invite-2',
        number: 2,
        outcome: 'pending',
        firstSigner: null,
        startedAt: 2_000,
        startedHeight: 20,
        decidedHeight: null,
      },
    ];
    const links = mintershipLinks({
      address: ME,
      nominations: [
        nomination({
          records: [
            {
              publisher: publisher(NORA, 'Nora'),
              publishedAt: 1_500,
              identifier: `qmp-nomination-${ME}`,
              record: {} as never,
            },
          ],
          supportRecords: [
            // Nora again, under her second name: part of her nomination.
            { publisher: publisher(NORA, 'Spare Room'), publishedAt: 1_600, record: {} as never },
            { publisher: publisher(JUNE, 'June'), publishedAt: 1_700, record: {} as never },
            { publisher: publisher(ME, 'Me'), publishedAt: 1_800, record: {} as never },
          ],
          decision: { signature: 'invite-2' } as Nomination['decision'],
        }),
      ],
      rounds,
      windowMs: 10_000,
      made: null,
      votesOnThem: [
        vote(BOB, 'Bob', 'yes', 10),
        vote(BOB, 'Bob Two', 'no', 20),
        vote(CAL, 'Cal', 'yes', 5),
        vote(ME, 'Me', 'yes', 30),
      ],
    });
    expect(links.map((l) => [l.kind, l.other, l.names, l.round, l.vote, l.votes])).toEqual([
      ['nominatedThem', NORA, 2, 2, null, 0],
      ['supportedThem', JUNE, 1, 2, null, 0],
      ['votedOnThem', BOB, 2, null, 'no', 2],
      ['votedOnThem', CAL, 1, null, 'yes', 1],
    ]);
  });

  // Simon, 2026-11-20: rounds are kept apart now; the profile still lists every round's
  // nominator, each with the round its invite answered (Jonny: Simon in October, igorcoin in
  // November).
  it('lists every round’s nominators, each with its own round', () => {
    const DAY = 86_400_000;
    const round = (number: number, startedAt: number): NominationRound => ({
      signature: `invite-${number}`,
      number,
      outcome: 'rejected',
      firstSigner: null,
      startedAt,
      startedHeight: null,
      decidedHeight: null,
    });
    const entry = (address: string, name: string, publishedAt: number) => ({
      publisher: publisher(address, name),
      publishedAt,
      identifier: `qmp-nomination-${ME}`,
      record: {} as never,
    });
    const links = mintershipLinks({
      address: ME,
      nominations: [
        nomination({ records: [entry(NORA, 'Nora', 10 * DAY), entry(JUNE, 'June', 40 * DAY)] }),
      ],
      rounds: [round(2, 42 * DAY), round(1, 10 * DAY + 3_600_000)],
      windowMs: 7 * DAY,
      made: null,
      votesOnThem: [],
    });
    expect(links.map((l) => [l.kind, l.other, l.round])).toEqual([
      ['nominatedThem', JUNE, 2],
      ['nominatedThem', NORA, 1],
    ]);
  });

  it('lists who they nominated, supported and voted on, under any of their names', () => {
    const links = mintershipLinks({
      address: ME,
      nominations: [],
      rounds: [],
      made: made({
        nominations: [
          { name: 'Me', identifier: 'n1', at: 30, nominee: BOB },
          { name: 'Me Too', identifier: 'n2', at: 10, nominee: CAL },
        ],
        supports: [
          // A support of someone they nominated, under the other name.
          { name: 'Me Too', identifier: 's1', at: 40, nominee: BOB },
          { name: 'Me', identifier: 's2', at: 20, nominee: JUNE },
          { name: 'Me', identifier: 's3', at: 25, nominee: ME },
        ],
        votes: [
          { name: 'Me', identifier: 'v1', at: 5, nominee: NORA, vote: 'yes' },
          { name: 'Me Too', identifier: 'v2', at: 6, nominee: NORA, vote: 'no' },
        ],
      }),
      votesOnThem: [],
      windowMs: 10_000,
    });
    expect(links.map((l) => [l.kind, l.other, l.names, l.vote])).toEqual([
      ['nominated', BOB, 2, null],
      ['nominated', CAL, 1, null],
      ['supported', JUNE, 1, null],
      ['votedOn', NORA, 2, 'no'],
    ]);
  });

  it('finds nothing for an account with no records either way', () => {
    expect(
      mintershipLinks({
        address: ME,
        nominations: [],
        rounds: [],
        made: made({}),
        votesOnThem: [],
        windowMs: 10_000,
      })
    ).toEqual([]);
  });
});
