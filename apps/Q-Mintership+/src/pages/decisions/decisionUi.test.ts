import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadDecisions } from '../../data/decisions';
import { buildDecision, type Decision } from '../../rules/decision';
import { ADDR, installWorld } from '../../test/world';
import type { PendingWrite } from '../../writes/optimistic';
import {
  banEndLine,
  banLengthText,
  canSign,
  myAnswer,
  parseBanDays,
  phaseLine,
  reasonProblem,
  secondStepProblem,
  signedLabel,
  signingWindowText,
  whenApplied,
} from './decisionUi';

afterEach(() => vi.useRealTimers());

const pendingWrite = (status: PendingWrite['status']): PendingWrite => ({
  key: 'k',
  status,
  signature: null,
  at: Date.now(),
});

async function decisionsAs(persona: string) {
  const installed = installWorld(persona);
  const data = await loadDecisions();
  const by = (subject: string) => data.decisions.find((d) => d.subject === subject) as Decision;
  return { ...installed, data, by };
}

describe('when Sign is offered', () => {
  it('only for early or open decisions the admin has not signed', async () => {
    const { data, by, publicKey } = await decisionsAs('admin');
    const offered = (d: Decision) => canSign(d, myAnswer(d, publicKey), null);
    expect(offered(by(ADDR.nominatedSigning))).toBe(true); // open, not signed
    expect(offered(by(ADDR.urgent))).toBe(false); // signed
    expect(offered(by(ADDR.met))).toBe(false); // threshold met
    expect(offered(by(ADDR.late))).toBe(false); // too late
    expect(offered(by(ADDR.early))).toBe(false); // early, but signed by this admin
    expect(offered(by(ADDR.demote))).toBe(false); // still unconfirmed
    expect(data.unusual.every((d) => !offered(d))).toBe(true);
  });

  it('for an early decision to another admin, and never while a signature is on its way', async () => {
    const { by, publicKey } = await decisionsAs('adminL4');
    const early = by(ADDR.early);
    expect(early.phase).toBe('early');
    expect(canSign(early, myAnswer(early, publicKey), null)).toBe(true);
    expect(canSign(early, 'none', pendingWrite('sending'))).toBe(false);
    expect(canSign(early, 'none', pendingWrite('confirming'))).toBe(false);
    // A try that never showed up can be tried again.
    expect(canSign(early, 'none', pendingWrite('failed'))).toBe(true);
    // Only the latest answer counts, so a rejection can be replaced.
    expect(canSign(early, 'rejected', null)).toBe(true);
    expect(canSign(early, 'rejecting', null)).toBe(false);
  });

  it('labels a signature as confirmed or on its way', () => {
    expect(signedLabel('signed', null)).toBe('Signed ✓');
    expect(signedLabel('confirming', null)).toBe('Signed ✓ (confirming…)');
    expect(signedLabel('none', pendingWrite('confirming'))).toBe('Signed ✓ (confirming…)');
    expect(signedLabel('none', pendingWrite('sending'))).toBeNull();
    expect(signedLabel('none', null)).toBeNull();
  });

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
