/**
 * The write flows the screens call. Each one guards, sends through Hub,
 * marks the optimistic state, and invalidates the reads it changes.
 * Screens explain each Hub dialog before calling these (writes/explain.ts).
 *
 * Nothing here runs in tests against a node: every qortalRequest is mocked.
 */
import { getFee, getLastReference } from '../data/accounts';
import { getChainNow } from '../data/chain';
import { getTransaction } from '../data/txs';
import { invalidate } from '../data/query';
import {
  buildNomination,
  buildSupport,
  nominationIdentifier,
  supportIdentifier,
  type NominationInput,
} from '../data/records';
import type { TxRow } from '../data/types';
import { decisionSubject } from '../rules/decision';
import { groupApprovalUnsignedBase58 } from '../qortal/approvalBytes';
import {
  guardAddAdmin,
  guardBan,
  guardCancelBan,
  guardCancelInvite,
  guardInvite,
  guardJoin,
  guardKick,
  guardNominate,
  guardRemoveAdmin,
  guardSign,
  guardSupport,
} from './guards';
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
  type HubRequest,
} from './hubActions';
import { clearWrite, markWrite, writeKeys } from './optimistic';
import { runWrite, type Signer, type WriteOutcome, type WriteStage } from './runner';

/** Reads every chain write can change. */
function invalidateChainReads(): void {
  for (const prefix of [
    'decisions:',
    'pending:',
    'unconfirmed:',
    'approvals:',
    'nominations:',
    'status:',
    'membership:',
    'joinrequest:',
    'invite:',
    'group:',
    'history:',
    'tx:',
    'balance:',
    'qdnsearch:',
  ]) {
    invalidate(prefix);
  }
}

async function tracked(key: string, run: () => Promise<WriteOutcome>): Promise<WriteOutcome> {
  markWrite(key, 'sending');
  const outcome = await run();
  if (outcome.status === 'sent') {
    markWrite(key, 'confirming', { signature: outcome.signature ?? undefined });
    invalidateChainReads();
  } else if (outcome.status === 'unknown') {
    markWrite(key, 'failed', { message: outcome.message });
    invalidateChainReads();
  } else {
    clearWrite(key);
  }
  return outcome;
}

/** The GROUP_APPROVAL request for a pending transaction, built from fresh reads. */
export async function buildApprovalRequest(
  signer: Signer,
  pendingSignature: string
): Promise<HubRequest> {
  const [reference, fee] = await Promise.all([
    getLastReference(signer.address),
    getFee('GROUP_APPROVAL'),
  ]);
  const unsignedBytes = groupApprovalUnsignedBase58({
    timestamp: Date.now(),
    reference,
    adminPublicKey: signer.publicKey,
    pendingSignature,
    approval: true,
    feeAtomic: fee.atomic,
  });
  return signApprovalRequest(unsignedBytes);
}

/** Sign (approve) a pending MINTER transaction. */
export function signDecision(
  signer: Signer,
  pendingSignature: string,
  onStage?: (s: WriteStage) => void
): Promise<WriteOutcome> {
  return tracked(writeKeys.sign(pendingSignature), () =>
    runWrite({
      request: () => buildApprovalRequest(signer, pendingSignature),
      signer,
      precheck: () => guardSign(signer, pendingSignature),
      match: (tx) => tx.type === 'GROUP_APPROVAL' && tx.pendingSignature === pendingSignature,
      onStage,
    })
  );
}

export interface FirstSignatureProgress {
  step: 1 | 2;
  stage: WriteStage;
}

export interface FirstSignatureOutcome {
  invite: WriteOutcome;
  /** Null when step 1 didn't send. */
  approval: WriteOutcome | null;
  inviteSignature: string | null;
}

/**
 * The first Minter Admin's signature: step 1 creates the GROUP_INVITE
 * (txGroupId 694), step 2 approves it, because in MINTER an admin's own
 * proposal is not approved automatically. The clock starts when the invite
 * is in a block. If step 2 doesn't go through, the invite is still waiting
 * and the admin can sign it like any other decision.
 */
export async function firstSignature(
  signer: Signer,
  nominee: string,
  onProgress?: (p: FirstSignatureProgress) => void
): Promise<FirstSignatureOutcome> {
  const invite = await tracked(writeKeys.invite(nominee), () =>
    runWrite({
      request: inviteRequest(nominee),
      signer,
      precheck: () => guardInvite(signer, nominee),
      match: (tx) => tx.type === 'GROUP_INVITE' && decisionSubject(tx) === nominee,
      onStage: (stage) => onProgress?.({ step: 1, stage }),
    })
  );
  const inviteSignature = invite.status === 'sent' ? invite.signature : null;
  if (!inviteSignature) return { invite, approval: null, inviteSignature: null };
  onProgress?.({ step: 2, stage: 'checking' });
  await waitForTransaction(inviteSignature);
  const approval = await signDecision(signer, inviteSignature, (stage) =>
    onProgress?.({ step: 2, stage })
  );
  return { invite, approval, inviteSignature };
}

let txWaitDelays = [1_000, 2_000, 3_000, 4_000];

/** Tests shorten the wait for a just-sent transaction. */
export function setTxWaitDelays(delays: number[]): void {
  txWaitDelays = delays;
}

/** Wait (about 10 s at most) until the node knows a transaction Hub just sent. */
async function waitForTransaction(signature: string): Promise<boolean> {
  for (const delay of [0, ...txWaitDelays]) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    if (await getTransaction(signature, { force: true })) return true;
  }
  return false;
}

/** Sign several decisions one after another; each is its own Hub confirmation. Stops on a decline. */
export async function bulkSign(
  signer: Signer,
  pendingSignatures: string[],
  onItem: (index: number, outcome: WriteOutcome | null, stage?: WriteStage) => void
): Promise<WriteOutcome[]> {
  const outcomes: WriteOutcome[] = [];
  for (let i = 0; i < pendingSignatures.length; i++) {
    onItem(i, null, 'checking');
    const outcome = await signDecision(signer, pendingSignatures[i], (stage) =>
      onItem(i, null, stage)
    );
    outcomes.push(outcome);
    onItem(i, outcome);
    if (outcome.status === 'declined') break;
  }
  return outcomes;
}

const subjectMatch = (type: string, subject: string) => (tx: TxRow) =>
  tx.type === type && decisionSubject(tx) === subject;

export function proposeKick(
  signer: Signer,
  member: string,
  reason: string,
  onStage?: (s: WriteStage) => void
): Promise<WriteOutcome> {
  return tracked(writeKeys.propose('kick', member), () =>
    runWrite({
      request: kickRequest(member, reason),
      signer,
      precheck: () => guardKick(signer, member),
      match: subjectMatch('GROUP_KICK', member),
      onStage,
    })
  );
}

export function proposeBan(
  signer: Signer,
  offender: string,
  reason: string,
  banSeconds: number,
  onStage?: (s: WriteStage) => void
): Promise<WriteOutcome> {
  return tracked(writeKeys.propose('ban', offender), () =>
    runWrite({
      request: () => Promise.resolve(banRequest(offender, reason, banSeconds)),
      signer,
      precheck: () => guardBan(signer, offender, banSeconds),
      match: subjectMatch('GROUP_BAN', offender),
      onStage,
    })
  );
}

export function proposeCancelBan(
  signer: Signer,
  member: string,
  onStage?: (s: WriteStage) => void
): Promise<WriteOutcome> {
  return tracked(writeKeys.propose('cancelBan', member), () =>
    runWrite({
      request: cancelBanRequest(member),
      signer,
      precheck: () => guardCancelBan(signer, member),
      match: subjectMatch('CANCEL_GROUP_BAN', member),
      onStage,
    })
  );
}

export function proposeCancelInvite(
  signer: Signer,
  invitee: string,
  onStage?: (s: WriteStage) => void
): Promise<WriteOutcome> {
  return tracked(writeKeys.propose('cancelInvite', invitee), () =>
    runWrite({
      request: cancelInviteRequest(invitee),
      signer,
      precheck: () => guardCancelInvite(signer, invitee),
      // Core leaves the invitee out of these rows: match on type and creator time only.
      match: (tx) => tx.type === 'CANCEL_GROUP_INVITE',
      onStage,
    })
  );
}

export function proposeAddAdmin(
  signer: Signer,
  member: string,
  onStage?: (s: WriteStage) => void
): Promise<WriteOutcome> {
  return tracked(writeKeys.propose('addAdmin', member), () =>
    runWrite({
      request: addAdminRequest(member),
      signer,
      precheck: () => guardAddAdmin(signer, member),
      match: subjectMatch('ADD_GROUP_ADMIN', member),
      onStage,
    })
  );
}

export function proposeRemoveAdmin(
  signer: Signer,
  admin: string,
  onStage?: (s: WriteStage) => void
): Promise<WriteOutcome> {
  return tracked(writeKeys.propose('removeAdmin', admin), () =>
    runWrite({
      request: removeAdminRequest(admin),
      signer,
      precheck: () => guardRemoveAdmin(signer, admin),
      match: subjectMatch('REMOVE_GROUP_ADMIN', admin),
      onStage,
    })
  );
}

/** The nominee's JOIN_GROUP: "Accept nomination" before approval, "Join now" after it. */
export function joinMinter(
  signer: Signer,
  onStage?: (s: WriteStage) => void
): Promise<WriteOutcome> {
  return tracked(writeKeys.join(signer.address), () =>
    runWrite({
      request: joinRequest(),
      signer,
      precheck: () => guardJoin(signer),
      match: (tx) =>
        tx.type === 'JOIN_GROUP' && tx.groupId === 694 && tx.creatorAddress === signer.address,
      onStage,
    })
  );
}

/** Publish a nomination record under the nominator's name. */
export async function publishNomination(
  signer: Signer & { name: string },
  input: Omit<NominationInput, 'createdHeight' | 'created'>,
  onStage?: (s: WriteStage) => void
): Promise<WriteOutcome> {
  return tracked(writeKeys.nominate(input.nomineeAddress), async () => {
    const now = await getChainNow().catch(() => null);
    let record;
    try {
      record = buildNomination({ ...input, createdHeight: now?.height ?? 0, created: Date.now() });
    } catch (error) {
      return { status: 'blocked', reason: error instanceof Error ? error.message : String(error) };
    }
    return runWrite({
      request: publishRecordRequest(
        signer.name,
        nominationIdentifier(input.nomineeAddress),
        record
      ),
      signer,
      precheck: () => guardNominate(signer, input.nomineeAddress),
      match: (tx) =>
        tx.type === 'ARBITRARY' && tx.identifier === nominationIdentifier(input.nomineeAddress),
      onStage,
    });
  });
}

/** Publish a support record for an open nomination. */
export async function publishSupport(
  signer: Signer & { name: string },
  nomineeAddress: string,
  note: string | undefined,
  onStage?: (s: WriteStage) => void
): Promise<WriteOutcome> {
  return tracked(writeKeys.support(nomineeAddress), async () => {
    let record;
    try {
      record = buildSupport(nomineeAddress, note);
    } catch (error) {
      return { status: 'blocked', reason: error instanceof Error ? error.message : String(error) };
    }
    return runWrite({
      request: publishRecordRequest(signer.name, supportIdentifier(nomineeAddress), record),
      signer,
      precheck: () => guardSupport(signer, nomineeAddress),
      match: (tx) => tx.type === 'ARBITRARY' && tx.identifier === supportIdentifier(nomineeAddress),
      onStage,
    });
  });
}
