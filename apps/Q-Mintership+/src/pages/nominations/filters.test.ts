import { describe, expect, it } from 'vitest';
import type { Nomination } from '../../data/nominations';
import type { TxRow } from '../../data/types';
import type { Decision } from '../../rules/decision';
import { ADDR, MS_PER_BLOCK, NOW } from '../../test/world';
import {
  canNominateAgain,
  countByFilter,
  endedAt,
  isStillOpenForSupport,
  matchesFilter,
  matchesSearch,
  myPart,
  parseFilter,
} from './filters';

const DAY = 86_400_000;
const group = { minimumBlockDelay: 5, maximumBlockDelay: 10_080 };
const now = { msPerBlock: MS_PER_BLOCK, timestamp: NOW };

function nom(partial: Partial<Nomination> & Pick<Nomination, 'nominee' | 'state'>): Nomination {
  return {
    nomineeName: null,
    source: 'qdn',
    nomination: null,
    supporters: [],
    publishedAt: NOW - DAY,
    waitingEndsAt: null,
    decision: null,
    latestInvite: null,
    hasJoinRequest: false,
    hasStoredInvite: false,
    ...partial,
  };
}

const publisher = (name: string, address: string) => ({ name, address, isAdmin: false, level: 6 });

describe('Nominations filters', () => {
  it('reads the filter from the address, falling back to All', () => {
    expect(parseFilter('signing')).toBe('signing');
    expect(parseFilter(null)).toBe('all');
    expect(parseFilter('rejected')).toBe('all');
  });

  it('leaves Ready to mint to its own tab', () => {
    expect(parseFilter('ready')).toBe('all');
  });

  it('counts and filters by state', () => {
    const list = [
      nom({ nominee: ADDR.nominatedWaiting, state: 'waiting' }),
      nom({ nominee: ADDR.nominatedSigning, state: 'signing' }),
      nom({ nominee: ADDR.urgent, state: 'signing' }),
      nom({ nominee: ADDR.approved, state: 'approved' }),
      nom({ nominee: ADDR.banned, state: 'blocked' }),
    ];
    expect(countByFilter(list)).toEqual({ all: 5, waiting: 1, signing: 2, approved: 1 });
    expect(list.filter((n) => matchesFilter(n, 'signing'))).toHaveLength(2);
    expect(list.filter((n) => matchesFilter(n, 'all'))).toHaveLength(5);
  });

  it('searches names and addresses of nominees, nominators and supporters, ignoring case', () => {
    const n = nom({
      nominee: ADDR.nominatedWaiting,
      state: 'waiting',
      nomineeName: 'Wren Waiting',
      nomination: {
        publisher: publisher('Nora Nominator', ADDR.nominator),
        record: { v: 1, nomineeAddress: ADDR.nominatedWaiting, reason: 'x'.repeat(20), links: [] },
        publishedAt: NOW,
        identifier: `qmp-nomination-${ADDR.nominatedWaiting}`,
      },
      supporters: [
        {
          publisher: publisher('Juniper L4', ADDR.adminL4),
          record: { v: 1, nomineeAddress: ADDR.nominatedWaiting },
          publishedAt: NOW,
        },
      ],
    });
    expect(matchesSearch(n, '')).toBe(true);
    expect(matchesSearch(n, 'wren')).toBe(true);
    expect(matchesSearch(n, ADDR.nominatedWaiting.slice(3, 15).toLowerCase())).toBe(true);
    expect(matchesSearch(n, 'NORA')).toBe(true);
    expect(matchesSearch(n, 'juniper')).toBe(true);
    expect(matchesSearch(n, 'someone else')).toBe(false);
    // Names looked up after the list loaded count too.
    const chainOnly = nom({ nominee: ADDR.early, state: 'signing', source: 'chain' });
    expect(matchesSearch(chainOnly, 'eli')).toBe(false);
    expect(matchesSearch(chainOnly, 'eli', () => 'Eli Early')).toBe(true);
  });

  it('dates the end of a round from its invite, or from the end of the wait', () => {
    const invite = {
      timestamp: NOW - 10 * DAY,
      blockHeight: 1_000,
      approvalStatus: 'EXPIRED',
    } as TxRow;
    const expired = nom({ nominee: ADDR.expired, state: 'expired', latestInvite: invite });
    expect(endedAt(expired, now, group)).toBe(NOW - 10 * DAY + 10_081 * MS_PER_BLOCK);
    const lapsed = nom({ nominee: ADDR.lapsed, state: 'lapsed', publishedAt: NOW - 10 * DAY });
    expect(endedAt(lapsed, now, group)).toBe(NOW - 10 * DAY + 10_080 * MS_PER_BLOCK);
    const joined = nom({ nominee: ADDR.recentlyJoined, state: 'joined', publishedAt: NOW - DAY });
    expect(endedAt(joined, now, group)).toBe(NOW - DAY);
  });

  it('offers Propose nomination again on rounds that ran out', () => {
    const again = (state: Nomination['state']) =>
      canNominateAgain(nom({ nominee: ADDR.lapsed, state }));
    expect(again('lapsed')).toBe(true);
    expect(again('expired')).toBe(true);
    expect(again('joined')).toBe(false);
    expect(again('rejected')).toBe(false);
    expect(again('waiting')).toBe(false);
  });

  it('offers support only while it can still matter', () => {
    const signing = (phase: Decision['phase'] | null) =>
      nom({
        nominee: ADDR.urgent,
        state: 'signing',
        decision: phase ? ({ phase } as Decision) : null,
      });
    expect(isStillOpenForSupport(nom({ nominee: ADDR.nominatedWaiting, state: 'waiting' }))).toBe(
      true
    );
    expect(isStillOpenForSupport(signing(null))).toBe(true);
    expect(isStillOpenForSupport(signing('unconfirmed'))).toBe(true);
    expect(isStillOpenForSupport(signing('open'))).toBe(true);
    expect(isStillOpenForSupport(signing('thresholdMet'))).toBe(false);
    expect(isStillOpenForSupport(signing('tooLate'))).toBe(false);
    expect(isStillOpenForSupport(nom({ nominee: ADDR.approved, state: 'approved' }))).toBe(false);
    expect(isStillOpenForSupport(nom({ nominee: ADDR.banned, state: 'blocked' }))).toBe(false);
  });

  it('says what the signed-in member already did for a nomination', () => {
    const n = nom({
      nominee: ADDR.nominatedWaiting,
      state: 'waiting',
      nomination: {
        publisher: publisher('Nora Nominator', ADDR.nominator),
        record: { v: 1, nomineeAddress: ADDR.nominatedWaiting, reason: 'x'.repeat(20), links: [] },
        publishedAt: NOW,
        identifier: `qmp-nomination-${ADDR.nominatedWaiting}`,
      },
      supporters: [
        {
          publisher: publisher('Juniper L4', ADDR.adminL4),
          record: { v: 1, nomineeAddress: ADDR.nominatedWaiting },
          publishedAt: NOW,
        },
      ],
    });
    expect(myPart(n, ADDR.nominator, null)).toEqual({
      label: 'You nominated them',
      inFlight: false,
    });
    expect(myPart(n, ADDR.adminL4, null)?.label).toBe('You support this');
    expect(myPart(n, ADDR.admin, null)).toBeNull();
    expect(myPart(n, ADDR.admin, { status: 'sending' })).toEqual({
      label: 'Sending…',
      inFlight: true,
    });
    expect(myPart(n, ADDR.admin, { status: 'confirming' })?.label).toBe(
      'Support sent ✓ (confirming…)'
    );
    expect(myPart(n, ADDR.admin, { status: 'failed' })).toBeNull();
    // Signed out: nothing is theirs.
    expect(myPart(n, '', null)).toBeNull();
  });
});
