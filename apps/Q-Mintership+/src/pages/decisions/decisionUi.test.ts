import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadDecisions } from '../../data/decisions';
import { buildDecision, type Decision } from '../../rules/decision';
import { ADDR, installWorld } from '../../test/world';
import type { PendingAnswers, PendingWrite } from '../../writes/optimistic';
import {
  answerView,
  banEndLine,
  banLengthText,
  canReject,
  canSign,
  canWithdraw,
  isWaitingForMe,
  newestPending,
  parseBanDays,
  phaseLine,
  reasonProblem,
  secondStepProblem,
  signingWindowText,
  stillStoppable,
  whenApplied,
} from './decisionUi';

afterEach(() => vi.useRealTimers());

const pendingWrite = (status: PendingWrite['status'], at = Date.now()): PendingWrite => ({
  key: 'k',
  status,
  signature: null,
  at,
});

const none: PendingAnswers = { sign: null, reject: null, withdraw: null };
const only = (intent: keyof PendingAnswers, write: PendingWrite): PendingAnswers => ({
  ...none,
  [intent]: write,
});

/** A copy of `d` whose tally holds `admin`'s answers `rows` (approval, confirmed or not, time). */
function withAnswers(
  d: Decision,
  admin: string,
  rows: Array<{ approval: boolean; confirmed: boolean; t: number }>
): Decision {
  const tally = d.tally!;
  const others = (list: typeof tally.approvals) => list.filter((x) => x.adminPublicKey !== admin);
  const decision = (approval: boolean, t: number, confirmed: boolean, withdrew = false) => ({
    adminPublicKey: admin,
    approval,
    timestamp: t,
    blockHeight: confirmed ? 1 : null,
    signature: `s${t}`,
    withdrew,
  });
  const confirmed = rows.filter((r) => r.confirmed).sort((a, b) => a.t - b.t);
  const latest = confirmed[confirmed.length - 1];
  const flying = rows.filter((r) => !r.confirmed && (!latest || r.t > latest.t)).pop();
  const signedBefore = (t: number) => confirmed.some((r) => r.approval && r.t < t);
  return {
    ...d,
    tally: {
      ...tally,
      approvals: [
        ...others(tally.approvals),
        ...(latest?.approval ? [decision(true, latest.t, true)] : []),
      ],
      rejections: [
        ...others(tally.rejections),
        ...(latest && !latest.approval
          ? [decision(false, latest.t, true, signedBefore(latest.t))]
          : []),
      ],
      inFlight: [
        ...tally.inFlight.filter((x) => x.adminPublicKey !== admin),
        ...(flying
          ? [decision(flying.approval, flying.t, false, !flying.approval && signedBefore(flying.t))]
          : []),
      ],
    },
  };
}

async function decisionsAs(persona: string) {
  const installed = installWorld(persona);
  const data = await loadDecisions();
  const by = (subject: string) => data.decisions.find((d) => d.subject === subject) as Decision;
  return { ...installed, data, by };
}

describe('when Sign, Reject and Withdraw are offered', () => {
  it('Sign only for early or open decisions the admin has not signed', async () => {
    const { data, by, publicKey } = await decisionsAs('admin');
    const offered = (d: Decision) => canSign(d, answerView(d, publicKey));
    expect(offered(by(ADDR.nominatedSigning))).toBe(true); // open, not signed
    expect(offered(by(ADDR.urgent))).toBe(false); // signed
    expect(offered(by(ADDR.met))).toBe(false); // threshold met
    expect(offered(by(ADDR.late))).toBe(false); // too late
    expect(offered(by(ADDR.early))).toBe(false); // early, but signed by this admin
    expect(offered(by(ADDR.demote))).toBe(false); // still unconfirmed
    expect(data.unusual.every((d) => !offered(d))).toBe(true);
  });

  it('for an early decision to another admin, and never while an answer is on its way', async () => {
    const { by, publicKey } = await decisionsAs('adminL4');
    const early = by(ADDR.early);
    expect(early.phase).toBe('early');
    expect(canSign(early, answerView(early, publicKey))).toBe(true);
    for (const intent of ['sign', 'reject', 'withdraw'] as const) {
      for (const status of ['sending', 'confirming'] as const) {
        const view = answerView(early, publicKey, only(intent, pendingWrite(status)));
        expect(canSign(early, view)).toBe(false);
        expect(canReject(early, view)).toBe(false);
      }
    }
    // A try that never showed up can be tried again.
    const failed = answerView(early, publicKey, only('sign', pendingWrite('failed')));
    expect(canSign(early, failed)).toBe(true);
    expect(failed.failed).toBe(true);
  });

  it('Reject for admins with no answer yet; Withdraw once their signature is in a block', async () => {
    const { data, by, publicKey } = await decisionsAs('admin');
    const open = by(ADDR.nominatedSigning);
    const signed = by(ADDR.urgent);
    expect(canReject(open, answerView(open, publicKey))).toBe(true);
    expect(canWithdraw(open, answerView(open, publicKey), data.now)).toBe(false);
    expect(canReject(signed, answerView(signed, publicKey))).toBe(false);
    expect(canWithdraw(signed, answerView(signed, publicKey), data.now)).toBe(true);
    // Not once it can no longer count, nor unconfirmed, nor with enough
    // signatures when Core applies it in the next block (a withdrawal would
    // land in that block, too late to count).
    expect(by(ADDR.met).applyAtHeight).toBe(data.now.height + 1);
    expect(stillStoppable(by(ADDR.met), data.now)).toBe(false);
    for (const subject of [ADDR.late, ADDR.met, ADDR.demote]) {
      const d = by(subject);
      expect(canReject(d, answerView(d, publicKey))).toBe(false);
      expect(canWithdraw(d, answerView(d, publicKey), data.now)).toBe(false);
    }
  });

  it('Withdraw also with enough signatures, while a withdrawal can still stop it', async () => {
    const { data, by, publicKey } = await decisionsAs('admin');
    const early = by(ADDR.early); // signed by this admin; Core can't decide it yet
    const others = Array.from({ length: 8 }, (_, i) => ({
      signature: `a${i}`,
      pendingSignature: early.signature,
      adminPublicKey: `pk${i}`,
      creatorAddress: `Q${i}`,
      approval: true,
      timestamp: 1,
      blockHeight: data.now.height,
    }));
    const met = buildDecision(early.tx, {
      threshold: data.group.approvalThreshold,
      totalAdmins: data.admins.adminCount,
      delays: data.group,
      tipHeight: data.now.height,
      approvals: [...data.approvals, ...others],
    });
    expect(met.phase).toBe('thresholdMet');
    expect(met.applyAtHeight).toBe(early.window!.earliestDecisionHeight);
    expect(met.applyAtHeight).toBeGreaterThan(data.now.height + 1);
    const view = answerView(met, publicKey);
    expect(view).toMatchObject({ shown: 'signed', settled: true });
    expect(met.windowPhase).toBe('early');
    expect(stillStoppable(met, data.now)).toBe(true);
    expect(canWithdraw(met, view, data.now)).toBe(true);
    // More signatures or a rejection change nothing here: neither is offered.
    const nobody = answerView(met, 'nobody');
    expect(canSign(met, nobody) || canReject(met, nobody)).toBe(false);
    // Once it applies in the next block, a withdrawal sent then is too late.
    const later = { ...data.now, height: (met.applyAtHeight as number) - 1 };
    expect(stillStoppable(met, later)).toBe(false);
    expect(canWithdraw(met, view, later)).toBe(false);
  });

  it('a confirmed rejection can be replaced by a signature, but not rejected again', async () => {
    const { data, by, publicKey } = await decisionsAs('admin');
    const fresh = by(ADDR.nominatedSigning);
    const d = withAnswers(fresh, publicKey, [{ approval: false, confirmed: true, t: 5 }]);
    const view = answerView(d, publicKey);
    expect(view).toMatchObject({ shown: 'rejected', settled: true, label: 'Rejected' });
    expect(canSign(d, view)).toBe(true);
    expect(canReject(d, view)).toBe(false);
    expect(canWithdraw(d, view, data.now)).toBe(false);
    // Signable, but no longer waiting for this admin: they answered.
    expect(isWaitingForMe(d, view)).toBe(false);
    expect(isWaitingForMe(fresh, answerView(fresh, publicKey))).toBe(true);
  });

  it('a rejection on its way from another device offers nothing until it is in', async () => {
    const { data, by, publicKey } = await decisionsAs('admin');
    const d = withAnswers(by(ADDR.nominatedSigning), publicKey, [
      { approval: false, confirmed: false, t: 5 },
    ]);
    const view = answerView(d, publicKey);
    expect(view).toMatchObject({
      shown: 'rejected',
      settled: false,
      label: 'Rejected (confirming…)',
    });
    expect(canSign(d, view) || canReject(d, view) || canWithdraw(d, view, data.now)).toBe(false);
  });
});

describe("the admin's answer as the card shows it", () => {
  it('Signed ✓, or Signed ✓ (confirming…) while on its way', async () => {
    const { by, publicKey } = await decisionsAs('admin');
    expect(answerView(by(ADDR.urgent), publicKey).label).toBe('Signed ✓');
    const open = by(ADDR.nominatedSigning);
    expect(answerView(open, publicKey).label).toBeNull();
    expect(answerView(open, publicKey, only('sign', pendingWrite('confirming'))).label).toBe(
      'Signed ✓ (confirming…)'
    );
    // Sending isn't an answer yet: the card shows "Signing…" instead.
    const sending = answerView(open, publicKey, only('sign', pendingWrite('sending')));
    expect(sending).toMatchObject({ label: null, sending: 'sign', busy: true });
  });

  it('Rejected (confirming…) settles to Rejected once the chain has it', async () => {
    const { by, publicKey } = await decisionsAs('admin');
    const open = by(ADDR.nominatedSigning);
    const pending = only('reject', pendingWrite('confirming'));
    expect(answerView(open, publicKey, pending)).toMatchObject({
      shown: 'rejected',
      settled: false,
      label: 'Rejected (confirming…)',
      busy: true,
    });
    const inBlock = withAnswers(open, publicKey, [{ approval: false, confirmed: true, t: 5 }]);
    expect(answerView(inBlock, publicKey, pending)).toMatchObject({
      label: 'Rejected',
      settled: true,
      busy: false,
    });
    // Once it settled, Sign is offered again even while the entry lingers.
    expect(canSign(inBlock, answerView(inBlock, publicKey, pending))).toBe(true);
  });

  it('Withdrawn (confirming…) settles to Signature withdrawn', async () => {
    const { by, publicKey } = await decisionsAs('admin');
    const signed = by(ADDR.urgent);
    const pending = only('withdraw', pendingWrite('confirming'));
    // The chain still shows the signature: the withdrawal is on its way.
    expect(answerView(signed, publicKey, pending)).toMatchObject({
      shown: 'rejected',
      withdrew: true,
      label: 'Withdrawn (confirming…)',
    });
    const after = withAnswers(signed, publicKey, [
      { approval: true, confirmed: true, t: 1 },
      { approval: false, confirmed: true, t: 9 },
    ]);
    expect(answerView(after, publicKey, pending).label).toBe('Signature withdrawn');
    // After a reload (no entry), the chain alone says it was withdrawn.
    expect(answerView(after, publicKey).label).toBe('Signature withdrawn');
    const flying = withAnswers(signed, publicKey, [
      { approval: true, confirmed: true, t: 1 },
      { approval: false, confirmed: false, t: 9 },
    ]);
    expect(answerView(flying, publicKey).label).toBe('Withdrawn (confirming…)');
  });

  it('the newest answer from this device wins', () => {
    const older = pendingWrite('confirming', 1_000);
    const newer = pendingWrite('confirming', 2_000);
    expect(newestPending({ sign: older, reject: null, withdraw: newer })?.intent).toBe('withdraw');
    expect(newestPending({ sign: newer, reject: older, withdraw: null })?.intent).toBe('sign');
    expect(newestPending({ ...none, sign: pendingWrite('failed') })).toBeNull();
  });
});

describe('phase lines', () => {
  it('says where each phase stands in plain words', async () => {
    const { data, by } = await decisionsAs('admin');
    expect(phaseLine(by(ADDR.met), data.now)).toMatch(/Core applies it in the next block/);
    expect(phaseLine(by(ADDR.late), data.now)).toMatch(/Too late to sign/);
    expect(phaseLine(by(ADDR.demote), data.now)).toMatch(/On its way into a block/);
    expect(phaseLine(by(ADDR.early), data.now)).toMatch(/can be applied from block 2,757,504/);
    expect(phaseLine(by(ADDR.nominatedSigning), data.now)).toBeNull();
  });
});

describe('a proposal and its proposer’s signature', () => {
  it('says why step 2 did not go through, in one sentence', () => {
    expect(secondStepProblem({ status: 'declined' })).toBe('You cancelled step 2 in Hub.');
    expect(secondStepProblem({ status: 'blocked', reason: 'Your node doesn’t show it yet.' })).toBe(
      'Your node doesn’t show it yet.'
    );
    expect(secondStepProblem({ status: 'failed', message: 'Core said no.' })).toBe('Core said no.');
    expect(secondStepProblem(null)).toBe('Step 2 did not run.');
  });

  it('gives the signing window in blocks and time', () => {
    expect(signingWindowText(10_080, 72_900)).toMatch(/^10,080 blocks \(about 8 days/);
  });
});

describe('ban lengths and reasons', () => {
  it('takes 1 to 24 whole days and refuses anything longer', () => {
    expect(parseBanDays('7')).toEqual({ seconds: 7 * 86_400 });
    expect(parseBanDays('24')).toEqual({ seconds: 24 * 86_400 });
    expect(parseBanDays('25')).toMatchObject({ error: expect.stringMatching(/up to 24 days/) });
    expect(parseBanDays('0')).toMatchObject({ error: expect.stringMatching(/At least 1 day/) });
    expect(parseBanDays('2.5')).toMatchObject({ error: expect.stringMatching(/whole number/) });
    expect(parseBanDays('')).toMatchObject({ error: expect.any(String) });
  });

  it('shows 0 as permanent', () => {
    expect(banLengthText(0)).toBe('Permanent');
    expect(banLengthText(undefined)).toBe('Permanent');
    expect(banLengthText(86_400)).toBe('1 day');
    expect(banLengthText(24 * 86_400)).toBe('24 days');
  });

  it('needs a reason Core can carry (128 bytes of UTF-8)', () => {
    expect(reasonProblem('  ')).toMatch(/Say why/);
    expect(reasonProblem('Spam')).toBeNull();
    expect(reasonProblem('a'.repeat(128))).toBeNull();
    expect(reasonProblem('a'.repeat(129))).toMatch(/128 bytes/);
    // 43 × 3 bytes = 129: too long although only 43 characters.
    expect(reasonProblem('€'.repeat(43))).toMatch(/128 bytes/);
  });
});

describe('when a timed ban ends', () => {
  it('counts from the proposal, and says when that time has already run out', async () => {
    const { data, by } = await decisionsAs('admin');
    const ban = by(ADDR.banTarget); // proposed 5,000 blocks (about 4 days) ago
    expect(banEndLine(ban, data.now)).toBeNull(); // permanent
    const tenDays = banEndLine({ ...ban, banSeconds: 10 * 86_400 }, data.now);
    expect(tenDays).toMatch(
      /^Ends about .+: a ban counts from when it was proposed, not from approval\.$/
    );
    const threeDays = banEndLine({ ...ban, banSeconds: 3 * 86_400 }, data.now);
    expect(threeDays).toMatch(/^Its time has already run out \(it ended .+\)/);
  });
});

describe('when a decision with enough signatures is applied', () => {
  it('says the next block once it can be, and its first decision block while just proposed', async () => {
    const { data, by } = await decisionsAs('admin');
    const early = by(ADDR.early); // confirmed 2 blocks ago: Core can't decide it yet
    const approvals = Array.from({ length: 8 }, (_, i) => ({
      signature: `a${i}`,
      pendingSignature: early.signature,
      adminPublicKey: `pk${i}`,
      creatorAddress: `Q${i}`,
      approval: true,
      timestamp: 1,
      blockHeight: data.now.height,
    }));
    const ctx = {
      threshold: data.group.approvalThreshold,
      totalAdmins: data.admins.adminCount,
      delays: data.group,
      tipHeight: data.now.height,
      approvals,
    };
    const met = buildDecision(early.tx, ctx);
    expect(met.phase).toBe('thresholdMet');
    expect(met.applyAtHeight).toBe(early.window!.earliestDecisionHeight);
    expect(met.applyAtHeight).toBeGreaterThan(data.now.height + 1);
    expect(phaseLine(met, data.now)).toMatch(
      /^Enough signatures: Core applies it at block [\d,]+ \(in about \d+ minutes?\)\./
    );
    // An open decision with enough signatures: the next block.
    expect(whenApplied(by(ADDR.met), data.now)).toBe('in the next block');
    expect(phaseLine(by(ADDR.met), data.now)).toMatch(/Core applies it in the next block/);
  });
});

describe('when a decision has enough rejections', () => {
  const rejectRows = (pending: string, height: number, n: number) =>
    Array.from({ length: n }, (_, i) => ({
      signature: `r${i}`,
      pendingSignature: pending,
      adminPublicKey: `rk${i}`,
      creatorAddress: `QR${i}`,
      approval: false,
      timestamp: 1,
      blockHeight: height,
    }));

  it('ends it as rejected in the next block once it can be decided', async () => {
    const { data, by } = await decisionsAs('admin');
    const open = by(ADDR.kickTarget); // open, 2 of 8 signatures
    const ctx = {
      threshold: data.group.approvalThreshold,
      totalAdmins: data.admins.adminCount,
      delays: data.group,
      tipHeight: data.now.height,
      approvals: [...data.approvals, ...rejectRows(open.signature, data.now.height, 8)],
    };
    const rejected = buildDecision(open.tx, ctx);
    expect(rejected.phase).toBe('rejectedMet');
    expect(rejected.applyAtHeight).toBe(data.now.height + 1);
    expect(phaseLine(rejected, data.now)).toBe(
      'Enough rejections: Core ends it as rejected in the next block. It can be proposed again.'
    );
    expect(canSign(rejected, answerView(rejected, 'nobody'))).toBe(false);
    expect(canReject(rejected, answerView(rejected, 'nobody'))).toBe(false);
    // Seven are not enough.
    const seven = buildDecision(open.tx, {
      ...ctx,
      approvals: [...data.approvals, ...rejectRows(open.signature, data.now.height, 7)],
    });
    expect(seven.phase).toBe('open');
  });

  it('says signatures still win while it is just proposed', async () => {
    const { data, by } = await decisionsAs('admin');
    const early = by(ADDR.early);
    const decision = buildDecision(early.tx, {
      threshold: data.group.approvalThreshold,
      totalAdmins: data.admins.adminCount,
      delays: data.group,
      tipHeight: data.now.height,
      approvals: rejectRows(early.signature, data.now.height, 8),
    });
    expect(decision.phase).toBe('rejectedMet');
    expect(decision.windowPhase).toBe('early');
    expect(decision.applyAtHeight).toBe(early.window!.earliestDecisionHeight);
    expect(phaseLine(decision, data.now)).toMatch(
      /^Enough rejections: Core ends it as rejected at block [\d,]+ \(in about .+\), unless it has 8 signatures by then \(signatures are counted first\)\./
    );
    // So Sign is offered: to an admin who hasn't answered, and to one whose
    // rejection is in a block (a signature replaces it). Another rejection
    // changes nothing, so Reject isn't.
    const nobody = answerView(decision, 'nobody');
    expect(canSign(decision, nobody)).toBe(true);
    expect(canReject(decision, nobody)).toBe(false);
    const rejecter = answerView(decision, 'rk0');
    expect(rejecter).toMatchObject({ shown: 'rejected', settled: true });
    expect(canSign(decision, rejecter)).toBe(true);
  });

  it('is approved, not rejected, when both reach the target', async () => {
    const { data, by } = await decisionsAs('admin');
    const met = by(ADDR.met); // 8 of 8 signatures
    const decision = buildDecision(met.tx, {
      threshold: data.group.approvalThreshold,
      totalAdmins: data.admins.adminCount,
      delays: data.group,
      tipHeight: data.now.height,
      approvals: [...data.approvals, ...rejectRows(met.signature, data.now.height, 8)],
    });
    expect(decision.phase).toBe('thresholdMet');
  });
});
