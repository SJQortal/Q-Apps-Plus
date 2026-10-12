import { afterEach, describe, expect, it, vi } from 'vitest';
import { base58Decode, base58Encode } from '../qortal/base58';
import { GROUP_APPROVAL_UNSIGNED_LENGTH } from '../qortal/approvalBytes';
import { loadDecisions } from '../data/decisions';
import { ADDR, installWorld } from '../test/world';
import { mockQortalRequest, qortalCalls, qortalCallsFor } from '../test/setup';
import {
  addAdminRequest,
  banRequest,
  cancelBanRequest,
  cancelInviteRequest,
  inviteRequest,
  joinRequest,
  kickRequest,
  publishRecordRequest,
  removeAdminRequest,
  signApprovalRequest,
} from './hubActions';
import {
  guardBan,
  guardInvite,
  guardJoin,
  guardKick,
  guardNominate,
  guardRemoveAdmin,
  guardSign,
  guardSupport,
} from './guards';
import { runWrite, type Signer } from './runner';
import {
  bulkSign,
  firstSignature,
  joinMinter,
  proposeBan,
  publishNomination,
  signDecision,
} from './flows';
import { getPendingWrite, writeKeys } from './optimistic';

afterEach(() => vi.useRealTimers());

const N = 'QNomiUy6sUiEnaN87dWmE92g1uQjrvPgrW';

describe('Hub payloads (pinned)', () => {
  it('every MINTER proposal carries groupId 694 and txGroupId 694', () => {
    expect(inviteRequest(N)).toEqual({
      action: 'INVITE_TO_GROUP',
      groupId: 694,
      inviteeAddress: N,
      inviteTime: 864000,
      txGroupId: 694,
    });
    expect(cancelInviteRequest(N)).toEqual({
      action: 'CANCEL_GROUP_INVITE',
      groupId: 694,
      qortalAddress: N,
      txGroupId: 694,
    });
    expect(kickRequest(N, 'why')).toEqual({
      action: 'KICK_FROM_GROUP',
      groupId: 694,
      qortalAddress: N,
      reason: 'why',
      txGroupId: 694,
    });
    expect(banRequest(N, 'why', 0)).toEqual({
      action: 'BAN_FROM_GROUP',
      groupId: 694,
      qortalAddress: N,
      reason: 'why',
      banTime: 0,
      txGroupId: 694,
    });
    expect(cancelBanRequest(N)).toEqual({
      action: 'CANCEL_GROUP_BAN',
      groupId: 694,
      qortalAddress: N,
      txGroupId: 694,
    });
    expect(addAdminRequest(N)).toEqual({
      action: 'ADD_GROUP_ADMIN',
      groupId: 694,
      qortalAddress: N,
      txGroupId: 694,
    });
    expect(removeAdminRequest(N)).toEqual({
      action: 'REMOVE_GROUP_ADMIN',
      groupId: 694,
      qortalAddress: N,
      txGroupId: 694,
    });
  });

  it('JOIN_GROUP has no txGroupId (Hub sends 0) and approvals go through SIGN_TRANSACTION with process', () => {
    expect(joinRequest()).toEqual({ action: 'JOIN_GROUP', groupId: 694 });
    expect(signApprovalRequest('abc')).toEqual({
      action: 'SIGN_TRANSACTION',
      unsignedBytes: 'abc',
      process: true,
    });
  });

  it('caps bans at 24 days (0 = permanent)', () => {
    expect(() => banRequest(N, 'x', 24 * 86_400 + 1)).toThrow(/24 days/);
    expect(() => banRequest(N, 'x', -1)).toThrow();
    expect(banRequest(N, 'x', 24 * 86_400).banTime).toBe(2_073_600);
  });

  it('publishes records as JSON under the publisher name with the qmp- identifier', () => {
    const req = publishRecordRequest('Nora', `qmp-nomination-${N}`, {
      v: 1,
      nomineeAddress: N,
      reason: 'x'.repeat(30),
      links: [],
    });
    expect(req).toMatchObject({
      action: 'PUBLISH_QDN_RESOURCE',
      name: 'Nora',
      service: 'JSON',
      identifier: `qmp-nomination-${N}`,
    });
    expect(JSON.parse(atob(String(req.data64)))).toEqual({
      v: 1,
      nomineeAddress: N,
      reason: 'x'.repeat(30),
      links: [],
    });
  });
});

function signerFor(persona: string): Signer {
  const { address, publicKey } = installWorld(persona);
  return { address, publicKey };
}

describe('guards re-read the chain before a write', () => {
  it('sign: blocks a second signature, a too-late one and non-admins', async () => {
    const admin = signerFor('admin');
    const data = await loadDecisions();
    const of = (a: string) => data.decisions.find((d) => d.subject === a)!.signature;
    expect(await guardSign(admin, of(ADDR.urgent))).toBe("You've already signed this.");
    expect(await guardSign(admin, of(ADDR.late))).toMatch(/Too late/);
    expect(await guardSign(admin, of(ADDR.nominatedSigning))).toBeNull();
    const learner = signerFor('learner');
    expect(await guardSign(learner, of(ADDR.nominatedSigning))).toMatch(/Only Minter Admins/);
  });

  it('invite: blocks members, banned accounts, duplicates and stored invites', async () => {
    const admin = signerFor('admin');
    expect(await guardInvite(admin, ADDR.nominator)).toBe('Already in MINTER.');
    expect(await guardInvite(admin, ADDR.banned)).toMatch(/banned/);
    expect(await guardInvite(admin, ADDR.nominatedSigning)).toMatch(/already waiting/);
    expect(await guardInvite(admin, ADDR.approved)).toMatch(/only need to press Join/);
    expect(await guardInvite(admin, ADDR.nominatedWaiting)).toBeNull();
  });

  it('kick and ban: an admin must lose the role first; bans are 0 or ≤ 24 days', async () => {
    const admin = signerFor('admin');
    expect(await guardKick(admin, ADDR.demote)).toMatch(/admin role first/);
    expect(await guardKick(admin, ADDR.kickTarget)).toMatch(/already waiting/);
    expect(await guardKick(admin, ADDR.learner)).toBeNull();
    expect(await guardBan(admin, ADDR.learner, 25 * 86_400)).toMatch(/24 days/);
    expect(await guardBan(admin, ADDR.banned, 0)).toBe('Already banned.');
    expect(await guardRemoveAdmin(admin, 'QdSnUy6sUiEnaN87dWmE92g1uQjrvPgrWG')).toMatch(/owner/);
  });

  it('join: refuses members, banned accounts and a second request', async () => {
    expect(await guardJoin(signerFor('nominator'))).toMatch(/already in MINTER/);
    expect(await guardJoin(signerFor('banned'))).toMatch(/banned/);
    expect(await guardJoin(signerFor('nominatedSigning'))).toMatch(/already accepted/);
    expect(await guardJoin(signerFor('nominatedWaiting'))).toBeNull();
  });

  it('nominate and support: level 5+ members or admins, no self, no duplicates', async () => {
    expect(await guardNominate(signerFor('learner'), ADDR.newcomerName)).toMatch(/from level 5/);
    const nora = signerFor('nominator');
    expect(await guardNominate(nora, ADDR.nominatedWaiting)).toMatch(/add your support/);
    expect(await guardNominate(nora, ADDR.nominator)).toMatch(/yourself/);
    expect(await guardNominate(nora, ADDR.newcomerName)).toBeNull();
    expect(await guardSupport(nora, ADDR.nominatedWaiting)).toMatch(/already/);
    expect(await guardSupport(signerFor('adminL4'), ADDR.newcomerName)).toMatch(
      /no open nomination/
    );
  });
});

describe('runWrite', () => {
  it('stops before Hub when the balance cannot pay the fee', async () => {
    const newcomer = signerFor('newcomer');
    const outcome = await runWrite({ request: joinRequest(), signer: newcomer, match: () => true });
    expect(outcome).toEqual({ status: 'blocked', reason: expect.stringMatching(/0.01 QORT/) });
    expect(qortalCallsFor('JOIN_GROUP')).toHaveLength(0);
  });

  it('treats a decline as a cancel', async () => {
    const signer = signerFor('nominatedWaiting');
    expect(await runWrite({ request: joinRequest(), signer, match: () => true })).toEqual({
      status: 'declined',
    });
  });

  it('refuses actions outside the allowed list', async () => {
    const signer = signerFor('admin');
    const outcome = await runWrite({
      request: { action: 'SEND_COIN', amount: 1 },
      signer,
      match: () => true,
    });
    expect(outcome.status).toBe('blocked');
    expect(qortalCalls.some((c) => c.action === 'SEND_COIN')).toBe(false);
  });

  it('after a Hub timeout, finds the transaction before offering Retry', async () => {
    const { world, address, publicKey } = installWorld('nominatedWaiting');
    mockQortalRequest('JOIN_GROUP', () => {
      world.pending.push({
        type: 'JOIN_GROUP',
        timestamp: Date.now(),
        signature: 'S1',
        txGroupId: 0,
        creatorAddress: address,
        groupId: 694,
        adminPublicKey: publicKey,
      });
      throw { error: 'timeout', message: 'Request timed out after 30000 ms (action: JOIN_GROUP)' };
    });
    const outcome = await runWrite({
      request: joinRequest(),
      signer: { address, publicKey },
      match: (tx) => tx.type === 'JOIN_GROUP',
    });
    expect(outcome).toMatchObject({ status: 'sent', recovered: true, signature: 'S1' });
  });

  it('says "unknown" (not "failed") when a timed-out write never shows up', async () => {
    const { address, publicKey } = installWorld('nominatedWaiting');
    mockQortalRequest('JOIN_GROUP', () => {
      throw 'The request timed out';
    });
    const outcome = await runWrite({
      request: joinRequest(),
      signer: { address, publicKey },
      match: () => true,
    });
    expect(outcome.status).toBe('unknown');
  });

  it("passes Core's message through on a real failure", async () => {
    const { address, publicKey } = installWorld('nominatedWaiting');
    mockQortalRequest('JOIN_GROUP', () => {
      throw {
        error: 'TRANSACTION_INVALID: JOIN_REQUEST_EXISTS',
        message: 'TRANSACTION_INVALID: JOIN_REQUEST_EXISTS',
      };
    });
    const outcome = await runWrite({
      request: joinRequest(),
      signer: { address, publicKey },
      match: () => true,
    });
    expect(outcome).toEqual({
      status: 'failed',
      message: 'TRANSACTION_INVALID: JOIN_REQUEST_EXISTS',
    });
  });
});

describe('flows', () => {
  it('signDecision builds GROUP_APPROVAL bytes for the pending signature and marks it confirming', async () => {
    const { address, publicKey } = installWorld('admin');
    const data = await loadDecisions();
    const pending = data.decisions.find((d) => d.subject === ADDR.nominatedSigning)!.signature;
    mockQortalRequest('SIGN_TRANSACTION', () => ({
      type: 'GROUP_APPROVAL',
      signature: 'APPROVAL1',
    }));
    const outcome = await signDecision({ address, publicKey }, pending);
    expect(outcome, JSON.stringify(outcome)).toMatchObject({
      status: 'sent',
      signature: 'APPROVAL1',
    });
    const call = qortalCallsFor('SIGN_TRANSACTION')[0];
    expect(call.process).toBe(true);
    const bytes = base58Decode(String(call.unsignedBytes));
    expect(bytes).toHaveLength(GROUP_APPROVAL_UNSIGNED_LENGTH);
    expect(base58Encode(bytes.slice(80, 112))).toBe(publicKey);
    expect(base58Encode(bytes.slice(112, 176))).toBe(pending);
    expect(bytes[176]).toBe(1);
    expect(getPendingWrite(writeKeys.sign(pending))?.status).toBe('confirming');
  });

  it('firstSignature sends the invite, waits for it on the node, then approves that invite', async () => {
    const { world, address, publicKey } = installWorld('admin');
    const inviteSig = base58Encode(new Uint8Array(64).fill(7));
    mockQortalRequest('INVITE_TO_GROUP', (req: Record<string, unknown>) => {
      const tx = {
        type: 'GROUP_INVITE',
        timestamp: Date.now(),
        signature: inviteSig,
        txGroupId: 694,
        groupId: 694,
        approvalStatus: 'PENDING',
        creatorAddress: address,
        adminPublicKey: publicKey,
        invitee: req.inviteeAddress,
      };
      world.pending.push(tx);
      return tx;
    });
    mockQortalRequest('SIGN_TRANSACTION', () => ({ type: 'GROUP_APPROVAL', signature: 'A2' }));
    const steps: string[] = [];
    const result = await firstSignature({ address, publicKey }, ADDR.nominatedWaiting, (p) =>
      steps.push(`${p.step}:${p.stage}`)
    );
    expect(result.invite.status).toBe('sent');
    expect(qortalCallsFor('INVITE_TO_GROUP')[0]).toMatchObject({
      inviteeAddress: ADDR.nominatedWaiting,
      txGroupId: 694,
    });
    expect(result.approval?.status).toBe('sent');
    const bytes = base58Decode(String(qortalCallsFor('SIGN_TRANSACTION')[0].unsignedBytes));
    expect(base58Encode(bytes.slice(112, 176))).toBe(inviteSig);
    expect(steps[0]).toBe('1:checking');
    expect(steps).toContain('2:waitingForHub');
  });

  it("firstSignature doesn't sign an invite the node never shows", async () => {
    const { address, publicKey } = installWorld('admin');
    mockQortalRequest('INVITE_TO_GROUP', () => ({
      type: 'GROUP_INVITE',
      signature: base58Encode(new Uint8Array(64).fill(9)),
    }));
    const result = await firstSignature({ address, publicKey }, ADDR.nominatedWaiting);
    expect(result.invite.status).toBe('sent');
    expect(result.approval?.status).toBe('blocked');
    expect(qortalCallsFor('SIGN_TRANSACTION')).toHaveLength(0);
  });

  it('firstSignature stops after a declined invite', async () => {
    const { address, publicKey } = installWorld('admin');
    const result = await firstSignature({ address, publicKey }, ADDR.nominatedWaiting);
    expect(result.invite.status).toBe('declined');
    expect(result.approval).toBeNull();
  });

  it('bulkSign signs one after another and stops at a decline', async () => {
    const { address, publicKey } = installWorld('admin');
    const data = await loadDecisions();
    const sigs = [ADDR.nominatedSigning, ADDR.banTarget].map(
      (a) => data.decisions.find((d) => d.subject === a)!.signature
    );
    const seen: number[] = [];
    const outcomes = await bulkSign({ address, publicKey }, sigs, (i, o) => o && seen.push(i));
    expect(outcomes.map((o) => o.status)).toEqual(['declined']);
    expect(seen).toEqual([0]);
  });

  it('joinMinter and proposeBan go through their guards', async () => {
    const banned = installWorld('banned');
    expect(
      (await joinMinter({ address: banned.address, publicKey: banned.publicKey })).status
    ).toBe('blocked');
    const admin = installWorld('admin');
    const outcome = await proposeBan(
      { address: admin.address, publicKey: admin.publicKey },
      ADDR.learner,
      'Spam',
      30 * 86_400
    );
    expect(outcome).toMatchObject({ status: 'blocked' });
    expect(qortalCallsFor('BAN_FROM_GROUP')).toHaveLength(0);
  });

  it('publishNomination validates the record before Hub sees it', async () => {
    const { address, publicKey } = installWorld('nominator');
    const short = await publishNomination(
      { address, publicKey, name: 'Nora Nominator' },
      { nomineeAddress: ADDR.newcomerName, reason: 'too short', links: [] }
    );
    expect(short).toMatchObject({
      status: 'blocked',
      reason: expect.stringMatching(/at least 20/),
    });
    const ok = await publishNomination(
      { address, publicKey, name: 'Nora Nominator' },
      {
        nomineeAddress: ADDR.newcomerName,
        nomineeName: 'Zoë Newcomer',
        reason: 'Runs a reliable node and helps people.',
        links: ['qortal://APP/Q-Tube'],
      }
    );
    expect(ok.status).toBe('declined');
    const publish = qortalCallsFor('PUBLISH_QDN_RESOURCE')[0];
    expect(publish).toMatchObject({
      service: 'JSON',
      name: 'Nora Nominator',
      identifier: `qmp-nomination-${ADDR.newcomerName}`,
    });
  });

  it('never POSTs to Core', async () => {
    const w = installWorld('admin');
    const data = await loadDecisions();
    mockQortalRequest('SIGN_TRANSACTION', () => ({ signature: 'X' }));
    await signDecision(
      { address: w.address, publicKey: w.publicKey },
      data.decisions.find((d) => d.subject === ADDR.nominatedSigning)!.signature
    );
    expect(w.posts).toEqual([]);
  });
});
