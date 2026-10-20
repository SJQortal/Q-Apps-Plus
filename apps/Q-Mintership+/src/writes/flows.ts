/**
 * The write flows the screens call. Each one guards, sends through Hub,
 * marks the optimistic state, and invalidates the reads it changes.
 * Screens explain each Hub dialog before calling these (writes/explain.ts).
 *
 * Nothing here runs in tests against a node: every qortalRequest is mocked.
 */
import { formatQort, getBalance, getFee, getLastReference } from '../data/accounts';
import { getChainNow } from '../data/chain';
import { ATOMIC_PER_QORT, MINTER_GROUP_ID } from '../data/constants';
import { getTransaction } from '../data/txs';
import {
  buildConsidering,
  buildNomination,
  buildSupport,
  consideringIdentifier,
  consideringKey,
  nominationIdentifier,
  supportIdentifier,
  type ConsideringTarget,
  type NominationInput,
} from '../data/records';
import type { GroupTxType, TxRow } from '../data/types';
import {
  buildDecisionVote,
  buildVote,
  newDecisionVoteIdentifier,
  newVoteIdentifier,
  type CommunityVoteValue,
  type DecisionVoteKind,
} from '../data/voteRecords';
import { chainsOwnSignature } from '../rules/adminChange';
import { decisionSubject } from '../rules/decision';
import { groupApprovalUnsignedBase58, groupRejectionUnsignedBase58 } from '../qortal/approvalBytes';
import {
  guardAddAdmin,
  guardBan,
  guardCancelBan,
  guardCancelInvite,
  guardCommunityVote,
  guardConsidering,
  guardDecisionVote,
  guardDecline,
  guardInvite,
  guardJoin,
  guardJoinGroup,
  guardKick,
  guardNominate,
  guardReject,
  guardRemoveAdmin,
  guardSign,
  guardSupport,
  guardWithdraw,
  isMinterAdmin,
} from './guards';
import {
  addAdminRequest,
  banRequest,
  cancelBanRequest,
  cancelInviteRequest,
  inviteRequest,
  joinGroupRequest,
  joinRequest,
  kickRequest,
  publishRecordRequest,
  removeAdminRequest,
  signApprovalRequest,
  type HubRequest,
} from './hubActions';
import { CHAIN_PREFIXES, invalidateReads } from './chainReads';
import { clearWrite, markWrite, writeKeys } from './optimistic';
import { runWrite, type Signer, type WriteOutcome, type WriteStage } from './runner';

/** A Considering record changes only who is considering (and the balance it costs). */
const CONSIDERING_PREFIXES: readonly string[] = ['considering:', 'balance:'];
/** A community vote changes only the votes (and the balance). */
const COMMUNITY_VOTE_PREFIXES: readonly string[] = ['communityvotes:', 'balance:'];

/**
 * Marks the write while it is sent and confirmed, and once Hub answers
 * invalidates the reads it can change (`prefixes`, every chain read by
 * default).
 */
async function tracked(
  key: string,
  run: () => Promise<WriteOutcome>,
  prefixes: readonly string[] = CHAIN_PREFIXES
): Promise<WriteOutcome> {
  markWrite(key, 'sending');
  const outcome = await run();
  if (outcome.status === 'sent') {
    markWrite(key, 'confirming', { signature: outcome.signature ?? undefined });
    invalidateReads(prefixes);
  } else if (outcome.status === 'unknown') {
    markWrite(key, 'failed', { message: outcome.message });
    invalidateReads(prefixes);
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

/**
 * The GROUP_APPROVAL request with approval false (Reject, or Withdraw my
 * signature), built from fresh reads with the rejection's own builder.
 */
export async function buildRejectionRequest(
  signer: Signer,
  pendingSignature: string
): Promise<HubRequest> {
  const [reference, fee] = await Promise.all([
    getLastReference(signer.address),
    getFee('GROUP_APPROVAL'),
  ]);
  const unsignedBytes = groupRejectionUnsignedBase58({
    timestamp: Date.now(),
    reference,
    adminPublicKey: signer.publicKey,
    pendingSignature,
    approval: false,
    feeAtomic: fee.atomic,
  });
  return signApprovalRequest(unsignedBytes);
}

/** This write's GROUP_APPROVAL on `pendingSignature`, with this answer (after a Hub timeout). */
const answerMatch = (pendingSignature: string, approval: boolean) => (tx: TxRow) =>
  tx.type === 'GROUP_APPROVAL' &&
  tx.pendingSignature === pendingSignature &&
  tx.approval === approval;

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
      match: answerMatch(pendingSignature, true),
      onStage,
    })
  );
}

/**
 * Reject a pending MINTER transaction the admin hasn't signed: a
 * GROUP_APPROVAL with approval false. It counts towards ending it as
 * rejected (against the same target as signatures) and cancels nobody
 * else's signature. The admin can still sign later: only their latest
 * answer counts.
 */
export function rejectDecision(
  signer: Signer,
  pendingSignature: string,
  onStage?: (s: WriteStage) => void
): Promise<WriteOutcome> {
  return tracked(writeKeys.reject(pendingSignature), () =>
    runWrite({
      request: () => buildRejectionRequest(signer, pendingSignature),
      signer,
      precheck: () => guardReject(signer, pendingSignature),
      match: answerMatch(pendingSignature, false),
      onStage,
    })
  );
}

/**
 * Withdraw the admin's signature: on chain the same GROUP_APPROVAL with
 * approval false, sent after their signature. Only the latest answer
 * counts, so the signature stops counting and a rejection counts instead.
 */
export function withdrawSignature(
  signer: Signer,
  pendingSignature: string,
  onStage?: (s: WriteStage) => void
): Promise<WriteOutcome> {
  return tracked(writeKeys.withdraw(pendingSignature), () =>
    runWrite({
      request: () => buildRejectionRequest(signer, pendingSignature),
      signer,
      precheck: () => guardWithdraw(signer, pendingSignature),
      match: answerMatch(pendingSignature, false),
      onStage,
    })
  );
}

export interface OwnSignatureProgress {
  step: 1 | 2;
  stage: WriteStage;
  /** Step 2: the signature of the transaction step 1 made, the one being signed. */
  signature?: string;
}

export interface OwnSignatureOutcome {
  /** Step 1: the proposal (or a nomination's invite). */
  proposal: WriteOutcome;
  /** Step 2: the admin's own signature on it. Null when step 1 didn't send. */
  approval: WriteOutcome | null;
  /** The new transaction's signature, once step 1 sent it. */
  proposalSignature: string | null;
}

/**
 * The fees of several transactions against the confirmed balance: the total
 * and the balance when the balance can't pay them all, otherwise null (and
 * null when they can't be read: each write's own check reads them again and
 * says what went wrong). Quiet by design: nothing is shown unless it is short.
 */
export async function feesShortfall(
  signer: Signer,
  txTypes: GroupTxType[]
): Promise<{ total: string; balance: string } | null> {
  if (!signer.address || !txTypes.length) return null;
  try {
    const [fees, balance] = await Promise.all([
      Promise.all(txTypes.map((type) => getFee(type))),
      getBalance(signer.address, { force: true }),
    ]);
    const total = fees.reduce((sum, fee) => sum + fee.atomic, 0) / ATOMIC_PER_QORT;
    return balance < total ? { total: formatQort(total), balance: formatQort(balance) } : null;
  } catch {
    return null;
  }
}

/** Why the balance can't pay both fees (step 1's and the signature's), or null. */
async function bothFeesProblem(signer: Signer, txType: GroupTxType): Promise<string | null> {
  const short = await feesShortfall(signer, [txType, 'GROUP_APPROVAL']);
  return short
    ? `This needs ${short.total} for the two fees, and your confirmed balance is ${short.balance}.`
    : null;
}

/**
 * Step 1 makes a MINTER transaction; step 2 is the admin's own signature on
 * exactly that transaction, because in MINTER an admin's own proposal is not
 * approved by itself. Step 2 waits until the node knows the new transaction.
 * If step 1 goes through and step 2 doesn't, the transaction is still
 * waiting for signatures and can be signed from the queue like any other.
 */
async function withOwnSignature(
  signer: Signer,
  txType: GroupTxType,
  step1: (onStage: (s: WriteStage) => void) => Promise<WriteOutcome>,
  onProgress?: (p: OwnSignatureProgress) => void
): Promise<OwnSignatureOutcome> {
  onProgress?.({ step: 1, stage: 'checking' });
  const short = await bothFeesProblem(signer, txType);
  if (short)
    return {
      proposal: { status: 'blocked', reason: short },
      approval: null,
      proposalSignature: null,
    };
  const proposal = await step1((stage) => onProgress?.({ step: 1, stage }));
  if (proposal.status !== 'sent') return { proposal, approval: null, proposalSignature: null };
  const signature = proposal.signature;
  if (!signature)
    return {
      proposal,
      approval: {
        status: 'blocked',
        reason: 'Hub didn’t say which transaction it sent, so it can’t be approved from here.',
      },
      proposalSignature: null,
    };
  onProgress?.({ step: 2, stage: 'checking', signature });
  if (!(await waitForTransaction(signature)))
    return {
      proposal,
      approval: { status: 'blocked', reason: 'Your node doesn’t show it yet.' },
      proposalSignature: signature,
    };
  const approval = await signDecision(signer, signature, (stage) =>
    onProgress?.({ step: 2, stage, signature })
  );
  return { proposal, approval, proposalSignature: signature };
}

export type FirstSignatureProgress = OwnSignatureProgress;

export interface FirstSignatureOutcome {
  invite: WriteOutcome;
  /** Null when step 1 didn't send. */
  approval: WriteOutcome | null;
  inviteSignature: string | null;
}

/**
 * The first Minter Admin's signature: step 1 creates the GROUP_INVITE
 * (txGroupId 694), step 2 is their own signature on it. The clock starts
 * when the invite is in a block.
 */
export async function firstSignature(
  signer: Signer,
  nominee: string,
  onProgress?: (p: FirstSignatureProgress) => void
): Promise<FirstSignatureOutcome> {
  const result = await withOwnSignature(
    signer,
    'GROUP_INVITE',
    (onStage) =>
      tracked(writeKeys.invite(nominee), () =>
        runWrite({
          request: inviteRequest(nominee),
          signer,
          precheck: () => guardInvite(signer, nominee),
          match: (tx) => tx.type === 'GROUP_INVITE' && decisionSubject(tx) === nominee,
          onStage,
        })
      ),
    onProgress
  );
  return {
    invite: result.proposal,
    approval: result.approval,
    inviteSignature: result.proposalSignature,
  };
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

/** A kick; with `decline`, of someone who asked to join and isn't a member (guardDecline). */
export function proposeKick(
  signer: Signer,
  member: string,
  reason: string,
  onStage?: (s: WriteStage) => void,
  decline = false
): Promise<WriteOutcome> {
  return tracked(writeKeys.propose('kick', member), () =>
    runWrite({
      request: kickRequest(member, reason),
      signer,
      precheck: () => (decline ? guardDecline(signer, member) : guardKick(signer, member)),
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
      // The group and invitee come from the raw bytes (the runner fills them in).
      match: (tx) =>
        tx.type === 'CANCEL_GROUP_INVITE' &&
        tx.groupId === MINTER_GROUP_ID &&
        tx.invitee === invitee,
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

/**
 * What can be proposed about one account, with what each kind needs: all of
 * it by Minter Admins, and an admin role for themselves by any MINTER member.
 */
export type Proposal =
  /** `decline`: their join request, under guardDecline (the same KICK_FROM_GROUP). */
  | { kind: 'kick'; subject: string; reason: string; decline?: boolean }
  | { kind: 'ban'; subject: string; reason: string; banSeconds: number }
  | { kind: 'addAdmin' | 'removeAdmin' | 'cancelBan' | 'cancelInvite'; subject: string };

export type ProposalKind = Proposal['kind'];

/** The MINTER transaction each kind of proposal creates. */
export const PROPOSAL_TX_TYPE: Record<ProposalKind, GroupTxType> = {
  kick: 'GROUP_KICK',
  ban: 'GROUP_BAN',
  addAdmin: 'ADD_GROUP_ADMIN',
  removeAdmin: 'REMOVE_GROUP_ADMIN',
  cancelBan: 'CANCEL_GROUP_BAN',
  cancelInvite: 'CANCEL_GROUP_INVITE',
};

/** Send one proposal through its own guard (step 1 of proposeAndSign). */
export function propose(
  signer: Signer,
  p: Proposal,
  onStage?: (s: WriteStage) => void
): Promise<WriteOutcome> {
  switch (p.kind) {
    case 'kick':
      return proposeKick(signer, p.subject, p.reason, onStage, p.decline);
    case 'ban':
      return proposeBan(signer, p.subject, p.reason, p.banSeconds, onStage);
    case 'addAdmin':
      return proposeAddAdmin(signer, p.subject, onStage);
    case 'removeAdmin':
      return proposeRemoveAdmin(signer, p.subject, onStage);
    case 'cancelBan':
      return proposeCancelBan(signer, p.subject, onStage);
    case 'cancelInvite':
      return proposeCancelInvite(signer, p.subject, onStage);
  }
}

export interface ProposalOutcome extends OwnSignatureOutcome {
  /**
   * Whether the proposer's own signature was part of it. Only a Minter
   * Admin's is: a member who isn't one can't sign (rules/adminChange.ts).
   */
  withSignature: boolean;
}

/**
 * A proposal, then the proposer's own signature on it when they are a
 * Minter Admin (read fresh): two Hub confirmations as one guided step, as
 * for a nomination's first signature. A member who isn't an admin (Become
 * a Minter Admin) can't sign, so for them it is the proposal alone, and the
 * Minter Admins decide.
 */
export async function proposeAndSign(
  signer: Signer,
  p: Proposal,
  onProgress?: (progress: OwnSignatureProgress) => void
): Promise<ProposalOutcome> {
  onProgress?.({ step: 1, stage: 'checking' });
  if (!chainsOwnSignature(await isMinterAdmin(signer.address))) {
    const proposal = await propose(signer, p, (stage) => onProgress?.({ step: 1, stage }));
    return {
      proposal,
      approval: null,
      proposalSignature: proposal.status === 'sent' ? proposal.signature : null,
      withSignature: false,
    };
  }
  const result = await withOwnSignature(
    signer,
    PROPOSAL_TX_TYPE[p.kind],
    (onStage) => propose(signer, p, onStage),
    onProgress
  );
  return { ...result, withSignature: true };
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
        tx.type === 'JOIN_GROUP' &&
        tx.groupId === MINTER_GROUP_ID &&
        tx.creatorAddress === signer.address,
      onStage,
    })
  );
}

/**
 * Join a group other than MINTER (the Explorer's group cards, Simon,
 * 2026-10-17): an open group at once, a closed one as a join request its
 * admins decide on. The same JOIN_GROUP either way.
 */
export function joinGroup(
  signer: Signer,
  group: { groupId: number; isOpen?: boolean },
  onStage?: (s: WriteStage) => void
): Promise<WriteOutcome> {
  return tracked(writeKeys.joinGroup(signer.address, group.groupId), () =>
    runWrite({
      request: joinGroupRequest(group.groupId),
      signer,
      precheck: () => guardJoinGroup(signer, group),
      match: (tx) =>
        tx.type === 'JOIN_GROUP' &&
        Number(tx.groupId) === group.groupId &&
        tx.creatorAddress === signer.address,
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

/**
 * Considering ("I've looked at this, not sure yet"), or with `cleared`
 * "No longer considering": a small QDN record under the admin's name. It
 * changes nothing on chain; a later signature or rejection replaces it.
 */
export async function publishConsidering(
  signer: Signer & { name: string | null },
  target: ConsideringTarget,
  options: { note?: string; cleared?: boolean } = {},
  onStage?: (s: WriteStage) => void
): Promise<WriteOutcome> {
  let key: string;
  try {
    key = consideringKey(target);
  } catch (error) {
    return { status: 'blocked', reason: error instanceof Error ? error.message : String(error) };
  }
  const writeKey = options.cleared ? writeKeys.notConsidering(key) : writeKeys.considering(key);
  // Only the Considering reads change: the chain views keep their own pace.
  return tracked(
    writeKey,
    async () => {
      let record;
      try {
        record = buildConsidering(target, options);
      } catch (error) {
        return {
          status: 'blocked',
          reason: error instanceof Error ? error.message : String(error),
        };
      }
      const identifier = consideringIdentifier(target);
      return runWrite({
        request: publishRecordRequest(signer.name ?? '', identifier, record),
        signer,
        precheck: () => guardConsidering(signer, target, Boolean(options.cleared)),
        match: (tx) => tx.type === 'ARBITRARY' && tx.identifier === identifier,
        onStage,
      });
    },
    CONSIDERING_PREFIXES
  );
}

/**
 * A community vote, Yes or No, on an open nomination from someone who isn't
 * a Minter Admin: a new small QDN record under their name each time (the
 * newest counts). Advisory: nothing on chain follows from it.
 */
export async function publishCommunityVote(
  signer: Signer & { name: string | null },
  nominee: string,
  vote: CommunityVoteValue,
  onStage?: (s: WriteStage) => void
): Promise<WriteOutcome> {
  // Only the votes change: the chain views keep their own pace.
  return tracked(
    writeKeys.communityVote(nominee, vote),
    async () => {
      let record;
      let identifier: string;
      try {
        record = buildVote(nominee, vote);
        identifier = newVoteIdentifier(nominee, vote);
      } catch (error) {
        return {
          status: 'blocked',
          reason: error instanceof Error ? error.message : String(error),
        };
      }
      return runWrite({
        request: publishRecordRequest(signer.name ?? '', identifier, record),
        signer,
        precheck: () => guardCommunityVote(signer, nominee),
        match: (tx) => tx.type === 'ARBITRARY' && tx.identifier === identifier,
        onStage,
      });
    },
    COMMUNITY_VOTE_PREFIXES
  );
}

/**
 * A community vote, Yes (for it) or No, on a proposal to remove a member,
 * ban an account or make a Minter Admin, from someone who isn't a Minter
 * Admin: a new small QDN record under their name each time (the newest
 * counts). Advisory: nothing on chain follows from it.
 */
export async function publishDecisionVote(
  signer: Signer & { name: string | null },
  kind: DecisionVoteKind,
  subject: string,
  vote: CommunityVoteValue,
  onStage?: (s: WriteStage) => void
): Promise<WriteOutcome> {
  return tracked(
    writeKeys.communityVote(subject, vote, kind),
    async () => {
      let record;
      let identifier: string;
      try {
        record = buildDecisionVote(kind, subject, vote);
        identifier = newDecisionVoteIdentifier(kind, subject, vote);
      } catch (error) {
        return {
          status: 'blocked',
          reason: error instanceof Error ? error.message : String(error),
        };
      }
      return runWrite({
        request: publishRecordRequest(signer.name ?? '', identifier, record),
        signer,
        precheck: () => guardDecisionVote(signer, kind, subject),
        match: (tx) => tx.type === 'ARBITRARY' && tx.identifier === identifier,
        onStage,
      });
    },
    COMMUNITY_VOTE_PREFIXES
  );
}

/** Minter Admin polls (writes/adminPolls.ts): asked, voted, commented and shared through Hub. */
export {
  commentAdminPoll,
  deleteAdminPollComment,
  editAdminPollComment,
  publishAdminPoll,
  shareAdminPoll,
  voteAdminPoll,
  type AskInput,
  type PollAuthor,
  type PollCommentRef,
  type PollWrite,
} from './adminPolls';
