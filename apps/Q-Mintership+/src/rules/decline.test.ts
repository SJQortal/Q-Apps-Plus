import { describe, expect, it } from 'vitest';
import { fakeAddress } from '../../e2e/world.mjs';
import type { TxRow } from '../data/types';
import { DECLINE_TITLE, isDeclineIn, joinRequestStory, markDeclines } from './decline';
import { decisionTitle } from './decision';

const me = fakeAddress('decline-me');
const admin = fakeAddress('decline-admin');
let n = 0;
/** A confirmed row at block `height`, applied at `approvalHeight` when given. */
const tx = (type: string, height: number, extra: Partial<TxRow> = {}): TxRow => ({
  type,
  timestamp: 1_790_000_000_000 + height * 60_000,
  signature: `${type}-${height}-${++n}`,
  txGroupId: 694,
  groupId: 694,
  blockHeight: height,
  approvalStatus: 'APPROVED',
  creatorAddress: admin,
  ...extra,
});
const join = (height: number) =>
  tx('JOIN_GROUP', height, { creatorAddress: me, txGroupId: 0, approvalStatus: 'NOT_REQUIRED' });
const leave = (height: number) =>
  tx('LEAVE_GROUP', height, { creatorAddress: me, txGroupId: 0, approvalStatus: 'NOT_REQUIRED' });
const invite = (height: number, approvalHeight: number) =>
  tx('GROUP_INVITE', height, { invitee: me, approvalHeight });
const kick = (height: number, approvalHeight?: number, status = 'APPROVED') =>
  tx('GROUP_KICK', height, {
    member: me,
    approvalStatus: status as TxRow['approvalStatus'],
    ...(approvalHeight ? { approvalHeight } : {}),
  });

describe('which kicks decline a join request', () => {
  it('a kick of someone who asked to join and was never a member declines it', () => {
    const k = kick(200, 300);
    const story = joinRequestStory(me, [k, join(100)]);
    expect([...story.declined]).toEqual([k.signature]);
    expect(isDeclineIn(story, k)).toBe(true);
  });

  it('a kick of a member removes them, even with an old join request on record', () => {
    // Asked to join, approved (a member at once), then kicked.
    const k = kick(400, 500);
    const story = joinRequestStory(me, [join(100), invite(200, 300), k]);
    expect(story.declined.size).toBe(0);
    expect(isDeclineIn(story, k)).toBe(false);
  });

  it('a former member who asks again and is declined: only the second kick is a decline', () => {
    const removed = kick(400, 500);
    const declined = kick(700, 800);
    const story = joinRequestStory(me, [invite(100, 150), join(160), removed, join(600), declined]);
    expect(isDeclineIn(story, removed)).toBe(false);
    expect(isDeclineIn(story, declined)).toBe(true);
  });

  it('an approved invite then joining makes a member; one who left and asked again is declined', () => {
    const k = kick(900, 950);
    const story = joinRequestStory(me, [invite(100, 150), join(200), leave(300), join(400), k]);
    expect(isDeclineIn(story, k)).toBe(true);
  });

  it('a kick with no join request on record is never taken for a decline', () => {
    const k = kick(200, 300);
    expect(isDeclineIn(joinRequestStory(me, [k]), k)).toBe(false);
  });

  it('a kick proposed while they were asking, rejected or expired, was a proposed decline', () => {
    const rejected = kick(200, 300, 'REJECTED');
    const expired = kick(400, undefined, 'EXPIRED');
    const story = joinRequestStory(me, [join(100), rejected, expired]);
    expect(isDeclineIn(story, rejected)).toBe(true);
    expect(isDeclineIn(story, expired)).toBe(true);
    expect(story.declined.size).toBe(0);
  });

  it('a join request sent in the same block as the approval counts first', () => {
    const k = kick(100, 300);
    expect(isDeclineIn(joinRequestStory(me, [k, join(300)]), k)).toBe(true);
  });

  it('a ban takes the join request away: a later kick is not a decline', () => {
    const k = kick(500, 600);
    const ban = tx('GROUP_BAN', 200, { offender: me, approvalHeight: 300, timeToLive: 3_600 });
    expect(isDeclineIn(joinRequestStory(me, [join(100), ban, k]), k)).toBe(false);
  });

  it('ignores other people’s rows', () => {
    const k = kick(200, 300);
    const other = { ...join(100), creatorAddress: fakeAddress('someone-else') };
    expect(isDeclineIn(joinRequestStory(me, [other, k]), k)).toBe(false);
  });
});

describe('waiting declines', () => {
  const d = (kind: string, subject: string | null) => ({ kind, subject, creatorAddress: admin });

  it('marks a waiting kick of someone with a join request, and titles it', () => {
    const asking = new Set([me]);
    const [kickOfRequest, kickOfMember, ban] = markDeclines(
      [d('kick', me), d('kick', fakeAddress('member')), d('ban', me)],
      asking,
      new Set()
    );
    expect(kickOfRequest.decline).toBe(true);
    expect(kickOfMember.decline).toBeUndefined();
    expect(ban.decline).toBeUndefined();
    expect(decisionTitle({ kind: 'kick', subject: me, creatorAddress: admin, decline: true })).toBe(
      DECLINE_TITLE
    );
    expect(decisionTitle({ kind: 'kick', subject: me, creatorAddress: admin })).toBe(
      'Remove from MINTER'
    );
  });

  it('never marks a kick of a Minter Admin', () => {
    const [k] = markDeclines([d('kick', me)], new Set([me]), new Set([me]));
    expect(k.decline).toBeUndefined();
  });
});
