import { describe, expect, it } from 'vitest';
import { fakeAddress } from '../../e2e/world.mjs';
import type { TxRow } from '../data/types';
import { banEnd, formerMember, lastDeclinedAt, latestRemoval, resolveStatus } from './status';

const NOW = 1_791_830_000_000;
const DAY = 86_400_000;
const me = fakeAddress('status-ban-end');
const tip = { height: 2_000_000, timestamp: NOW };
const msPerBlock = 60_000;
/** When block `height` was, at one block a minute. */
const at = (height: number) => NOW - (tip.height - height) * msPerBlock;
const tx = (type: string, height: number, extra: Partial<TxRow> = {}): TxRow => ({
  type,
  timestamp: at(height) - 10_000,
  signature: `${type}-${height}`,
  txGroupId: 694,
  groupId: 694,
  blockHeight: height,
  approvalStatus: 'APPROVED',
  ...extra,
});

const invite = tx('GROUP_INVITE', 1_000_000, { invitee: me });
const kick = tx('GROUP_KICK', 1_900_000, { member: me, approvalHeight: 1_900_100 });
/** Banned for `days` (0: permanent), proposed at block 1,900,000, approved 1,440 blocks (a day) later. */
const ban = (days: number) =>
  tx('GROUP_BAN', 1_900_000, {
    offender: me,
    approvalHeight: 1_901_440,
    timeToLive: days * 86_400,
  });
const lift = tx('CANCEL_GROUP_BAN', 1_950_000, { member: me, approvalHeight: 1_950_200 });

const removal = (history: TxRow[]) => latestRemoval(me, history, tip, msPerBlock);
const former = (history: TxRow[]) => formerMember(me, history, tip, msPerBlock);

describe('how a ban ended', () => {
  it('a kick has no ban end, and stays a removal', () => {
    const r = removal([invite, kick]);
    expect(r?.kind).toBe('kick');
    expect(banEnd(r!)).toBeNull();
    expect(former([invite, kick])).toEqual({ kind: 'removed', at: at(1_900_100) });
  });

  it('a timed ban past its end ended then, counted from when it was proposed', () => {
    const tenDays = ban(10);
    const end = tenDays.timestamp + 10 * DAY;
    expect(end).toBeLessThan(NOW);
    expect(removal([invite, tenDays])).toMatchObject({
      kind: 'ban',
      banSeconds: 864_000,
      endedAt: end,
    });
    expect(banEnd(removal([invite, tenDays])!)).toEqual({ how: 'ended', at: end });
    expect(former([invite, tenDays])).toEqual({
      kind: 'banned',
      at: at(1_901_440),
      ban: { how: 'ended', at: end },
    });
  });

  it('never ends before it took effect', () => {
    // A 12-hour ban approved a day after it was proposed: over as it took effect.
    const short = { ...ban(0), timeToLive: 43_200 };
    expect(removal([invite, short])?.endedAt).toBe(at(1_901_440));
  });

  it('a timed ban still running has no end yet', () => {
    // Proposed about a week ago (10,000 blocks at a minute), for 24 days.
    const recent = tx('GROUP_BAN', 1_990_000, {
      offender: me,
      approvalHeight: 1_990_100,
      timeToLive: 24 * 86_400,
    });
    expect(removal([invite, recent])?.endedAt).toBeUndefined();
  });

  it('a lifted ban was lifted, whatever its length', () => {
    // Approved about 4 days after the ban took effect, before a 10-day ban runs out.
    const early = tx('CANCEL_GROUP_BAN', 1_905_000, { member: me, approvalHeight: 1_907_200 });
    for (const days of [0, 10]) {
      expect(banEnd(removal([invite, ban(days), early])!)).toEqual({
        how: 'lifted',
        at: at(1_907_200),
      });
    }
    expect(banEnd(removal([invite, ban(0), lift])!)).toEqual({ how: 'lifted', at: at(1_950_200) });
    expect(former([invite, ban(0), lift])).toEqual({
      kind: 'banned',
      at: at(1_901_440),
      ban: { how: 'lifted', at: at(1_950_200) },
    });
  });

  it('a timed ban that ran out before its lift was approved ended then', () => {
    const tenDays = ban(10);
    const end = tenDays.timestamp + 10 * DAY;
    // `lift` was approved weeks after the 10-day end.
    expect(at(1_950_200)).toBeGreaterThan(end);
    expect(banEnd(removal([invite, tenDays, lift])!)).toEqual({ how: 'ended', at: end });
    expect(former([invite, tenDays, lift])).toEqual({
      kind: 'banned',
      at: at(1_901_440),
      ban: { how: 'ended', at: end },
    });
  });

  it('only bans up to 24 days get an end date', () => {
    // Both proposed about 69 days ago (100,000 blocks at a minute), so both are over.
    const longest = ban(24);
    expect(removal([invite, longest])?.endedAt).toBe(longest.timestamp + 24 * DAY);
    const longer = ban(30);
    expect(removal([invite, longer])).toMatchObject({ kind: 'ban', banSeconds: 30 * 86_400 });
    expect(removal([invite, longer])?.endedAt).toBeUndefined();
    expect(banEnd(removal([invite, longer])!)).toEqual({ how: 'ended', at: null });
    expect(former([invite, longer])).toEqual({
      kind: 'banned',
      at: at(1_901_440),
      ban: { how: 'ended', at: null },
    });
  });

  it('a permanent ban with no lift on record has ended without a date', () => {
    expect(banEnd(removal([invite, ban(0)])!)).toEqual({ how: 'ended', at: null });
  });
});

describe('a declined join request', () => {
  const join = (height: number) =>
    tx('JOIN_GROUP', height, { creatorAddress: me, txGroupId: 0, approvalStatus: 'NOT_REQUIRED' });
  const decline = tx('GROUP_KICK', 1_960_000, { member: me, approvalHeight: 1_960_300 });
  const status = (history: TxRow[]) =>
    resolveStatus({
      hub: 'signedIn',
      address: me,
      name: null,
      level: 0,
      blocksMinted: 0,
      isMember: false,
      isAdmin: false,
      hasJoinRequest: false,
      activeBan: null,
      storedInvite: null,
      history,
      nominations: [],
      msPerBlock,
      tip,
    });

  it('is never a removal: someone who was never a member stays not in MINTER yet', () => {
    const history = [join(1_950_000), decline];
    expect(removal(history)).toBeNull();
    expect(former(history)).toBeNull();
    expect(status(history)).toMatchObject({
      kind: 'newcomer',
      removal: null,
      declinedAt: at(1_960_300),
    });
    expect(lastDeclinedAt(me, history, tip, msPerBlock)).toBe(at(1_960_300));
  });

  it('leaves a former member’s own removal as it was', () => {
    // Removed at block 1,900,100, asked again, then declined.
    const history = [invite, kick, join(1_950_000), decline];
    expect(removal(history)).toMatchObject({ kind: 'kick', at: at(1_900_100) });
    expect(former(history)).toEqual({ kind: 'removed', at: at(1_900_100) });
    expect(status(history)).toMatchObject({ kind: 'formerKicked', declinedAt: at(1_960_300) });
  });

  it('a kick with no join request on record stays a removal', () => {
    expect(status([kick])).toMatchObject({ kind: 'formerKicked', declinedAt: null });
  });
});
