import { describe, expect, it } from 'vitest';
import { fetchCallsFor } from '../test/setup';
import { ADDR, MS_PER_BLOCK, NOW, TIP, installWorld } from '../test/world';
import { getAddressHistory } from './txs';
import {
  banLength,
  buildTimeline,
  eventsAbout,
  loadHistoryWindow,
  memberSince,
  proposalsBy,
  withOwnSubject,
} from './timeline';
import type { TxRow } from './types';

const CTX = { msPerBlock: 60_000, maximumBlockDelay: 10_080 };
const A = 'QAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'.slice(0, 34);
const B = 'QBbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'.slice(0, 34);
const ADMIN = 'QCccccccccccccccccccccccccccccccccc'.slice(0, 34);

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

describe('timeline wording', () => {
  it('tells a join request from a join, and an approval that adds at once', () => {
    const rows = [
      tx('JOIN_GROUP', 100, { creatorAddress: A, txGroupId: 0, approvalStatus: 'NOT_REQUIRED' }),
      tx('GROUP_INVITE', 200, { invitee: A, approvalHeight: 260 }),
      tx('GROUP_INVITE', 300, { invitee: B, approvalHeight: 310 }),
      tx('JOIN_GROUP', 400, { creatorAddress: B, txGroupId: 0, approvalStatus: 'NOT_REQUIRED' }),
    ];
    const events = buildTimeline(rows, CTX);
    expect(events.map((e) => [e.title, e.subject, e.becameMember])).toEqual([
      ['Joined MINTER', B, true],
      ['Approved for MINTER', B, false],
      ['Approved and added to MINTER', A, true],
      ['Asked to join MINTER', A, false],
    ]);
    expect(events.map((e) => e.tone)).toEqual(['good', 'good', 'good', 'neutral']);
  });

  it('words admin changes people proposed about themselves', () => {
    const rows = [
      tx('ADD_GROUP_ADMIN', 100, { creatorAddress: A, member: A, approvalStatus: 'PENDING' }),
      tx('ADD_GROUP_ADMIN', 110, { member: B, approvalStatus: 'PENDING' }),
      tx('REMOVE_GROUP_ADMIN', 120, { creatorAddress: B, admin: B, approvalHeight: 130 }),
      tx('REMOVE_GROUP_ADMIN', 140, { admin: A, approvalHeight: 150 }),
    ];
    expect(buildTimeline(rows, CTX).map((e) => e.title)).toEqual([
      'No longer a Minter Admin',
      'Stepped down as Minter Admin',
      'Proposed: Make a Minter Admin',
      'Proposed: Become a Minter Admin',
    ]);
  });

  it('dates an approval at its approval block, from the proposal time and the block pace', () => {
    const [event] = buildTimeline(
      [tx('GROUP_INVITE', 200, { invitee: A, approvalHeight: 260 })],
      CTX
    );
    expect(event.proposedAt).toBe(1_000_000_000 + 200 * 60_000);
    expect(event.at).toBe(event.proposedAt + 60 * 60_000);
    expect(event.atHeight).toBe(260);
    expect(event.creator).toBe(ADMIN);
  });

  it('shows only approved changes as happened, the rest as proposals', () => {
    const rows = [
      tx('GROUP_INVITE', 100, { invitee: A, approvalStatus: 'EXPIRED' }),
      tx('GROUP_KICK', 200, { member: B, approvalStatus: 'PENDING', reason: 'Inactive' }),
      tx('GROUP_BAN', 300, { offender: B, approvalStatus: 'REJECTED', approvalHeight: 320 }),
      tx('ADD_GROUP_ADMIN', 400, { member: A, approvalStatus: 'INVALID' }),
    ];
    const events = buildTimeline(rows, CTX);
    // Dated when decided: the invite expired last (h + 10081), the kick is still open.
    expect(events.map((e) => [e.title, e.outcome, e.detail])).toEqual([
      [
        'Nominated for MINTER',
        'expired',
        'Not enough signatures in time. They can be nominated again.',
      ],
      ['Proposed: Ban from MINTER', 'rejected', 'Rejected by Minter Admins.'],
      ['Proposed: Remove from MINTER', 'pending', null],
    ]);
    expect(events[0].atHeight).toBe(100 + 10_081);
    expect(events[2].reason).toBe('Inactive');
    expect(events.every((e) => e.tone === 'neutral')).toBe(true);
  });

  it('names removals, bans, admin changes and leaving', () => {
    const rows = [
      tx('GROUP_INVITE', 10, { invitee: A, approvalStatus: 'NOT_REQUIRED' }),
      tx('JOIN_GROUP', 20, { creatorAddress: A, txGroupId: 0, approvalStatus: 'NOT_REQUIRED' }),
      tx('ADD_GROUP_ADMIN', 30, { member: A, approvalHeight: 40 }),
      tx('REMOVE_GROUP_ADMIN', 50, { admin: A, approvalHeight: 60 }),
      tx('GROUP_KICK', 70, { member: A, approvalHeight: 80, reason: 'Gone quiet' }),
      tx('GROUP_BAN', 90, { offender: A, approvalHeight: 95, timeToLive: 3 * 86_400 }),
      tx('CANCEL_GROUP_BAN', 100, { member: A, approvalHeight: 105 }),
      tx('GROUP_BAN', 110, { offender: B, approvalHeight: 115, timeToLive: 0 }),
      tx('LEAVE_GROUP', 120, { creatorAddress: B, txGroupId: 0, approvalStatus: 'NOT_REQUIRED' }),
    ];
    const events = buildTimeline(rows, CTX);
    expect(events.map((e) => [e.title, e.detail, e.tone])).toEqual([
      ['Left MINTER', null, 'bad'],
      ['Banned from MINTER', 'Permanent', 'bad'],
      ['Ban lifted', null, 'good'],
      ['Banned from MINTER', 'For 3 days', 'bad'],
      ['Removed from MINTER', null, 'bad'],
      ['No longer a Minter Admin', null, 'bad'],
      ['Made a Minter Admin', null, 'good'],
      ['Joined MINTER', null, 'good'],
      ['Invited to MINTER', null, 'good'],
    ]);
    expect(memberSince(events, A)).toBeNull();
  });

  it('leaves out approvals, other groups and duplicates', () => {
    const invite = tx('GROUP_INVITE', 10, { invitee: A });
    const rows = [
      invite,
      invite,
      tx('GROUP_APPROVAL', 11, { txGroupId: 0, groupId: undefined, pendingSignature: 'x' }),
      tx('GROUP_INVITE', 12, { invitee: B, groupId: 1, txGroupId: 1 }),
    ];
    expect(buildTimeline(rows, CTX).map((e) => e.signature)).toEqual([invite.signature]);
  });

  it('knows when a membership started, and what an admin proposed for others', () => {
    const rows = [
      tx('GROUP_INVITE', 10, { invitee: A, approvalHeight: 20 }),
      tx('JOIN_GROUP', 30, { creatorAddress: A, txGroupId: 0, approvalStatus: 'NOT_REQUIRED' }),
      tx('GROUP_KICK', 40, { member: A, approvalHeight: 50 }),
      tx('GROUP_INVITE', 60, { invitee: A, approvalHeight: 70 }),
      tx('JOIN_GROUP', 80, { creatorAddress: A, txGroupId: 0, approvalStatus: 'NOT_REQUIRED' }),
      tx('GROUP_INVITE', 90, { invitee: B, creatorAddress: A, approvalHeight: 99 }),
      tx('GROUP_KICK', 100, { member: B, creatorAddress: A, approvalStatus: 'EXPIRED' }),
    ];
    const events = buildTimeline(rows, CTX);
    const joined = events.find((e) => e.signature === rows[4].signature);
    expect(memberSince(events, A)).toBe(joined?.at);
    expect(eventsAbout(events, A)).toHaveLength(5);
    expect(proposalsBy(events, A).map((e) => e.title)).toEqual([
      'Proposed: Remove from MINTER',
      'Approved for MINTER',
    ]);
  });

  it('fills in the invitee of a cancelled invite in their own history', () => {
    const cancel = tx('CANCEL_GROUP_INVITE', 10, { creatorAddress: ADMIN });
    const own = tx('CANCEL_GROUP_INVITE', 11, { creatorAddress: A });
    const filled = withOwnSubject([cancel, own], A);
    expect(filled[0].invitee).toBe(A);
    expect(filled[1].invitee).toBeUndefined();
    expect(buildTimeline(filled, CTX)[1]).toMatchObject({
      title: 'Approved invite cancelled',
      subject: A,
    });
  });

  it('says how long a ban lasts', () => {
    expect(banLength(0)).toBe('Permanent');
    expect(banLength(24 * 86_400)).toBe('For 24 days');
    expect(banLength(3_600)).toBe('For 1 hour');
  });
});

describe('timeline from the mock node', () => {
  it('reads a kicked member’s history: approved, then removed', async () => {
    installWorld('kicked');
    const { rows } = await getAddressHistory(ADDR.kicked);
    const events = eventsAbout(
      buildTimeline(withOwnSubject(rows, ADDR.kicked), {
        msPerBlock: MS_PER_BLOCK,
        maximumBlockDelay: 10_080,
      }),
      ADDR.kicked
    );
    expect(events.map((e) => [e.title, e.reason])).toEqual([
      ['Removed from MINTER', 'Kicked by Minter Admins'],
      ['Approved for MINTER', null],
    ]);
  });

  it('reads the group by 30-day windows of blocks, never unbounded', async () => {
    installWorld('learner');
    const anchor = { height: TIP, timestamp: NOW };
    const first = await loadHistoryWindow(anchor, 0);
    const blocks30 = Math.ceil((30 * 86_400_000) / MS_PER_BLOCK);
    expect(first.endHeight).toBe(TIP);
    expect(first.startHeight).toBe(TIP - blocks30 + 1);
    const events = buildTimeline(first.rows, {
      msPerBlock: MS_PER_BLOCK,
      maximumBlockDelay: 10_080,
    });
    const titleFor = (address: string) => events.find((e) => e.subject === address)?.title;
    expect(titleFor(ADDR.left)).toBe('Left MINTER');
    expect(titleFor(ADDR.recentlyJoined)).toBe('Approved for MINTER');
    expect(titleFor(ADDR.expired)).toBe('Nominated for MINTER');
    expect(titleFor(ADDR.kicked)).toBeUndefined();

    const second = await loadHistoryWindow(anchor, 1);
    expect(second.endHeight).toBe(first.startHeight - 1);
    expect(buildTimeline(second.rows, CTX).find((e) => e.subject === ADDR.kicked)?.title).toBe(
      'Removed from MINTER'
    );

    for (const path of fetchCallsFor('/transactions/search')) {
      const params = new URL(path, 'http://x').searchParams;
      expect(Number(params.get('limit'))).toBeGreaterThan(0);
      expect(Number(params.get('blockLimit'))).toBeGreaterThan(0);
      expect(Number(params.get('startBlock'))).toBeGreaterThan(0);
    }
  });
});
