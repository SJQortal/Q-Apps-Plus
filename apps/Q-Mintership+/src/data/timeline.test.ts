import { describe, expect, it } from 'vitest';
import { fetchCallsFor } from '../test/setup';
import { ADDR, MS_PER_BLOCK, NOW, TIP, installWorld } from '../test/world';
import { DECLINED, addDecline } from '../../e2e/world.mjs';
import { getAddressHistory } from './txs';
import {
  banLength,
  buildTimeline,
  eventsAbout,
  loadHistoryWindow,
  memberSince,
  proposalsBy,
  targetStepDetail,
  withOwnSubject,
  withTargetSteps,
} from './timeline';
import { approvedAdminChanges, targetSteps } from '../rules/targetShift';
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
      ['Proposed: Ban from MINTER', 'rejected', 'Enough Minter Admins rejected it.'],
      ['Proposed: Remove from MINTER', 'pending', null],
    ]);
    expect(events[0].atHeight).toBe(100 + 10_081);
    expect(events[2].reason).toBe('Inactive');
    expect(events.every((e) => e.tone === 'neutral')).toBe(true);
  });

  it('dates a rejected nomination when Core ended it, and says it can come again', () => {
    const events = buildTimeline(
      [tx('GROUP_INVITE', 500, { invitee: A, approvalStatus: 'REJECTED', approvalHeight: 530 })],
      CTX
    );
    expect(events.map((e) => [e.title, e.outcome, e.detail, e.atHeight])).toEqual([
      [
        'Nominated for MINTER',
        'rejected',
        'Enough Minter Admins rejected it. They can be nominated again.',
        530,
      ],
    ]);
    expect(events[0].becameMember).toBe(false);
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

  it('a kick of someone who asked to join and isn’t a member declined their join request', () => {
    const join = (h: number) =>
      tx('JOIN_GROUP', h, { creatorAddress: A, txGroupId: 0, approvalStatus: 'NOT_REQUIRED' });
    const rows = [
      // A was a member once, removed, asked again and was declined; asked again since.
      tx('GROUP_INVITE', 10, { invitee: A, approvalHeight: 20 }),
      join(30),
      tx('GROUP_KICK', 40, { member: A, approvalHeight: 50 }),
      join(60),
      tx('GROUP_KICK', 70, { member: A, approvalHeight: 80, reason: 'No node' }),
      join(90),
      // A decline proposed while A was asking, that ran out.
      tx('GROUP_KICK', 100, { member: A, approvalStatus: 'EXPIRED' }),
    ];
    const events = buildTimeline(rows, CTX);
    expect(events.map((e) => [e.title, e.tone, e.endedMembership])).toEqual([
      ['Proposed: Decline a join request', 'neutral', false],
      ['Asked to join MINTER', 'neutral', false],
      ['Join request declined', 'neutral', false],
      ['Asked to join MINTER', 'neutral', false],
      ['Removed from MINTER', 'bad', true],
      ['Joined MINTER', 'good', false],
      ['Approved for MINTER', 'good', false],
    ]);
    expect(events.find((e) => e.title === 'Join request declined')?.reason).toBe('No node');
  });

  it('a former member whose joining isn’t in the rows asks again, and is declined', () => {
    const rows = [
      tx('GROUP_INVITE', 10, { invitee: A, approvalHeight: 20 }),
      tx('GROUP_KICK', 40, { member: A, approvalHeight: 50 }),
      tx('JOIN_GROUP', 60, { creatorAddress: A, txGroupId: 0, approvalStatus: 'NOT_REQUIRED' }),
      tx('GROUP_KICK', 70, { member: A, approvalHeight: 80 }),
    ];
    expect(buildTimeline(rows, CTX).map((e) => e.title)).toEqual([
      'Join request declined',
      'Asked to join MINTER',
      'Removed from MINTER',
      'Approved for MINTER',
    ]);
  });

  it('trusts a kick marked from the person’s own history over the rows in hand', () => {
    const declined = {
      ...tx('GROUP_KICK', 70, { member: A, approvalHeight: 80 }),
      declinesJoinRequest: true,
    };
    const removed = {
      ...tx('GROUP_KICK', 70, { member: B, approvalHeight: 80 }),
      declinesJoinRequest: false,
    };
    const asked = tx('JOIN_GROUP', 60, {
      creatorAddress: B,
      txGroupId: 0,
      approvalStatus: 'NOT_REQUIRED',
    });
    const titleOf = (rows: TxRow[], who: string) =>
      buildTimeline(rows, CTX).find((e) => e.subject === who && e.kind === 'kick')?.title;
    expect(titleOf([declined], A)).toBe('Join request declined');
    expect(titleOf([asked, removed], B)).toBe('Removed from MINTER');
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
      // A kicked person's own history (a declined join request?) is paged by address.
      if (params.get('address')) continue;
      expect(Number(params.get('blockLimit'))).toBeGreaterThan(0);
      expect(Number(params.get('startBlock'))).toBeGreaterThan(0);
    }
  });
});

describe('withTargetSteps: what an approved admin change did to the target', () => {
  const rows = [
    tx('ADD_GROUP_ADMIN', 100, {
      member: A,
      creatorAddress: ADMIN,
      approvalStatus: 'APPROVED',
      approvalHeight: 110,
    }),
    tx('REMOVE_GROUP_ADMIN', 200, {
      admin: B,
      creatorAddress: ADMIN,
      approvalStatus: 'APPROVED',
      approvalHeight: 210,
    }),
    tx('REMOVE_GROUP_ADMIN', 300, { admin: A, creatorAddress: ADMIN, approvalStatus: 'EXPIRED' }),
    tx('GROUP_KICK', 400, {
      member: B,
      creatorAddress: ADMIN,
      approvalStatus: 'APPROVED',
      approvalHeight: 410,
    }),
  ];

  it('adds the target before and after to approved admin changes only', () => {
    const steps = targetSteps(approvedAdminChanges(rows), 20, 'PCT40');
    const events = withTargetSteps(buildTimeline(rows, CTX), steps);
    const detail = (kind: string, outcome = 'done') =>
      events.find((e) => e.kind === kind && e.outcome === outcome)?.detail;
    // 20 now; before the removal 21 (9 needed); before the addition 20.
    expect(detail('removeAdmin')).toBe('Target 9 → 8 signatures (21 → 20 admin seats)');
    expect(detail('addAdmin')).toBe('Target 8 → 9 signatures (20 → 21 admin seats)');
    expect(detail('removeAdmin', 'expired')).toBeNull();
    expect(detail('kick')).toBeNull();
  });

  it('says when only the admin seats moved', () => {
    expect(
      targetStepDetail({
        address: A,
        added: false,
        height: 1,
        countBefore: 20,
        countAfter: 19,
        neededBefore: 8,
        neededAfter: 8,
      })
    ).toBe('Admin seats 20 → 19; the target stayed at 8 signatures');
  });

  it('leaves the events alone without steps', () => {
    const events = buildTimeline(rows, CTX);
    expect(withTargetSteps(events, [])).toBe(events);
  });
});

describe('History: declined join requests', () => {
  it('reads each kicked person’s own history, so a decline whose join request is older says so', async () => {
    const { world } = installWorld('learner');
    const { waiting } = addDecline(world);
    const anchor = { height: TIP, timestamp: NOW };
    const first = await loadHistoryWindow(anchor, 0);
    // Dee's join request is months older than the window.
    expect(
      first.rows.some((r) => r.type === 'JOIN_GROUP' && r.creatorAddress === DECLINED.address)
    ).toBe(false);
    const events = buildTimeline(first.rows, {
      msPerBlock: MS_PER_BLOCK,
      maximumBlockDelay: 10_080,
    });
    const about = (who: string) => events.find((e) => e.subject === who && e.kind === 'kick');
    expect(about(DECLINED.address)).toMatchObject({
      title: 'Join request declined',
      tone: 'neutral',
      reason: 'No node, and no answer in the chat',
    });
    expect(about(waiting.subject)?.title).toBe('Proposed: Decline a join request');
    // One history read per kicked person, paged.
    expect(fetchCallsFor(`/transactions/search?address=${DECLINED.address}`)).toHaveLength(1);
    expect(fetchCallsFor(`/transactions/search?address=${waiting.subject}`)).toHaveLength(1);
  });
});
