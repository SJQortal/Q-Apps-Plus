import { afterEach, describe, expect, it, vi } from 'vitest';
import { base58Decode, base58Encode } from '../qortal/base58';
import { GROUP_APPROVAL_UNSIGNED_LENGTH } from '../qortal/approvalBytes';
import { loadDecisions } from '../data/decisions';
import { ADDR, NULL_OWNER, TIP, addOtherPending, installWorld } from '../test/world';
import { addDoubles, addReady, fakeAddress } from '../../e2e/world.mjs';
import { mockFetchRoute, mockQortalRequest, qortalCalls, qortalCallsFor } from '../test/setup';
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
  guardAddAdmin,
  guardBan,
  guardCancelInvite,
  guardInvite,
  guardJoin,
  guardKick,
  guardNominate,
  guardReject,
  guardRemoveAdmin,
  guardSign,
  guardSupport,
} from './guards';
import { runWrite, type Signer } from './runner';
import {
  bulkSign,
  firstSignature,
  joinMinter,
  proposeAndSign,
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

  it('sign: refuses anything that is not a MINTER group change', async () => {
    const { world, address, publicKey } = installWorld('admin');
    const [invite, name, cancel] = addOtherPending(world);
    const admin = { address, publicKey };
    for (const signature of [invite, name, cancel])
      expect(await guardSign(admin, signature)).toBe(
        "This isn't a MINTER group change, so it can't be signed here."
      );
    const data = await loadDecisions();
    const mintersCancel = data.decisions.find((d) => d.kind === 'cancelInvite')!;
    expect(await guardSign(admin, mintersCancel.signature)).toBeNull();
  });

  it('sign: never on a removal that is a double; Reject stays', async () => {
    const { world, address, publicKey } = installWorld('admin');
    const admin = { address, publicKey };
    const doubles = addDoubles(world);
    // Nora Nominator isn't a Minter Admin: nothing to remove.
    expect(await guardSign(admin, doubles.notAdmin.signature)).toBe(
      "There's nothing to remove: they aren't a Minter Admin. Reject it, or let it run out."
    );
    expect(await guardReject(admin, doubles.notAdmin.signature)).toBeNull();
    // The same removal of a Minter Admin twice: the newer one is the double.
    const data = await loadDecisions({ force: true });
    const target = data.admins.admins.find(
      (a) => a.member !== NULL_OWNER && a.member !== address
    )!.member;
    const base = world.pending.find(
      (t: { signature: string }) => t.signature === doubles.notAdmin.signature
    );
    const removal = (seed: string, h: number) => ({
      ...base,
      admin: target,
      signature: `${base.signature.slice(0, -6)}${seed}`,
      blockHeight: h,
      timestamp: base.timestamp + (h - base.blockHeight) * 72_900,
    });
    const older = removal('older1', TIP - 400);
    const newer = removal('newer1', TIP - 300);
    world.pending.push(older, newer);
    expect(await guardSign(admin, newer.signature)).toBe(
      'The same removal is already waiting in an earlier proposal: answer that one instead.'
    );
    expect(await guardSign(admin, older.signature)).toBeNull();
    // A double that adds someone already a Minter Admin can still be signed.
    expect(await guardSign(admin, doubles.alreadyAdmin.signature)).toBeNull();
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

  it('add admin: members propose themselves, admins also another member', async () => {
    const leo = signerFor('learner');
    // A member, level 2, not an admin: may propose themselves, and no one else.
    expect(await guardAddAdmin(leo, ADDR.learner)).toBeNull();
    expect(await guardAddAdmin(leo, ADDR.nominator)).toMatch(
      /^Only Minter Admins can propose another member\. Any member can propose themselves/
    );
    const admin = signerFor('admin');
    expect(await guardAddAdmin(admin, ADDR.nominator)).toBeNull();
    expect(await guardAddAdmin(admin, ADDR.newcomerName)).toBe(
      'Only MINTER members can become Minter Admins.'
    );
    expect(await guardAddAdmin(admin, ADDR.admin)).toBe('You’re already a Minter Admin.');
    expect(await guardAddAdmin(admin, ADDR.adminL4)).toBe('Already a Minter Admin.');
    // Pia Promote proposed herself, from another app: it is waiting for signatures.
    expect(await guardAddAdmin(admin, ADDR.promote)).toBe(
      'Making this member an admin is already waiting for signatures.'
    );
    expect(await guardAddAdmin(signerFor('promote'), ADDR.promote)).toBe(
      'Your proposal to become a Minter Admin is already waiting for signatures.'
    );
    // Not in MINTER: not even for themselves.
    expect(await guardAddAdmin(signerFor('newcomerName'), ADDR.newcomerName)).toMatch(
      /your account isn’t in MINTER/
    );
  });

  it('remove admin: admins remove another admin or step down; never the owner', async () => {
    const admin = signerFor('admin');
    expect(await guardRemoveAdmin(admin, ADDR.adminL4)).toBeNull();
    // Stepping down: their own removal.
    expect(await guardRemoveAdmin(admin, ADDR.admin)).toBeNull();
    expect(await guardRemoveAdmin(admin, ADDR.nominator)).toBe('Not a Minter Admin.');
    // Dex Demote's removal is already on its way.
    expect(await guardRemoveAdmin(admin, ADDR.demote)).toBe(
      'Removing this admin is already waiting for signatures.'
    );
    expect(await guardRemoveAdmin(admin, NULL_OWNER)).toBe(
      "MINTER's owner account can't be removed."
    );
    const leo = signerFor('learner');
    expect(await guardRemoveAdmin(leo, ADDR.adminL4)).toMatch(/^Only Minter Admins can do this/);
    expect(await guardRemoveAdmin(leo, ADDR.learner)).toBe('You’re not a Minter Admin right now.');
    expect(await guardRemoveAdmin(leo, NULL_OWNER)).toMatch(/owner account/);
  });

  it('cancel invite: needs a stored invite, and no cancellation already waiting', async () => {
    const admin = signerFor('admin');
    expect(await guardCancelInvite(admin, ADDR.learner)).toBe(
      'There is no approved invite stored for this account.'
    );
    // Its waiting cancellation names the invitee only in its raw bytes.
    expect(await guardCancelInvite(admin, fakeAddress('stale-1'))).toBe(
      'Cancelling this invite is already waiting for signatures.'
    );
    expect(await guardCancelInvite(admin, fakeAddress('stale-2'))).toBeNull();
    expect(await guardCancelInvite(signerFor('nominator'), fakeAddress('stale-2'))).toMatch(
      /Only Minter Admins/
    );
  });

  it("cancel invite: stops when a waiting cancellation's invitee can't be read", async () => {
    const { address, publicKey } = installWorld('admin');
    mockFetchRoute(/\/raw$/, () => new Response('', { status: 500 }));
    const admin = { address, publicKey };
    // stale-2 has no cancellation waiting, but the one that is waiting can't be read.
    await expect(guardCancelInvite(admin, fakeAddress('stale-2'))).rejects.toThrow(
      "Couldn't check the cancellations already waiting. Try again in a moment."
    );
    const result = await proposeAndSign(admin, {
      kind: 'cancelInvite',
      subject: fakeAddress('stale-2'),
    });
    expect(result.proposal).toEqual({
      status: 'failed',
      message: "Couldn't check the cancellations already waiting. Try again in a moment.",
    });
    expect(qortalCallsFor('CANCEL_GROUP_INVITE')).toHaveLength(0);
    // Other proposals don't depend on it.
    expect(await guardKick(admin, ADDR.learner)).toBeNull();
  });

  it('join: refuses members, banned accounts and a second request', async () => {
    expect(await guardJoin(signerFor('nominator'))).toMatch(/already in MINTER/);
    expect(await guardJoin(signerFor('banned'))).toMatch(/banned/);
    expect(await guardJoin(signerFor('nominatedSigning'))).toBe(
      "Your join request is already in: you're ready. Nothing more to send."
    );
    expect(await guardJoin(signerFor('nominatedWaiting'))).toBeNull();
  });

  it('join: one wording for an open join request, however it was sent', async () => {
    // Rae showed she's ready to mint, with no nomination: the same words as an accepted one.
    const { world, address, publicKey } = installWorld('ready');
    addReady(world);
    expect(await guardJoin({ address, publicKey })).toBe(
      "Your join request is already in: you're ready. Nothing more to send."
    );
    expect(await joinMinter({ address, publicKey })).toEqual({
      status: 'blocked',
      reason: "Your join request is already in: you're ready. Nothing more to send.",
    });
    expect(qortalCallsFor('JOIN_GROUP')).toHaveLength(0);
  });

  it('join: refuses while their own join request is still on its way into a block', async () => {
    const { world, address, publicKey } = installWorld('nominatedWaiting');
    const join = (groupId: number, fill: number) => ({
      type: 'JOIN_GROUP',
      timestamp: Date.now(),
      signature: base58Encode(new Uint8Array(64).fill(fill)),
      txGroupId: 0,
      groupId,
      creatorAddress: address,
      joinerPublicKey: publicKey,
    });
    // Another group's join request doesn't count.
    world.pending.push(join(2, 21));
    expect(await guardJoin({ address, publicKey })).toBeNull();
    world.pending.push(join(694, 22));
    expect(await guardJoin({ address, publicKey })).toBe(
      'Your join request is already on its way into a block. Check again in a minute or two.'
    );
    const outcome = await joinMinter({ address, publicKey });
    expect(outcome).toEqual({ status: 'blocked', reason: expect.stringMatching(/on its way/) });
    expect(qortalCallsFor('JOIN_GROUP')).toHaveLength(0);
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

  it('firstSignature stops before Hub when the balance cannot pay both fees', async () => {
    const { world, address, publicKey } = installWorld('admin');
    world.accounts.get(address).balance = 0.015;
    const result = await firstSignature({ address, publicKey }, ADDR.nominatedWaiting);
    expect(result.invite).toEqual({
      status: 'blocked',
      reason: 'This needs 0.02 QORT for the two fees, and your confirmed balance is 0.015 QORT.',
    });
    expect(qortalCalls.filter((c) => c.action !== 'GET_USER_ACCOUNT')).toHaveLength(0);
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

/** A just-sent, still unconfirmed MINTER proposal, as the node shows it. */
function sentProposal(
  world: ReturnType<typeof installWorld>['world'],
  admin: Signer,
  type: string,
  fields: Record<string, unknown>,
  fill: number
) {
  const tx = {
    type,
    timestamp: Date.now(),
    reference: base58Encode(new Uint8Array(64).fill(fill + 1)),
    signature: base58Encode(new Uint8Array(64).fill(fill)),
    txGroupId: 694,
    approvalStatus: 'PENDING',
    creatorAddress: admin.address,
    adminPublicKey: admin.publicKey,
    ...fields,
  };
  world.pending.push(tx);
  return tx;
}

describe('proposeAndSign: a proposal and the proposer’s own signature', () => {
  it('sends the proposal, waits for it on the node, then signs exactly that transaction', async () => {
    const { world, address, publicKey, posts } = installWorld('admin');
    const admin = { address, publicKey };
    let kick: { signature: string } | null = null;
    mockQortalRequest('KICK_FROM_GROUP', (req: Record<string, unknown>) => {
      kick = sentProposal(
        world,
        admin,
        'GROUP_KICK',
        { groupId: 694, member: req.qortalAddress, reason: req.reason },
        11
      );
      return kick;
    });
    mockQortalRequest('SIGN_TRANSACTION', () => ({ type: 'GROUP_APPROVAL', signature: 'OWN1' }));
    const steps: string[] = [];
    const step2Signatures = new Set<string | undefined>();
    const result = await proposeAndSign(
      admin,
      { kind: 'kick', subject: ADDR.learner, reason: 'Not minting' },
      (p) => {
        steps.push(`${p.step}:${p.stage}`);
        if (p.step === 2) step2Signatures.add(p.signature);
      }
    );
    expect(result.proposal.status).toBe('sent');
    expect(result.approval).toMatchObject({ status: 'sent', signature: 'OWN1' });
    expect(result.proposalSignature).toBe(kick!.signature);
    expect(qortalCallsFor('KICK_FROM_GROUP')).toEqual([
      expect.objectContaining({ groupId: 694, qortalAddress: ADDR.learner, txGroupId: 694 }),
    ]);
    const calls = qortalCallsFor('SIGN_TRANSACTION');
    expect(calls).toHaveLength(1);
    const bytes = base58Decode(String(calls[0].unsignedBytes));
    expect(base58Encode(bytes.slice(80, 112))).toBe(publicKey);
    expect(base58Encode(bytes.slice(112, 176))).toBe(kick!.signature);
    expect(bytes[176]).toBe(1);
    // Step 1 first, then step 2 waits for Hub.
    expect(steps[0]).toBe('1:checking');
    expect(steps.indexOf('1:waitingForHub')).toBeLessThan(steps.indexOf('2:checking'));
    expect(steps).toContain('2:waitingForHub');
    // Step 2 names the transaction it signs, so the dialog can show it.
    expect([...step2Signatures]).toEqual([kick!.signature]);
    // Both show as on their way.
    expect(getPendingWrite(writeKeys.propose('kick', ADDR.learner))?.status).toBe('confirming');
    expect(getPendingWrite(writeKeys.sign(kick!.signature))?.status).toBe('confirming');
    expect(posts).toEqual([]);
  });

  it('signs a new invite cancellation, whose invitee the node shows only in its raw bytes', async () => {
    const { world, address, publicKey } = installWorld('admin');
    const admin = { address, publicKey };
    const invitee = fakeAddress('stale-2');
    let cancel: { signature: string } | null = null;
    mockQortalRequest('CANCEL_GROUP_INVITE', (req: Record<string, unknown>) => {
      // Core's JSON leaves out the group and invitee.
      cancel = sentProposal(world, admin, 'CANCEL_GROUP_INVITE', {}, 12);
      world.cancelTargets.set(cancel.signature, { groupId: 694, invitee: req.qortalAddress });
      return cancel;
    });
    mockQortalRequest('SIGN_TRANSACTION', () => ({ type: 'GROUP_APPROVAL', signature: 'OWN2' }));
    const result = await proposeAndSign(admin, { kind: 'cancelInvite', subject: invitee });
    expect(qortalCallsFor('CANCEL_GROUP_INVITE')[0]).toMatchObject({
      groupId: 694,
      qortalAddress: invitee,
      txGroupId: 694,
    });
    expect(result.approval?.status).toBe('sent');
    const bytes = base58Decode(String(qortalCallsFor('SIGN_TRANSACTION')[0].unsignedBytes));
    expect(base58Encode(bytes.slice(112, 176))).toBe(cancel!.signature);
  });

  it('stops when the proposal is cancelled in Hub, and never asks for a signature', async () => {
    const { address, publicKey } = installWorld('admin');
    const result = await proposeAndSign(
      { address, publicKey },
      { kind: 'ban', subject: ADDR.learner, reason: 'Spam', banSeconds: 0 }
    );
    expect(result).toEqual({
      proposal: { status: 'declined' },
      approval: null,
      proposalSignature: null,
      withSignature: true,
    });
    expect(qortalCallsFor('BAN_FROM_GROUP')).toHaveLength(1);
    expect(qortalCallsFor('SIGN_TRANSACTION')).toHaveLength(0);
  });

  it('stops at the proposal’s own guard, before Hub', async () => {
    const { address, publicKey } = installWorld('admin');
    const result = await proposeAndSign(
      { address, publicKey },
      { kind: 'cancelInvite', subject: fakeAddress('stale-1') }
    );
    expect(result.proposal).toEqual({
      status: 'blocked',
      reason: 'Cancelling this invite is already waiting for signatures.',
    });
    expect(result.approval).toBeNull();
    expect(qortalCallsFor('CANCEL_GROUP_INVITE')).toHaveLength(0);
  });

  it('does not sign a proposal the node never shows, and says so', async () => {
    const { address, publicKey } = installWorld('admin');
    const signature = base58Encode(new Uint8Array(64).fill(13));
    mockQortalRequest('ADD_GROUP_ADMIN', () => ({ type: 'ADD_GROUP_ADMIN', signature }));
    const result = await proposeAndSign(
      { address, publicKey },
      { kind: 'addAdmin', subject: ADDR.nominator }
    );
    expect(result.proposal.status).toBe('sent');
    expect(result.proposalSignature).toBe(signature);
    expect(result.approval).toEqual({
      status: 'blocked',
      reason: 'Your node doesn’t show it yet.',
    });
    expect(qortalCallsFor('SIGN_TRANSACTION')).toHaveLength(0);
  });

  it('a member who isn’t an admin proposes themselves in one step: they can’t sign', async () => {
    const { world, address, publicKey, posts } = installWorld('learner');
    const leo = { address, publicKey };
    // One fee is enough: there is no signature to pay for.
    world.accounts.get(address).balance = 0.01;
    mockQortalRequest('ADD_GROUP_ADMIN', (req: Record<string, unknown>) =>
      sentProposal(world, leo, 'ADD_GROUP_ADMIN', { groupId: 694, member: req.qortalAddress }, 14)
    );
    const steps: string[] = [];
    const result = await proposeAndSign(leo, { kind: 'addAdmin', subject: address }, (p) =>
      steps.push(`${p.step}:${p.stage}`)
    );
    expect(result.withSignature).toBe(false);
    expect(result.proposal.status).toBe('sent');
    expect(result.approval).toBeNull();
    expect(result.proposalSignature).toBe(base58Encode(new Uint8Array(64).fill(14)));
    expect(qortalCallsFor('ADD_GROUP_ADMIN')).toEqual([
      expect.objectContaining({ groupId: 694, qortalAddress: address, txGroupId: 694 }),
    ]);
    expect(qortalCallsFor('SIGN_TRANSACTION')).toHaveLength(0);
    expect(steps.every((s) => s.startsWith('1:'))).toBe(true);
    expect(posts).toEqual([]);
  });

  it('a member can’t propose anyone else, and Hub is never asked', async () => {
    const { address, publicKey } = installWorld('learner');
    const result = await proposeAndSign(
      { address, publicKey },
      { kind: 'addAdmin', subject: ADDR.nominator }
    );
    expect(result.proposal).toMatchObject({
      status: 'blocked',
      reason: expect.stringMatching(/^Only Minter Admins can propose another member/),
    });
    expect(qortalCallsFor('ADD_GROUP_ADMIN')).toHaveLength(0);
  });

  it('an admin stepping down proposes it and signs it, like any admin proposal', async () => {
    const { world, address, publicKey } = installWorld('admin');
    const admin = { address, publicKey };
    let removal: { signature: string } | null = null;
    mockQortalRequest('REMOVE_GROUP_ADMIN', (req: Record<string, unknown>) => {
      removal = sentProposal(
        world,
        admin,
        'REMOVE_GROUP_ADMIN',
        { groupId: 694, admin: req.qortalAddress },
        15
      );
      return removal;
    });
    mockQortalRequest('SIGN_TRANSACTION', () => ({ type: 'GROUP_APPROVAL', signature: 'OWN3' }));
    const result = await proposeAndSign(admin, { kind: 'removeAdmin', subject: address });
    expect(result.withSignature).toBe(true);
    expect(qortalCallsFor('REMOVE_GROUP_ADMIN')[0]).toMatchObject({
      groupId: 694,
      qortalAddress: address,
      txGroupId: 694,
    });
    expect(result.approval).toMatchObject({ status: 'sent', signature: 'OWN3' });
    const bytes = base58Decode(String(qortalCallsFor('SIGN_TRANSACTION')[0].unsignedBytes));
    expect(base58Encode(bytes.slice(112, 176))).toBe(removal!.signature);
  });

  it('checks both fees before Hub opens', async () => {
    const { world, address, publicKey } = installWorld('admin');
    world.accounts.get(address).balance = 0.01;
    const result = await proposeAndSign(
      { address, publicKey },
      { kind: 'cancelBan', subject: ADDR.banned }
    );
    expect(result.proposal).toMatchObject({
      status: 'blocked',
      reason: expect.stringMatching(/0.02 QORT for the two fees/),
    });
    expect(qortalCallsFor('CANCEL_GROUP_BAN')).toHaveLength(0);
  });
});
