import { describe, expect, it } from 'vitest';
import { buildTimeline } from '../../data/timeline';
import type { TxRow } from '../../data/types';
import {
  HISTORY_TYPES,
  historyFilterChips,
  historyType,
  matchesHistoryFilter,
  parseHistoryFilter,
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
      ['Banned from MINTER', 'removal'],
      ['Join request declined', 'declined'],
      ['Asked to join MINTER', 'joinRequest'],
      ['Joined MINTER', 'joined'],
      ['Approved for MINTER', 'invite'],
    ]);
  });

  it('removals and bans share a type; a kick of a member is a removal', () => {
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

  it('offers All and the types with events, in a fixed order, with counts', () => {
    const chips = historyFilterChips(everyType(), 'all');
    expect(chips.map((c) => [c.label, c.count])).toEqual([
      ['All', 11],
      ['Invites', 2],
      ['Join requests', 1],
      ['Joined MINTER', 1],
      ['Declined requests', 1],
      ['Removals and bans', 1],
      ['Left MINTER', 1],
      ['Bans lifted', 1],
      ['Cancelled invites', 1],
      ['Minter Admin changes', 2],
    ]);
    // Other changes has no events here, so no chip.
    expect(HISTORY_TYPES.at(-1)?.key).toBe('other');
  });

  it('keeps the chosen type with none, so it can be seen and left', () => {
    const events = everyType().filter((e) => historyType(e) !== 'liftBan');
    expect(historyFilterChips(events, 'all').some((c) => c.key === 'liftBan')).toBe(false);
    expect(historyFilterChips(events, 'liftBan').find((c) => c.key === 'liftBan')).toEqual({
      key: 'liftBan',
      label: 'Bans lifted',
      count: 0,
    });
    expect(historyFilterChips([], 'all')).toEqual([{ key: 'all', label: 'All', count: 0 }]);
  });

  it('filters, and reads ?type= safely', () => {
    const events = everyType();
    expect(events.filter((e) => matchesHistoryFilter(e, 'all'))).toHaveLength(11);
    expect(events.filter((e) => matchesHistoryFilter(e, 'invite')).map((e) => e.title)).toEqual([
      'Nominated for MINTER',
      'Approved for MINTER',
    ]);
    expect(parseHistoryFilter('admins')).toBe('admins');
    expect(parseHistoryFilter('all')).toBe('all');
    expect(parseHistoryFilter('nonsense')).toBe('all');
    expect(parseHistoryFilter(null)).toBe('all');
  });
});
