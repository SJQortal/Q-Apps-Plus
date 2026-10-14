import { describe, expect, it } from 'vitest';
import type { TxRow } from '../data/types';
import {
  adminChanges,
  computeActivity,
  computePulse,
  decisionSpan,
  expiredDoubles,
  levelSpread,
  median,
  sortActivity,
  tenureOf,
  type ActivityInput,
  type AdminActivity,
} from './activity';

const MAX = 10_080;
const S = 100_000; // window start
const E = 200_000; // window end (= tip unless a test says otherwise)

function decision(
  signature: string,
  h: number,
  status: TxRow['approvalStatus'],
  approvalHeight?: number,
  extra: Partial<TxRow> = {}
): TxRow {
  return {
    type: 'GROUP_INVITE',
    timestamp: h * 1000,
    signature,
    txGroupId: 694,
    groupId: 694,
    blockHeight: h,
    approvalStatus: status,
    ...(approvalHeight === undefined ? {} : { approvalHeight }),
    creatorAddress: 'Qcreator',
    invitee: `Qinvitee-${signature}`,
    ...extra,
  };
}

function approval(
  admin: string,
  pendingSignature: string,
  block: number,
  approve = true,
  timestamp = block * 1000 + 1
): TxRow {
  return {
    type: 'GROUP_APPROVAL',
    timestamp,
    signature: `A-${admin}-${pendingSignature}-${block}-${approve}`,
    txGroupId: 0,
    blockHeight: block,
    approvalStatus: 'NOT_REQUIRED',
    creatorAddress: admin,
    adminPublicKey: `pk-${admin}`,
    pendingSignature,
    approval: approve,
  };
}

function run(partial: Partial<ActivityInput>) {
  return computeActivity({
    range: { startBlock: S, endBlock: E },
    tipHeight: E,
    maxDelay: MAX,
    decisions: [],
    approvals: [],
    currentAdmins: ['Qa', 'Qb'],
    ...partial,
  });
}

function admin(report: ReturnType<typeof run>, address: string): AdminActivity {
  const found = [...report.current, ...report.former].find((a) => a.address === address);
  if (!found) throw new Error(`${address} not in the report`);
  return found;
}

describe('decisionSpan', () => {
  it('ends the signing stretch the block before an approval', () => {
    const span = decisionSpan(decision('d', 1000, 'APPROVED', 1500), MAX, E);
    expect(span).toMatchObject({
      outcome: 'approved',
      decidedHeight: 1500,
      lastSignatureHeight: 1499,
    });
  });

  it('uses Core’s approvalHeight for an expired decision, or h + max + 1 without it', () => {
    expect(decisionSpan(decision('d', 1000, 'EXPIRED', 11_081), MAX, E)).toMatchObject({
      outcome: 'expired',
      decidedHeight: 11_081,
      lastSignatureHeight: 11_079,
    });
    expect(decisionSpan(decision('d', 1000, 'EXPIRED'), MAX, E)?.decidedHeight).toBe(11_081);
  });

  it('treats a stale PENDING read past its expiry block as expired', () => {
    expect(decisionSpan(decision('d', 1000, 'PENDING'), MAX, 11_081)?.outcome).toBe('expired');
    expect(decisionSpan(decision('d', 1000, 'PENDING'), MAX, 11_080)?.outcome).toBe('pending');
  });

  it('skips unconfirmed rows and rows that needed no approval', () => {
    const unconfirmed = { ...decision('d', 1, 'PENDING'), blockHeight: undefined };
    expect(decisionSpan(unconfirmed, MAX, E)).toBeNull();
    expect(decisionSpan(decision('d', 1000, 'NOT_REQUIRED'), MAX, E)).toBeNull();
  });

  it('knows who a decision is about and who proposed it', () => {
    const span = decisionSpan(
      decision('k', 1000, 'APPROVED', 1100, {
        type: 'GROUP_KICK',
        member: 'Qkicked',
        invitee: undefined,
        creatorAddress: 'Qa',
      }),
      MAX,
      E
    );
    expect(span).toMatchObject({ kind: 'kick', subject: 'Qkicked', creator: 'Qa' });
  });
});

describe('tenureOf', () => {
  const changes = adminChanges([
    decision('add-c', 150_000, 'APPROVED', 150_500, {
      type: 'ADD_GROUP_ADMIN',
      member: 'Qc',
      invitee: undefined,
    }),
    decision('rm-d', 160_000, 'APPROVED', 160_400, {
      type: 'REMOVE_GROUP_ADMIN',
      admin: 'Qd',
      invitee: undefined,
    }),
    decision('add-e-expired', 150_000, 'EXPIRED', 160_081, {
      type: 'ADD_GROUP_ADMIN',
      member: 'Qe',
      invitee: undefined,
    }),
  ]);

  it('reads only approved admin changes', () => {
    expect(changes).toEqual([
      { address: 'Qc', added: true, height: 150_500 },
      { address: 'Qd', added: false, height: 160_400 },
    ]);
  });

  it('starts at the approval block of an add', () => {
    expect(tenureOf('Qc', changes, true)).toEqual([[150_500, Infinity]]);
  });

  it('ends the block before a removal, and was an admin before it', () => {
    expect(tenureOf('Qd', changes, false)).toEqual([[-Infinity, 160_399]]);
  });

  it('is the whole time for a current admin with no change on record', () => {
    expect(tenureOf('Qa', changes, true)).toEqual([[-Infinity, Infinity]]);
  });

  it('ends at the last signature for someone who stopped being an admin some other way', () => {
    expect(tenureOf('Qz', changes, false, 123_456)).toEqual([[-Infinity, 123_456]]);
    expect(tenureOf('Qz', changes, false, null)).toEqual([]);
  });

  it('handles removed and added again', () => {
    const again = [
      { address: 'Qr', added: false, height: 120_000 },
      { address: 'Qr', added: true, height: 180_000 },
    ];
    expect(tenureOf('Qr', again, true)).toEqual([
      [-Infinity, 119_999],
      [180_000, Infinity],
    ]);
  });
});

describe('computeActivity', () => {
  it('counts answers against the decisions an admin could have answered', () => {
    const decisions = [
      decision('d1', 120_000, 'APPROVED', 121_000),
      decision('d2', 130_000, 'APPROVED', 131_000),
      decision('d3', 140_000, 'APPROVED', 141_000),
    ];
    const approvals = [approval('Qa', 'd1', 120_100), approval('Qa', 'd2', 130_300)];
    const a = admin(run({ decisions, approvals }), 'Qa');
    expect(a).toMatchObject({ eligible: 3, answered: 2, signed: 2, missed: 0, rejected: 0 });
    expect(a.participation).toBeCloseTo(2 / 3);
    expect(admin(run({ decisions, approvals }), 'Qb')).toMatchObject({
      eligible: 3,
      answered: 0,
      signed: 0,
      missed: 0,
      participation: 0,
    });
  });

  it('counts a rejection as taking part; a miss is one that expired with no answer', () => {
    const decisions = [
      decision('signed', 120_000, 'APPROVED', 121_000),
      decision('rejected', 130_000, 'EXPIRED', 140_081),
      decision('nothing', 150_000, 'EXPIRED', 160_081),
      decision('nothing-approved', 170_000, 'APPROVED', 171_000),
    ];
    const approvals = [
      approval('Qa', 'signed', 120_100),
      approval('Qa', 'rejected', 130_100, false),
      approval('Qb', 'signed', 120_200),
      approval('Qb', 'rejected', 130_200),
      approval('Qb', 'nothing', 150_200),
      approval('Qb', 'nothing-approved', 170_200, false),
    ];
    const report = run({ decisions, approvals });
    const a = admin(report, 'Qa');
    // Two answers of four. Of the two they did nothing on, the expired one is a miss; the
    // one that passed without them isn't.
    expect(a).toMatchObject({ eligible: 4, answered: 2, signed: 1, rejected: 1, missed: 1 });
    expect(a.participation).toBe(0.5);
    // Three signatures and a rejection: every decision answered.
    expect(admin(report, 'Qb')).toMatchObject({
      eligible: 4,
      answered: 4,
      signed: 3,
      rejected: 1,
      missed: 0,
      participation: 1,
    });
  });

  it('takes the median blocks to sign, leaving out the admin’s own proposals', () => {
    const decisions = [
      decision('d1', 120_000, 'APPROVED', 125_000),
      decision('d2', 130_000, 'APPROVED', 135_000),
      decision('d3', 140_000, 'APPROVED', 145_000),
      decision('own', 150_000, 'APPROVED', 155_000, { creatorAddress: 'Qa' }),
    ];
    const approvals = [
      approval('Qa', 'd1', 120_010),
      approval('Qa', 'd2', 130_030),
      approval('Qa', 'd3', 140_050),
      approval('Qa', 'own', 150_001),
      approval('Qb', 'd1', 120_100),
      approval('Qb', 'd2', 130_300),
    ];
    const report = run({ decisions, approvals });
    expect(admin(report, 'Qa')).toMatchObject({ signed: 4, medianBlocksToSign: 30, proposed: 1 });
    expect(admin(report, 'Qb').medianBlocksToSign).toBe(200);
    expect(median([])).toBeNull();
  });

  it('judges an admin added mid-window only from their start', () => {
    const decisions = [
      decision('before', 110_000, 'APPROVED', 111_000),
      decision('add-c', 140_000, 'APPROVED', 150_000, {
        type: 'ADD_GROUP_ADMIN',
        member: 'Qc',
        invitee: undefined,
      }),
      decision('straddles', 145_000, 'EXPIRED', 155_081),
      decision('after', 160_000, 'APPROVED', 161_000),
    ];
    const report = run({ decisions, currentAdmins: ['Qa', 'Qb', 'Qc'] });
    const c = admin(report, 'Qc');
    expect(c.adminSince).toBe(150_000);
    // 'before' and the add itself closed before Qc was an admin.
    expect(c).toMatchObject({ eligible: 2, missed: 1, signed: 0, current: true });
    expect(admin(report, 'Qa').eligible).toBe(4);
    expect(admin(report, 'Qa').adminSince).toBeNull();
  });

  it('uses admin changes approved after a past window to say who was an admin in it', () => {
    const decisions = [decision('exp', 120_000, 'EXPIRED', 130_081)];
    const later = [
      // Qc became an admin after the window; Qa was removed after it and added again.
      decision('add-c', 210_000, 'APPROVED', 211_000, {
        type: 'ADD_GROUP_ADMIN',
        member: 'Qc',
        invitee: undefined,
      }),
      decision('rm-a', 212_000, 'APPROVED', 213_000, {
        type: 'REMOVE_GROUP_ADMIN',
        admin: 'Qa',
        invitee: undefined,
      }),
      decision('add-a', 214_000, 'APPROVED', 215_000, {
        type: 'ADD_GROUP_ADMIN',
        member: 'Qa',
        invitee: undefined,
      }),
    ];
    const report = run({
      decisions,
      adminChangeRows: later,
      tipHeight: 220_000,
      currentAdmins: ['Qa', 'Qc'],
    });
    // Qc wasn't an admin yet: nothing eligible, nothing missed.
    expect(admin(report, 'Qc')).toMatchObject({ adminSince: 211_000, eligible: 0, missed: 0 });
    // Qa was an admin all through the window, so the expired one is their miss.
    expect(admin(report, 'Qa')).toMatchObject({ eligible: 1, missed: 1 });
  });

  it('lists an admin removed mid-window under former admins, judged until the removal', () => {
    const decisions = [
      decision('d1', 120_000, 'APPROVED', 121_000),
      decision('rm-d', 125_000, 'APPROVED', 130_000, {
        type: 'REMOVE_GROUP_ADMIN',
        admin: 'Qd',
        invitee: undefined,
        creatorAddress: 'Qa',
      }),
      // Expires after Qd was removed: not their miss.
      decision('d2', 128_000, 'EXPIRED', 138_081),
      decision('d3', 150_000, 'APPROVED', 151_000),
    ];
    const approvals = [approval('Qd', 'd1', 120_500)];
    const report = run({ decisions, approvals });
    expect(report.current.map((a) => a.address).sort()).toEqual(['Qa', 'Qb']);
    expect(report.former.map((a) => a.address)).toEqual(['Qd']);
    const d = admin(report, 'Qd');
    expect(d).toMatchObject({ current: false, removedAt: 130_000, signed: 1, missed: 0 });
    // d1, the removal itself and d2 were waiting while Qd was an admin; d3 wasn't.
    expect(d.eligible).toBe(3);
    expect(admin(report, 'Qa').proposedByKind).toEqual({ removeAdmin: 1 });
  });

  it('leaves out admins removed before the window', () => {
    const decisions = [
      decision('rm-d', 50_000, 'APPROVED', 60_000, {
        type: 'REMOVE_GROUP_ADMIN',
        admin: 'Qd',
        invitee: undefined,
      }),
    ];
    const report = run({ decisions, approvals: [approval('Qd', 'rm-d', 55_000)] });
    expect(report.former).toEqual([]);
  });

  it('lists someone who signed in the window but is no longer an admin, up to their last signature', () => {
    const decisions = [
      decision('d1', 120_000, 'APPROVED', 121_000),
      decision('d2', 170_000, 'APPROVED', 171_000),
    ];
    const report = run({ decisions, approvals: [approval('Qleft', 'd1', 120_200)] });
    expect(admin(report, 'Qleft')).toMatchObject({
      current: false,
      removedAt: null,
      eligible: 1,
      signed: 1,
    });
  });

  it('counts rejections apart from signatures, and as taking part', () => {
    const decisions = [decision('exp', 120_000, 'EXPIRED', 130_081)];
    const report = run({ decisions, approvals: [approval('Qa', 'exp', 121_000, false)] });
    expect(admin(report, 'Qa')).toMatchObject({
      eligible: 1,
      answered: 1,
      signed: 0,
      rejected: 1,
      missed: 0,
      participation: 1,
    });
  });

  it('a rejection or a withdrawal is an answer: it counts on a decision still waiting, and is never a miss', () => {
    const decisions = [
      decision('open', 195_000, 'PENDING'),
      decision('ended', 120_000, 'REJECTED', 121_000),
      decision('withdrawn', 140_000, 'EXPIRED', 150_081),
    ];
    const approvals = [
      approval('Qa', 'open', 195_100, false),
      approval('Qa', 'ended', 120_100, false),
      // Signed, then withdrew the signature: a rejection, not a signature and not a miss.
      approval('Qa', 'withdrawn', 140_100, true),
      approval('Qa', 'withdrawn', 140_300, false),
    ];
    const report = run({ decisions, approvals });
    expect(admin(report, 'Qa')).toMatchObject({
      eligible: 3,
      answered: 3,
      signed: 0,
      rejected: 3,
      missed: 0,
      participation: 1,
    });
    // Qb answered none: only the expired one is a miss, and the open one isn't yet.
    expect(admin(report, 'Qb')).toMatchObject({ eligible: 2, missed: 1, rejected: 0 });
  });

  it('ignores approvals of other groups’ transactions', () => {
    const decisions = [decision('d1', 120_000, 'APPROVED', 121_000)];
    const approvals = [approval('Qa', 'someone-elses-tx', 120_100), approval('Qb', 'd1', 120_200)];
    const report = run({ decisions, approvals });
    expect(report.ignoredApprovals).toBe(1);
    expect(admin(report, 'Qa')).toMatchObject({ signed: 0, lastActiveHeight: null });
    expect(admin(report, 'Qb').signed).toBe(1);
  });

  it('counts only each admin’s latest approval on a decision', () => {
    const decisions = [
      decision('flip-to-no', 120_000, 'EXPIRED', 130_081),
      decision('flip-to-yes', 140_000, 'EXPIRED', 150_081),
      decision('twice', 160_000, 'APPROVED', 165_000),
    ];
    const approvals = [
      approval('Qa', 'flip-to-no', 120_100, true),
      approval('Qa', 'flip-to-no', 120_200, false),
      approval('Qa', 'flip-to-yes', 140_100, false),
      approval('Qa', 'flip-to-yes', 140_200, true),
      approval('Qa', 'twice', 160_100, true),
      approval('Qa', 'twice', 160_300, true),
    ];
    const a = admin(run({ decisions, approvals }), 'Qa');
    expect(a).toMatchObject({ eligible: 3, signed: 2, rejected: 1, missed: 0 });
  });

  it('breaks a timestamp tie the way Core does, not by list order', () => {
    const decisions = [decision('tie', 120_000, 'EXPIRED', 130_081)];
    const yes = { ...approval('Qa', 'tie', 120_100, true, 5), signature: '2' };
    const no = { ...approval('Qa', 'tie', 120_100, false, 5), signature: '3' };
    expect(admin(run({ decisions, approvals: [yes, no] }), 'Qa').rejected).toBe(1);
    expect(admin(run({ decisions, approvals: [no, yes] }), 'Qa').rejected).toBe(1);
  });

  it('does not count a signature that landed after the last useful block', () => {
    const decisions = [decision('late', 120_000, 'EXPIRED', 130_081)];
    const approvals = [approval('Qa', 'late', 130_080)];
    const a = admin(run({ decisions, approvals }), 'Qa');
    expect(a).toMatchObject({ signed: 0, missed: 1, lastActiveHeight: 130_080 });
  });

  it('counts a decision still waiting only once the admin has signed it', () => {
    const decisions = [decision('open', 195_000, 'PENDING')];
    const report = run({ decisions, approvals: [approval('Qa', 'open', 195_100)] });
    expect(admin(report, 'Qa')).toMatchObject({ eligible: 1, signed: 1, participation: 1 });
    expect(admin(report, 'Qb')).toMatchObject({ eligible: 0, missed: 0, participation: null });
  });

  it('only counts decisions that were waiting during the window', () => {
    const decisions = [
      decision('long-ago', 10_000, 'APPROVED', 11_000),
      // Confirmed before the window, still waiting at its start.
      decision('carried-in', 95_000, 'EXPIRED', 105_081),
      decision('after-end', 210_000, 'APPROVED', 211_000),
    ];
    const report = run({ decisions, tipHeight: 220_000 });
    expect(report.decisionCount).toBe(1);
    expect(admin(report, 'Qa')).toMatchObject({ eligible: 1, missed: 1 });
  });

  it('counts proposals made in the window by kind, and finds the newest activity', () => {
    const decisions = [
      decision('old', 90_000, 'APPROVED', 91_000, { creatorAddress: 'Qa' }),
      decision('i1', 120_000, 'APPROVED', 121_000, { creatorAddress: 'Qa' }),
      decision('k1', 130_000, 'EXPIRED', 140_081, {
        type: 'GROUP_KICK',
        member: 'Qm',
        invitee: undefined,
        creatorAddress: 'Qa',
      }),
    ];
    const approvals = [approval('Qa', 'i1', 120_001), approval('Qa', 'k1', 130_001)];
    const a = admin(run({ decisions, approvals }), 'Qa');
    expect(a.proposed).toBe(2);
    expect(a.proposedByKind).toEqual({ invite: 1, kick: 1 });
    expect(a.lastActiveHeight).toBe(130_001);
  });

  it('never lists excluded accounts such as the null owner', () => {
    const report = run({ currentAdmins: ['Qa', 'Qnull'], exclude: ['Qnull'] });
    expect(report.current.map((a) => a.address)).toEqual(['Qa']);
  });

  it('counts both stretches of an admin removed and made an admin again', () => {
    const decisions = [
      decision('d1', 110_000, 'APPROVED', 111_000),
      decision('rm-r', 115_000, 'APPROVED', 120_000, {
        type: 'REMOVE_GROUP_ADMIN',
        admin: 'Qr',
        invitee: undefined,
      }),
      decision('away', 130_000, 'APPROVED', 131_000),
      decision('add-r', 140_000, 'APPROVED', 150_000, {
        type: 'ADD_GROUP_ADMIN',
        member: 'Qr',
        invitee: undefined,
      }),
      decision('d2', 160_000, 'APPROVED', 161_000),
    ];
    const r = admin(run({ decisions, currentAdmins: ['Qa', 'Qr'] }), 'Qr');
    // d1 and its own removal before; d2 after; not 'away' or the add itself.
    expect(r).toMatchObject({ current: true, adminSince: 150_000, adminAgain: true, eligible: 3 });
    expect(admin(run({ decisions, currentAdmins: ['Qa', 'Qr'] }), 'Qa').adminAgain).toBe(false);
  });
});

describe('doubles that expired', () => {
  const addAdmin = (
    signature: string,
    h: number,
    status: TxRow['approvalStatus'],
    approvalHeight: number,
    member: string,
    extra: Partial<TxRow> = {}
  ) =>
    decision(signature, h, status, approvalHeight, {
      type: 'ADD_GROUP_ADMIN',
      member,
      invitee: undefined,
      ...extra,
    });
  const removeAdmin = (
    signature: string,
    h: number,
    status: TxRow['approvalStatus'],
    approvalHeight: number,
    who: string
  ) =>
    decision(signature, h, status, approvalHeight, {
      type: 'REMOVE_GROUP_ADMIN',
      admin: who,
      invitee: undefined,
    });

  it('an addition of someone already a Minter Admin is neither eligible nor a miss when left alone', () => {
    const decisions = [
      addAdmin('c-first', 118_000, 'APPROVED', 120_000, 'Qc'),
      // Confirmed after the first one made Qc a Minter Admin.
      addAdmin('c-again', 121_000, 'EXPIRED', 131_081, 'Qc'),
      decision('invite', 140_000, 'EXPIRED', 150_081),
    ];
    const approvals = [approval('Qa', 'c-again', 121_100)];
    const report = run({ decisions, approvals, currentAdmins: ['Qa', 'Qb', 'Qc'] });
    // Qb left both expired ones alone: only the invite is a miss.
    expect(admin(report, 'Qb')).toMatchObject({ eligible: 2, answered: 0, missed: 1 });
    // A signature on the double still counts.
    expect(admin(report, 'Qa')).toMatchObject({ eligible: 3, signed: 1, missed: 1 });
  });

  it('the real case: a second "Become a Minter Admin" that kept waiting after the first passed', () => {
    const decisions = [
      addAdmin('first', 120_000, 'APPROVED', 124_000, 'Qm', { creatorAddress: 'Qm' }),
      addAdmin('second', 120_050, 'EXPIRED', 130_131, 'Qm', { creatorAddress: 'Qm' }),
    ];
    const report = run({ decisions, currentAdmins: ['Qa', 'Qb', 'Qm'] });
    // The first one passed without Qb; the second one ran out as the app said it would.
    expect(admin(report, 'Qb')).toMatchObject({ eligible: 1, missed: 0 });
    // Qm wasn't an admin while the first one waited, and the second one counts for no one.
    expect(admin(report, 'Qm')).toMatchObject({ eligible: 0, missed: 0, proposed: 2 });
  });

  it('an addition is a miss when they became a Minter Admin only after its last useful block', () => {
    const decisions = [
      addAdmin('d-early', 120_000, 'EXPIRED', 130_081, 'Qd'),
      addAdmin('d-later', 135_000, 'APPROVED', 136_000, 'Qd'),
    ];
    const report = run({ decisions, currentAdmins: ['Qa', 'Qb', 'Qd'] });
    expect(admin(report, 'Qb')).toMatchObject({ eligible: 2, missed: 1 });
  });

  it('a removal of someone who isn’t a Minter Admin is neither eligible nor a miss when left alone', () => {
    const decisions = [
      removeAdmin('rm-e', 120_000, 'APPROVED', 121_000, 'Qe'),
      // Confirmed after Qe's removal: there's nothing to remove.
      removeAdmin('rm-e-again', 125_000, 'EXPIRED', 135_081, 'Qe'),
      // A real removal that expired is a miss as usual.
      removeAdmin('rm-f', 140_000, 'EXPIRED', 150_081, 'Qf'),
    ];
    const approvals = [approval('Qa', 'rm-e-again', 125_100, false)];
    const report = run({ decisions, approvals, currentAdmins: ['Qa', 'Qb', 'Qf'] });
    expect(admin(report, 'Qb')).toMatchObject({ eligible: 2, missed: 1 });
    // A rejection of the double is an answer, as on any decision.
    expect(admin(report, 'Qa')).toMatchObject({
      eligible: 3,
      answered: 1,
      rejected: 1,
      missed: 1,
    });
  });

  it('a later copy confirmed while an earlier one could still pass is the double; the earlier one counts', () => {
    const decisions = [
      addAdmin('g-first', 120_000, 'EXPIRED', 130_081, 'Qg'),
      addAdmin('g-again', 125_000, 'EXPIRED', 135_081, 'Qg'),
      // Confirmed after both ran out: judged on its own.
      addAdmin('g-after', 140_000, 'EXPIRED', 150_081, 'Qg'),
    ];
    const approvals = [approval('Qa', 'g-again', 125_100)];
    const report = run({ decisions, approvals });
    expect(admin(report, 'Qb')).toMatchObject({ eligible: 2, missed: 2 });
    expect(admin(report, 'Qa')).toMatchObject({ eligible: 3, signed: 1, missed: 2 });
  });

  it('a copy confirmed after the earlier one was decided is not a double', () => {
    const decisions = [
      removeAdmin('rm-first', 120_000, 'REJECTED', 121_000, 'Qa'),
      removeAdmin('rm-again', 122_000, 'EXPIRED', 132_081, 'Qa'),
    ];
    expect(admin(run({ decisions }), 'Qb')).toMatchObject({ eligible: 2, missed: 1 });
  });

  it('orders copies confirmed in the same block by time, then signature', () => {
    const span = (signature: string, timestamp: number) =>
      decisionSpan(addAdmin(signature, 120_000, 'EXPIRED', 130_081, 'Qx', { timestamp }), MAX, E)!;
    const never = () => [];
    expect(expiredDoubles([span('a', 2), span('b', 1)], never)).toEqual(new Set(['a']));
    expect(expiredDoubles([span('b', 1), span('a', 1)], never)).toEqual(new Set(['b']));
  });

  it('only admin changes can be doubles, and only copies of the same kind', () => {
    const spans = [
      decision('i1', 120_000, 'EXPIRED', 130_081, { invitee: 'Qn' }),
      decision('i2', 125_000, 'EXPIRED', 135_081, { invitee: 'Qn' }),
      addAdmin('add-n', 120_000, 'EXPIRED', 130_081, 'Qn'),
      removeAdmin('rm-n', 125_000, 'EXPIRED', 135_081, 'Qn'),
    ].map((tx) => decisionSpan(tx, MAX, E)!);
    // Qn is a Minter Admin throughout, so only the addition changes nothing.
    const always = () => [[Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY] as const];
    expect(expiredDoubles(spans, always)).toEqual(new Set(['add-n']));
  });

  it('a double still waiting counts as before: once an admin has answered it', () => {
    const decisions = [
      addAdmin('c-first', 118_000, 'APPROVED', 120_000, 'Qc'),
      decision('c-open', 195_000, 'PENDING', undefined, {
        type: 'ADD_GROUP_ADMIN',
        member: 'Qc',
        invitee: undefined,
      }),
    ];
    const approvals = [approval('Qa', 'c-open', 195_100)];
    const report = run({ decisions, approvals, currentAdmins: ['Qa', 'Qb', 'Qc'] });
    expect(admin(report, 'Qb')).toMatchObject({ eligible: 1, missed: 0 });
    expect(admin(report, 'Qa')).toMatchObject({ eligible: 2, signed: 1 });
  });

  it('nothing on the Unusual approval route is a double, as on Decisions', () => {
    const decisions = [addAdmin('u', 121_000, 'EXPIRED', 131_081, 'Qa', { txGroupId: 4242 })];
    expect(admin(run({ decisions }), 'Qb')).toMatchObject({ eligible: 1, missed: 1 });
  });
});

describe('sortActivity', () => {
  const row = (address: string, extra: Partial<AdminActivity>): AdminActivity => ({
    address,
    current: true,
    adminSince: null,
    adminAgain: false,
    removedAt: null,
    eligible: 10,
    answered: 0,
    signed: 0,
    rejected: 0,
    missed: 0,
    participation: null,
    medianBlocksToSign: null,
    proposed: 0,
    proposedByKind: {},
    lastActiveHeight: null,
    ...extra,
  });
  const rows = [
    row('Q1', { answered: 5, signed: 5, participation: 0.5, lastActiveHeight: 300 }),
    row('Q2', { answered: 9, signed: 9, participation: 0.9, lastActiveHeight: 100 }),
    row('Q3', { signed: 0, participation: null, lastActiveHeight: null, eligible: 0 }),
    // Eight signatures and two rejections of eleven.
    row('Q4', {
      eligible: 11,
      answered: 10,
      signed: 8,
      rejected: 2,
      participation: 0.9,
      lastActiveHeight: 200,
    }),
  ];
  const names: Record<string, string> = { Q1: 'delta', Q2: 'Bravo', Q3: 'alpha', Q4: 'Charlie' };
  const order = (sort: Parameters<typeof sortActivity>[1]) =>
    sortActivity(rows, sort, (a) => names[a]).map((r) => r.address);

  it('sorts by participation (ties by answers), nothing eligible last', () => {
    expect(order('participation')).toEqual(['Q4', 'Q2', 'Q1', 'Q3']);
  });
  it('sorts by signatures', () => {
    expect(order('signatures')).toEqual(['Q2', 'Q4', 'Q1', 'Q3']);
  });
  it('sorts by last active, newest first', () => {
    expect(order('lastActive')).toEqual(['Q1', 'Q4', 'Q2', 'Q3']);
  });
  it('sorts by name, ignoring case', () => {
    expect(order('name')).toEqual(['Q3', 'Q2', 'Q4', 'Q1']);
  });
});

describe('computePulse', () => {
  const spans = [
    decision('i-ok-1', 120_000, 'APPROVED', 120_600),
    decision('i-ok-2', 130_000, 'APPROVED', 131_000),
    decision('i-exp', 140_000, 'EXPIRED', 150_081),
    decision('i-before', 80_000, 'APPROVED', 90_000),
    decision('i-open', 195_000, 'PENDING'),
    decision('kick', 150_000, 'APPROVED', 151_000, { type: 'GROUP_KICK', member: 'Qk' }),
    decision('ban', 150_000, 'APPROVED', 152_000, { type: 'GROUP_BAN', offender: 'Qb' }),
    decision('ban-exp', 150_000, 'EXPIRED', 160_081, { type: 'GROUP_BAN', offender: 'Qc' }),
  ]
    .map((tx) => decisionSpan(tx, MAX, E))
    .filter((s) => s !== null);

  it('summarises joins, departures and invites decided in the window', () => {
    const pulse = computePulse({
      range: { startBlock: S, endBlock: E },
      startTime: 1_000,
      endTime: 2_000,
      spans,
      leaves: [
        { type: 'LEAVE_GROUP', timestamp: 0, signature: 'l1', txGroupId: 0, blockHeight: 150_000 },
        { type: 'LEAVE_GROUP', timestamp: 0, signature: 'l2', txGroupId: 0, blockHeight: 90_000 },
      ],
      members: [{ joined: 500 }, { joined: 1_500 }, { joined: 1_999 }, {}],
    });
    expect(pulse).toEqual({
      joined: 2,
      left: 1,
      kicked: 1,
      banned: 1,
      invitesApproved: 2,
      invitesExpired: 1,
      invitesRejected: 0,
      approvalRate: 2 / 3,
      medianBlocksToApproval: 800,
    });
  });

  it('has no approval rate when no invite was decided', () => {
    const pulse = computePulse({
      range: { startBlock: S, endBlock: E },
      startTime: 0,
      endTime: 1,
      spans: [],
      leaves: [],
      members: [],
    });
    expect(pulse.approvalRate).toBeNull();
    expect(pulse.medianBlocksToApproval).toBeNull();
  });
});

describe('levelSpread', () => {
  it('counts members per level, level 5 and up, and unreadable ones', () => {
    const spread = levelSpread([0, 0, 1, 5, 7, 10, 12, null]);
    expect(spread.byLevel).toEqual([2, 1, 0, 0, 0, 1, 0, 1, 0, 0, 2]);
    expect(spread).toMatchObject({ unknown: 1, total: 8, atLeast5: 4 });
  });
});
