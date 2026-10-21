/**
 * Reject and Withdraw my signature: both a GROUP_APPROVAL with approval
 * false, behind the same chain checks as Sign plus the admin's own answers.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { base58Decode, base58Encode } from '../qortal/base58';
import { GROUP_APPROVAL_UNSIGNED_LENGTH } from '../qortal/approvalBytes';
import { loadDecisions } from '../data/decisions';
import { ADDR, MS_PER_BLOCK, NOW, TIP, installWorld } from '../test/world';
import { mockQortalRequest, qortalCallsFor } from '../test/setup';
import { guardReject, guardSign, guardWithdraw } from './guards';
import { rejectDecision, signDecision, withdrawSignature } from './flows';
import { getPendingWrite, writeKeys } from './optimistic';
import { SIGN_REJECTION_CHECK } from './explain';

afterEach(() => vi.useRealTimers());

type World = ReturnType<typeof installWorld>['world'];

/** One of the admin's answers on a pending transaction: confirmed at `height`, or on its way (null). */
function answer(
  world: World,
  who: { address: string; publicKey: string },
  pendingSignature: string,
  approval: boolean,
  height: number | null,
  fill: number
) {
  const row = {
    type: 'GROUP_APPROVAL',
    timestamp: height === null ? Date.now() : NOW - (TIP - height) * MS_PER_BLOCK,
    signature: base58Encode(new Uint8Array(64).fill(fill)),
    txGroupId: 0,
    ...(height === null ? {} : { blockHeight: height }),
    approvalStatus: 'NOT_REQUIRED',
    creatorAddress: who.address,
    adminPublicKey: who.publicKey,
    pendingSignature,
    approval,
  };
  (height === null ? world.unconfirmedApprovals : world.approvals).push(row);
  return row;
}

async function setUp(persona = 'admin') {
  const installed = installWorld(persona);
  const data = await loadDecisions();
  const of = (subject: string) => data.decisions.find((d) => d.subject === subject)!.signature;
  const admin = { address: installed.address, publicKey: installed.publicKey };
  return { ...installed, admin, of };
}

describe('guards for Reject and Withdraw', () => {
  it('Reject: for admins who have not signed, while it can still count', async () => {
    const { admin, of } = await setUp();
    expect(await guardReject(admin, of(ADDR.nominatedSigning))).toBeNull();
    expect(await guardReject(admin, of(ADDR.urgent))).toBe(
      "You've approved this. To take it back, press Reject on its card."
    );
    expect(await guardReject(admin, of(ADDR.late))).toBe(
      'Too late to count: the last block in which a rejection can count has passed.'
    );
    const learner = (await setUp('learner')).admin;
    expect(await guardReject(learner, of(ADDR.nominatedSigning))).toMatch(/Only Minter Admins/);
  });

  it('Reject once: a confirmed rejection stops another, and Sign is still possible', async () => {
    const { world, admin, of } = await setUp();
    const pending = of(ADDR.nominatedSigning);
    answer(world, admin, pending, false, TIP - 20, 41);
    expect(await guardReject(admin, pending)).toBe("You've already rejected this.");
    expect(await guardWithdraw(admin, pending)).toBe(
      'Your latest answer on chain is already a rejection.'
    );
    // Only the latest answer counts: signing replaces the rejection.
    expect(await guardSign(admin, pending)).toBeNull();
  });

  it('Withdraw: only a confirmed signature, and not while one is on its way', async () => {
    const { world, admin, of } = await setUp();
    expect(await guardWithdraw(admin, of(ADDR.urgent))).toBeNull();
    expect(await guardWithdraw(admin, of(ADDR.nominatedSigning))).toBe(
      "You haven't approved this, so there's no approval to take back."
    );
    expect(await guardWithdraw(admin, of(ADDR.late))).toMatch(/^Too late to count/);
    // A signature still on its way can't be withdrawn yet.
    answer(world, admin, of(ADDR.kickTarget), true, null, 42);
    expect(await guardWithdraw(admin, of(ADDR.kickTarget))).toBe(
      'Your approval is still on its way into a block. You can reject once it is in.'
    );
    expect(await guardReject(admin, of(ADDR.kickTarget))).toBe(
      'Your approval is still on its way into a block. You can reject once it is in.'
    );
  });

  it('a rejection on its way stops a second one, and a signature until it is in', async () => {
    const { world, admin, of } = await setUp();
    const pending = of(ADDR.banTarget);
    answer(world, admin, pending, false, null, 43);
    expect(await guardReject(admin, pending)).toBe(
      'Your rejection is already on its way. It counts once it is in a block.'
    );
    expect(await guardSign(admin, pending)).toBe(
      'Your rejection is still on its way into a block. You can approve once it is in.'
    );
  });

  it('a withdrawn signature can be signed again', async () => {
    const { world, admin, of } = await setUp();
    const pending = of(ADDR.urgent); // the admin signed it at TIP - 9,000
    answer(world, admin, pending, false, TIP - 30, 44);
    expect(await guardSign(admin, pending)).toBeNull();
    expect(await guardWithdraw(admin, pending)).toBe(
      'Your latest answer on chain is already a rejection.'
    );
  });
});

describe('rejectDecision and withdrawSignature', () => {
  it('Reject builds approval 0 for the pending signature and shows it confirming', async () => {
    const { admin, of, posts } = await setUp();
    const pending = of(ADDR.nominatedSigning);
    mockQortalRequest('SIGN_TRANSACTION', () => ({ type: 'GROUP_APPROVAL', signature: 'REJ1' }));
    const outcome = await rejectDecision(admin, pending);
    expect(outcome).toMatchObject({ status: 'sent', signature: 'REJ1' });
    const call = qortalCallsFor('SIGN_TRANSACTION')[0];
    expect(call.process).toBe(true);
    const bytes = base58Decode(String(call.unsignedBytes));
    expect(bytes).toHaveLength(GROUP_APPROVAL_UNSIGNED_LENGTH);
    expect(new DataView(bytes.buffer).getInt32(0)).toBe(33);
    expect(base58Encode(bytes.slice(80, 112))).toBe(admin.publicKey);
    expect(base58Encode(bytes.slice(112, 176))).toBe(pending);
    expect(bytes[176]).toBe(0);
    expect(getPendingWrite(writeKeys.reject(pending))?.status).toBe('confirming');
    expect(getPendingWrite(writeKeys.sign(pending))).toBeNull();
    expect(posts).toEqual([]);
  });

  it('Withdraw builds approval 0 after the admin’s signature', async () => {
    const { admin, of } = await setUp();
    const pending = of(ADDR.urgent);
    mockQortalRequest('SIGN_TRANSACTION', () => ({ type: 'GROUP_APPROVAL', signature: 'W1' }));
    const outcome = await withdrawSignature(admin, pending);
    expect(outcome).toMatchObject({ status: 'sent', signature: 'W1' });
    const bytes = base58Decode(String(qortalCallsFor('SIGN_TRANSACTION')[0].unsignedBytes));
    expect(base58Encode(bytes.slice(112, 176))).toBe(pending);
    expect(bytes[176]).toBe(0);
    expect(getPendingWrite(writeKeys.withdraw(pending))?.status).toBe('confirming');
  });

  it('stops before Hub when there is nothing to withdraw', async () => {
    const { admin, of } = await setUp();
    const outcome = await withdrawSignature(admin, of(ADDR.nominatedSigning));
    expect(outcome).toEqual({
      status: 'blocked',
      reason: "You haven't approved this, so there's no approval to take back.",
    });
    expect(qortalCallsFor('SIGN_TRANSACTION')).toHaveLength(0);
    expect(getPendingWrite(writeKeys.withdraw(of(ADDR.nominatedSigning)))).toBeNull();
  });

  it('a decline in Hub sends nothing and leaves no confirming state', async () => {
    const { admin, of } = await setUp();
    const pending = of(ADDR.nominatedSigning);
    expect(await rejectDecision(admin, pending)).toEqual({ status: 'declined' });
    expect(getPendingWrite(writeKeys.reject(pending))).toBeNull();
  });

  it('after a Hub timeout, finds the rejection, never a signature', async () => {
    const { world, admin, of } = await setUp();
    const pending = of(ADDR.nominatedSigning);
    mockQortalRequest('SIGN_TRANSACTION', () => {
      answer(world, admin, pending, false, null, 45);
      throw { error: 'timeout', message: 'Request timed out after 30000 ms' };
    });
    const found = await rejectDecision(admin, pending);
    expect(found).toMatchObject({
      status: 'sent',
      recovered: true,
      signature: base58Encode(new Uint8Array(64).fill(45)),
    });

    const second = await setUp();
    const other = second.of(ADDR.banTarget);
    mockQortalRequest('SIGN_TRANSACTION', () => {
      // Only a signature shows up: it is not this rejection.
      answer(second.world, second.admin, other, true, null, 46);
      throw { error: 'timeout', message: 'Request timed out after 30000 ms' };
    });
    expect((await rejectDecision(second.admin, other)).status).toBe('unknown');
  });

  it('after a Hub timeout, Sign finds the signature, never a rejection', async () => {
    const { world, admin, of } = await setUp();
    const pending = of(ADDR.nominatedSigning);
    mockQortalRequest('SIGN_TRANSACTION', () => {
      answer(world, admin, pending, false, null, 47);
      throw { error: 'timeout', message: 'Request timed out after 30000 ms' };
    });
    expect((await signDecision(admin, pending)).status).toBe('unknown');
  });

  it('tells the admin to check "approval": false in Hub', () => {
    expect(SIGN_REJECTION_CHECK).toContain('"approval": false.');
    expect(SIGN_REJECTION_CHECK).toContain('Tx type: GROUP_APPROVAL.');
  });
});
