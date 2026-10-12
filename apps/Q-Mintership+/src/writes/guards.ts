/**
 * Guards: re-read the chain right before a write and stop it, in plain
 * words, if it would fail or duplicate something. Every read here is forced
 * fresh. Each guard returns a reason, or null to go ahead.
 */
import { getAccount, getPrimaryName } from '../data/accounts';
import { getChainNow } from '../data/chain';
import { BAN_MAX_SECONDS, MINTER_GROUP_ID, NULL_OWNER } from '../data/constants';
import {
  activeBanFor,
  getAdmins,
  getBans,
  getGroupInfo,
  getJoinRequestFor,
  getMembership,
  getStoredInviteFor,
} from '../data/group';
import { loadNominationsFor } from '../data/nominations';
import {
  getApprovalsInRange,
  getPending,
  getTransaction,
  getUnconfirmedApprovals,
  getUnconfirmedOfTypes,
} from '../data/txs';
import type { GroupTxType, TxRow } from '../data/types';
import { decisionSubject, isUnusualApprovalRoute, toApprovalRow } from '../rules/decision';
import { NOMINEE_BLOCK_TEXT, isOpenState, nomineeBlock, nominatorBlock } from '../rules/nomination';
import { latestPerSigner, type ApprovalRow } from '../rules/tally';
import { decisionWindow, windowPhase } from '../rules/timing';
import type { Signer } from './runner';

async function isAdmin(address: string): Promise<boolean> {
  const admins = await getAdmins({ force: true });
  return admins.admins.some((a) => a.member === address);
}

/** A waiting (pending or still unconfirmed) MINTER transaction of `type` about `subject`. */
export async function findWaiting(type: GroupTxType, subject: string): Promise<TxRow | null> {
  const [pending, unconfirmed] = await Promise.all([
    getPending({ force: true }),
    getUnconfirmedOfTypes([type], { force: true }),
  ]);
  const all = [...pending.rows, ...unconfirmed.rows];
  return (
    all.find(
      (tx) =>
        tx.type === type &&
        decisionSubject(tx) === subject &&
        (tx.groupId === undefined || tx.groupId === MINTER_GROUP_ID) &&
        (tx.approvalStatus === undefined || tx.approvalStatus === 'PENDING')
    ) ?? null
  );
}

async function requireAdmin(signer: Signer): Promise<string | null> {
  return (await isAdmin(signer.address))
    ? null
    : 'Only Minter Admins can do this, and your account is not one right now.';
}

/** Before signing (GROUP_APPROVAL) a pending MINTER transaction. */
export async function guardSign(signer: Signer, pendingSignature: string): Promise<string | null> {
  const notAdmin = await requireAdmin(signer);
  if (notAdmin) return notAdmin;
  const tx = await getTransaction(pendingSignature, { force: true });
  if (!tx) return "This transaction isn't on your node yet. Wait a moment and refresh.";
  if (isUnusualApprovalRoute(tx))
    return "This one can't be signed here. Check it with the other Minter Admins.";
  if (tx.txGroupId !== MINTER_GROUP_ID)
    return "This transaction isn't waiting for MINTER's approval.";
  if (tx.approvalStatus && tx.approvalStatus !== 'PENDING') {
    return `This has already been decided (${tx.approvalStatus.toLowerCase().replace('_', ' ')}).`;
  }
  if (typeof tx.blockHeight === 'number') {
    const [group, now] = await Promise.all([getGroupInfo(), getChainNow({ force: true })]);
    const phase = windowPhase(decisionWindow(tx.blockHeight, group), now.height);
    if (phase === 'tooLate' || phase === 'expired') {
      return 'Too late to count: the last block in which a signature can count has passed.';
    }
  }
  const unconfirmed = await getUnconfirmedApprovals({ force: true });
  const mine = unconfirmed.rows
    .map(toApprovalRow)
    .filter(
      (r): r is ApprovalRow =>
        r !== null &&
        r.pendingSignature === pendingSignature &&
        r.adminPublicKey === signer.publicKey
    );
  if (mine.some((r) => r.approval))
    return 'Your signature is already on its way. It counts once it is in a block.';
  // A confirmed signature of yours: look it up through the transaction's own search window.
  const latestMine = await myLatestConfirmedDecision(signer, pendingSignature, tx);
  if (latestMine?.approval) return "You've already signed this.";
  return null;
}

async function myLatestConfirmedDecision(
  signer: Signer,
  pendingSignature: string,
  tx: TxRow
): Promise<ApprovalRow | null> {
  if (typeof tx.blockHeight !== 'number') return null;
  const now = await getChainNow();
  const rows = (await getApprovalsInRange(tx.blockHeight - 10, now.height, { force: true })).rows
    .map(toApprovalRow)
    .filter(
      (r): r is ApprovalRow =>
        r !== null &&
        r.pendingSignature === pendingSignature &&
        r.adminPublicKey === signer.publicKey
    );
  return latestPerSigner(rows).get(signer.publicKey) ?? null;
}

/** Before the first signature: creating the GROUP_INVITE for a nominee. */
export async function guardInvite(signer: Signer, nominee: string): Promise<string | null> {
  const notAdmin = await requireAdmin(signer);
  if (notAdmin) return notAdmin;
  if (nominee === signer.address) return "You can't invite yourself.";
  const [membership, bans, stored, waiting] = await Promise.all([
    getMembership(nominee, { force: true }),
    getBans({ force: true }),
    getStoredInviteFor(nominee, { force: true }),
    findWaiting('GROUP_INVITE', nominee),
  ]);
  if (membership.isMember) return 'Already in MINTER.';
  if (activeBanFor(bans, nominee))
    return 'This account is banned from MINTER. The ban has to be lifted first.';
  if (waiting)
    return 'A nomination for this person is already waiting for signatures. Sign that one instead.';
  if (stored) return 'This person was already approved: they only need to press Join.';
  return null;
}

/** Before proposing a kick. */
export async function guardKick(signer: Signer, member: string): Promise<string | null> {
  const notAdmin = await requireAdmin(signer);
  if (notAdmin) return notAdmin;
  const [membership, joinRequest, waiting] = await Promise.all([
    getMembership(member, { force: true }),
    getJoinRequestFor(member, { force: true }),
    findWaiting('GROUP_KICK', member),
  ]);
  if (membership.isAdmin)
    return 'Minter Admins can’t be removed directly. Propose removing their admin role first.';
  if (!membership.isMember && !joinRequest) return 'Not in MINTER, and no join request to decline.';
  if (waiting) return 'A removal for this member is already waiting for signatures.';
  return null;
}

/** Before proposing a ban. `banSeconds` 0 = permanent. */
export async function guardBan(
  signer: Signer,
  offender: string,
  banSeconds: number
): Promise<string | null> {
  if (!Number.isInteger(banSeconds) || banSeconds < 0 || banSeconds > BAN_MAX_SECONDS) {
    return 'Choose a permanent ban, or a length of up to 24 days.';
  }
  const notAdmin = await requireAdmin(signer);
  if (notAdmin) return notAdmin;
  if (offender === signer.address) return "You can't ban yourself.";
  const [membership, bans, waiting] = await Promise.all([
    getMembership(offender, { force: true }),
    getBans({ force: true }),
    findWaiting('GROUP_BAN', offender),
  ]);
  if (membership.isAdmin)
    return 'Minter Admins can’t be banned directly. Propose removing their admin role first.';
  if (activeBanFor(bans, offender)) return 'Already banned.';
  if (waiting) return 'A ban for this account is already waiting for signatures.';
  return null;
}

/** Before proposing to lift a ban. */
export async function guardCancelBan(signer: Signer, member: string): Promise<string | null> {
  const notAdmin = await requireAdmin(signer);
  if (notAdmin) return notAdmin;
  const [bans, waiting] = await Promise.all([
    getBans({ force: true }),
    findWaiting('CANCEL_GROUP_BAN', member),
  ]);
  if (!activeBanFor(bans, member)) return 'This account has no ban in force.';
  if (waiting) return 'Lifting this ban is already waiting for signatures.';
  return null;
}

/**
 * Before proposing to cancel an approved invite. Core's answers leave the
 * invitee out of CANCEL_GROUP_INVITE rows, so other admins' proposals can't
 * be matched by person; the caller shows how many are waiting.
 */
export async function guardCancelInvite(signer: Signer, invitee: string): Promise<string | null> {
  const notAdmin = await requireAdmin(signer);
  if (notAdmin) return notAdmin;
  const stored = await getStoredInviteFor(invitee, { force: true });
  if (!stored) return 'There is no approved invite stored for this account.';
  return null;
}

/** Before proposing a new Minter Admin. */
export async function guardAddAdmin(signer: Signer, member: string): Promise<string | null> {
  const notAdmin = await requireAdmin(signer);
  if (notAdmin) return notAdmin;
  const [membership, waiting] = await Promise.all([
    getMembership(member, { force: true }),
    findWaiting('ADD_GROUP_ADMIN', member),
  ]);
  if (!membership.isMember) return 'Only MINTER members can become Minter Admins.';
  if (membership.isAdmin) return 'Already a Minter Admin.';
  if (waiting) return 'Making this member an admin is already waiting for signatures.';
  return null;
}

/** Before proposing to remove a Minter Admin. */
export async function guardRemoveAdmin(signer: Signer, admin: string): Promise<string | null> {
  const notAdmin = await requireAdmin(signer);
  if (notAdmin) return notAdmin;
  if (admin === NULL_OWNER) return "MINTER's owner account can't be removed.";
  const [membership, waiting] = await Promise.all([
    getMembership(admin, { force: true }),
    findWaiting('REMOVE_GROUP_ADMIN', admin),
  ]);
  if (!membership.isAdmin) return 'Not a Minter Admin.';
  if (waiting) return 'Removing this admin is already waiting for signatures.';
  return null;
}

/** Before the nominee's JOIN_GROUP (Accept nomination / Join now). */
export async function guardJoin(signer: Signer): Promise<string | null> {
  const [membership, bans, joinRequest] = await Promise.all([
    getMembership(signer.address, { force: true }),
    getBans({ force: true }),
    getJoinRequestFor(signer.address, { force: true }),
  ]);
  if (membership.isMember) return "You're already in MINTER.";
  if (activeBanFor(bans, signer.address))
    return 'Your account is banned from MINTER, so it can’t join until the ban is lifted.';
  if (joinRequest)
    return "You've already accepted: your join request is waiting for the Minter Admins.";
  return null;
}

/** Who is nominating: a level 5+ member or an admin, with a name to publish under. */
async function nominatorProblem(signer: Signer): Promise<string | null> {
  const [membership, account, name] = await Promise.all([
    getMembership(signer.address, { force: true }),
    getAccount(signer.address, { force: true }),
    getPrimaryName(signer.address).catch(() => null),
  ]);
  return nominatorBlock({
    isMember: membership.isMember,
    isAdmin: membership.isAdmin,
    level: account.level,
    hasName: Boolean(name),
  });
}

/** Before publishing a nomination record. */
export async function guardNominate(signer: Signer, nominee: string): Promise<string | null> {
  const who = await nominatorProblem(signer);
  if (who) return who;
  const [membership, bans, stored, waiting, nominations] = await Promise.all([
    getMembership(nominee, { force: true }),
    getBans({ force: true }),
    getStoredInviteFor(nominee, { force: true }),
    findWaiting('GROUP_INVITE', nominee),
    loadNominationsFor(nominee, { force: true }),
  ]);
  const block = nomineeBlock({
    self: nominee === signer.address,
    isMember: membership.isMember,
    activeBan: Boolean(activeBanFor(bans, nominee)),
    pendingInvite: Boolean(waiting),
    storedInvite: Boolean(stored),
    openNomination: nominations.some((n) => isOpenState(n.state)),
  });
  return block ? NOMINEE_BLOCK_TEXT[block] : null;
}

/** Before publishing a support record. */
export async function guardSupport(signer: Signer, nominee: string): Promise<string | null> {
  const who = await nominatorProblem(signer);
  if (who) return who;
  if (nominee === signer.address) return "You can't support your own nomination.";
  const nominations = await loadNominationsFor(nominee, { force: true });
  const open = nominations.find((n) => isOpenState(n.state));
  if (!open)
    return 'There is no open nomination for this person to support. You can nominate them instead.';
  if (open.nomination?.publisher.address === signer.address)
    return 'You nominated this person already.';
  return null;
}
