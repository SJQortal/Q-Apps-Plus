import { describe, expect, it } from 'vitest';
import { buildTimeline } from '../../data/timeline';
import type { TxRow } from '../../data/types';
import { fromDateInput } from '../activity/range';
import {
  historyFilterChoices,
  historyType,
  longerPeriod,
  longerPeriodLabel,
  matchesHistoryFilter,
  PERIOD_CHOICES,
  parseHistoryFilter,
  parseHistoryPeriod,
  periodStartMs,
  periodWords,
  searchTypesFor,
  windowsFor,
} from './historyFilters';

const CTX = { msPerBlock: 60_000, maximumBlockDelay: 10_080 };
const ADMIN = 'QAdminaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const who = (i: number) => `QPerson${String(i).padStart(27, '0')}`;

let n = 0;
function tx(type: string, height: number, extra: Partial<TxRow> = {}): TxRow {
  n += 1;
  return {
    type,
    signature: `sig${n}`,
    timestamp: 1_000_000_000 + height * 60_000,
    blockHeight: height,
    txGroupId: 694,
    groupId: 694,
    creatorAddress: ADMIN,
    approvalStatus: 'APPROVED',
    ...extra,
  };
}
const join = (address: string, height: number) =>
  tx('JOIN_GROUP', height, {
    creatorAddress: address,
    txGroupId: 0,
    approvalStatus: 'NOT_REQUIRED',
  });

/** One event of every type, and a second invite that expired. */
function everyType() {
  return buildTimeline(
    [
      tx('GROUP_INVITE', 10, { invitee: who(1), approvalHeight: 20 }),
      join(who(1), 30),
      join(who(2), 40),
      tx('GROUP_KICK', 50, { member: who(2), approvalHeight: 60 }),
      tx('GROUP_BAN', 70, { offender: who(3), approvalHeight: 80, timeToLive: 0 }),
      tx('LEAVE_GROUP', 90, { creatorAddress: who(4), txGroupId: 0 }),
      tx('CANCEL_GROUP_BAN', 100, { member: who(3), approvalHeight: 110 }),
      tx('CANCEL_GROUP_INVITE', 120, { invitee: who(5), approvalHeight: 130 }),
      tx('ADD_GROUP_ADMIN', 140, { member: who(6), approvalHeight: 150 }),
      tx('REMOVE_GROUP_ADMIN', 160, { admin: who(7), approvalHeight: 170 }),
      tx('GROUP_INVITE', 180, { invitee: who(8), approvalStatus: 'EXPIRED' }),
    ],
    CTX
  );
}

describe('History: type filters', () => {
  it('puts each event under one type, an expired nomination with the invites', () => {
    const types = everyType().map((e) => [e.title, historyType(e)]);
    expect(types).toEqual([
      ['Nominated for MINTER', 'invite'],
      ['No longer a Minter Admin', 'admins'],
      ['Made a Minter Admin', 'admins'],
      ['Approved invite cancelled', 'cancelInvite'],
      ['Ban lifted', 'liftBan'],
      ['Left MINTER', 'left'],
      ['Banned from MINTER', 'ban'],
      ['Join request declined', 'declined'],
      ['Asked to join MINTER', 'joinRequest'],
      ['Joined MINTER', 'joined'],
      ['Approved for MINTER', 'invite'],
    ]);
  });

  it('a kick of a member is a removal, apart from bans', () => {
    const events = buildTimeline(
      [
        tx('GROUP_INVITE', 10, { invitee: who(1), approvalHeight: 20 }),
        join(who(1), 30),
        tx('GROUP_KICK', 40, { member: who(1), approvalHeight: 50 }),
      ],
      CTX
    );
    expect(events.map((e) => [e.title, historyType(e)])[0]).toEqual([
      'Removed from MINTER',
      'removal',
    ]);
  });

  it('offers All and every type, in a fixed order; Other changes only when there are some', () => {
    const labels = historyFilterChoices([], 'all').map((c) => c.label);
    expect(labels).toEqual([
      'All',
      'Invites',
      'Join requests',
      'Joined MINTER',
      'Declined requests',
      'Removals',
      'Bans',
      'Left MINTER',
      'Bans lifted',
      'Cancelled invites',
      'Minter Admin changes',
    ]);
    expect(historyFilterChoices([], 'other').at(-1)?.label).toBe('Other changes');
    expect(
      historyFilterChoices([{ kind: 'other', decline: false, joinRequest: false }], 'all').at(-1)
        ?.label
    ).toBe('Other changes');
  });

  it('searches decision types across MINTER’s history; joins and leaves stay in windows', () => {
    expect(searchTypesFor('ban')).toEqual(['GROUP_BAN']);
    expect(searchTypesFor('removal')).toEqual(['GROUP_KICK']);
    expect(searchTypesFor('declined')).toEqual(['GROUP_KICK']);
    expect(searchTypesFor('invite')).toEqual(['GROUP_INVITE']);
    expect(searchTypesFor('liftBan')).toEqual(['CANCEL_GROUP_BAN']);
    expect(searchTypesFor('cancelInvite')).toEqual(['CANCEL_GROUP_INVITE']);
    expect(searchTypesFor('admins')).toEqual(['ADD_GROUP_ADMIN', 'REMOVE_GROUP_ADMIN']);
    for (const windowed of ['all', 'joinRequest', 'joined', 'left', 'other'] as const)
      expect(searchTypesFor(windowed)).toBeNull();
  });

  it('filters, and reads ?type= safely', () => {
    const events = everyType();
    expect(events.filter((e) => matchesHistoryFilter(e, 'all'))).toHaveLength(11);
    expect(events.filter((e) => matchesHistoryFilter(e, 'invite')).map((e) => e.title)).toEqual([
      'Nominated for MINTER',
      'Approved for MINTER',
    ]);
    expect(parseHistoryFilter('ban')).toBe('ban');
    expect(parseHistoryFilter('all')).toBe('all');
    expect(parseHistoryFilter('nonsense')).toBe('all');
    expect(parseHistoryFilter(null)).toBe('all');
  });
});

describe('History: the period', () => {
  const NOW = Date.UTC(2026, 9, 15, 12);
  const DAY = 86_400_000;

  it('reads ?period= and ?from=, anything else is the last 30 days', () => {
    expect(parseHistoryPeriod(null, null)).toEqual({ kind: 'days', days: 30 });
    expect(parseHistoryPeriod('60', null)).toEqual({ kind: 'days', days: 60 });
    expect(parseHistoryPeriod('365', null)).toEqual({ kind: 'days', days: 365 });
    expect(parseHistoryPeriod('45', null)).toEqual({ kind: 'days', days: 30 });
    expect(parseHistoryPeriod('any', null)).toEqual({ kind: 'days', days: 30 });
    expect(parseHistoryPeriod(null, '2026-01-03')).toEqual({ kind: 'from', date: '2026-01-03' });
    // A date wins over a number; a broken date doesn't count.
    expect(parseHistoryPeriod('60', '2026-01-03')).toEqual({ kind: 'from', date: '2026-01-03' });
    expect(parseHistoryPeriod('60', '3 Jan')).toEqual({ kind: 'days', days: 60 });
  });

  it('offers no "Any time": the last 30 days come first', () => {
    expect(PERIOD_CHOICES.map((p) => p.label)).toEqual([
      'Last 30 days',
      'Last 60 days',
      'Last 120 days',
      'Last year',
      'From a date…',
    ]);
  });

  it('says where it starts, in words, and what the next longer period is', () => {
    expect(periodStartMs({ kind: 'days', days: 120 }, NOW)).toBe(NOW - 120 * DAY);
    const from = periodStartMs({ kind: 'from', date: '2026-01-03' }, NOW);
    expect(from).toBe(fromDateInput('2026-01-03'));
    expect(periodWords({ kind: 'days', days: 60 }, NOW - 60 * DAY)).toBe('in the last 60 days');
    expect(periodWords({ kind: 'days', days: 365 }, NOW - 365 * DAY)).toBe('in the last year');
    expect(periodWords({ kind: 'from', date: '2026-01-03' }, from)).toBe('since 3 Jan 2026');
    const steps: string[] = [];
    for (let p = longerPeriod({ kind: 'days', days: 30 }); p; p = longerPeriod(p))
      steps.push(longerPeriodLabel(p));
    expect(steps).toEqual([
      'Show the last 60 days',
      'Show the last 120 days',
      'Show the last year',
    ]);
    expect(longerPeriod({ kind: 'from', date: '2026-01-03' })).toBeNull();
  });

  it('reads the 30-day windows a period covers, at most three years', () => {
    expect(windowsFor(NOW - 10 * DAY, NOW)).toBe(1);
    expect(windowsFor(NOW - 30 * DAY, NOW)).toBe(1);
    expect(windowsFor(NOW - 60 * DAY, NOW)).toBe(2);
    expect(windowsFor(NOW - 120 * DAY, NOW)).toBe(4);
    expect(windowsFor(NOW - 365 * DAY, NOW)).toBe(13);
    expect(windowsFor(NOW - 5000 * DAY, NOW)).toBe(36);
  });
});
