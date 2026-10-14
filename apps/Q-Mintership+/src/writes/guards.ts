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
import { loadDecisions } from '../data/decisions';
import { loadNominationsFor } from '../data/nominations';
import type { ConsideringTarget } from '../data/records';
import {
  getApprovalsInRange,
  getPending,
  getTransaction,
  getUnconfirmedApprovals,
  getUnconfirmedBy,
  getUnconfirmedOfTypes,
  withCancelInviteTargets,
} from '../data/txs';
import type { GroupTxType, TxRow } from '../data/types';
import {
  decisionSubject,
  isMinterGroupChange,
  isUnusualApprovalRoute,
  toApprovalRow,
} from '../rules/decision';
import { adminChangeBlock, adminChangeBlockText, type AdminChangeKind } from '../rules/adminChange';
import { isRemovalDouble } from '../rules/double';
import { NOMINEE_BLOCK_TEXT, isOpenState, nomineeBlock, nominatorBlock } from '../rules/nomination';
import { latestPerSigner, type ApprovalRow } from '../rules/tally';
import { decisionWindow, windowPhase } from '../rules/timing';
import type { Signer } from './runner';

/** Whether `address` is a Minter Admin right now (a fresh read). */
export async function isMinterAdmin(address: string): Promise<boolean> {
  const admins = await getAdmins({ force: true });
  return admins.admins.some((a) => a.member === address);
}

/**
 * A waiting (pending or still unconfirmed) MINTER transaction of `type`
 * about `subject`. Throws when a waiting invite cancellation's invitee can't
 * be read: it could be this one, so nothing goes ahead on a guess.
 */
export async function findWaiting(type: GroupTxType, subject: string): Promise<TxRow | null> {
  const [pending, unconfirmed] = await Promise.all([
    getPending({ force: true }),
    getUnconfirmedOfTypes([type], { force: true }),
  ]);
  // Cancelled invites carry their group and invitee only in their raw bytes.
  const rows = [...pending.rows, ...unconfirmed.rows];
  const all = type === 'CANCEL_GROUP_INVITE' ? await withCancelInviteTargets(rows) : rows;
  if (
    type === 'CANCEL_GROUP_INVITE' &&
    all.some((tx) => tx.type === 'CANCEL_GROUP_INVITE' && typeof tx.groupId !== 'number')
  )
    throw new Error("Couldn't check the cancellations already waiting. Try again in a moment.");
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
  return (await isMinterAdmin(signer.address))
    ? null
    : 'Only Minter Admins can do this, and your account is not one right now.';
}

/**
 * What an admin's GROUP_APPROVAL says: Sign (approval true), Reject (false,
 * not signed), or Withdraw my signature (false, sent after their signature).
 */
export type DecisionIntent = 'sign' | 'reject' | 'withdraw';

/** Before signing (GROUP_APPROVAL, approval true) a pending MINTER transaction. */
export function guardSign(signer: Signer, pendingSignature: string): Promise<string | null> {
  return guardDecision(signer, pendingSignature, 'sign');
}

/** Before rejecting (approval false) a pending MINTER transaction the admin hasn't signed. */
export function guardReject(signer: Signer, pendingSignature: string): Promise<string | null> {
  return guardDecision(signer, pendingSignature, 'reject');
}

/** Before withdrawing a signature (approval false, after the admin's own signature). */
export function guardWithdraw(signer: Signer, pendingSignature: string): Promise<string | null> {
  return guardDecision(signer, pendingSignature, 'withdraw');
}

const TOO_LATE: Record<DecisionIntent, string> = {
  sign: 'Too late to count: the last block in which a signature can count has passed.',
  reject: 'Too late to count: the last block in which a rejection can count has passed.',
  withdraw:
    'Too late to count: the last block in which withdrawing a signature can count has passed.',
};

/**
 * The checks every answer shares (still an admin, still pending, a MINTER
 * group change, not too late), then the admin's own answers on it: the
 * newest one still on its way, then their latest confirmed one.
 */
export async function guardDecision(
  signer: Signer,
  pendingSignature: string,
  intent: DecisionIntent
): Promise<string | null> {
  const notAdmin = await requireAdmin(signer);
  if (notAdmin) return notAdmin;
  const tx = await getTransaction(pendingSignature, { force: true });
  if (!tx) return "This transaction isn't on your node yet. Wait a moment and refresh.";
  if (isUnusualApprovalRoute(tx))
    return "This one can't be signed here. Check it with the other Minter Admins.";
  if (tx.txGroupId !== MINTER_GROUP_ID)
    return "This transaction isn't waiting for MINTER's approval.";
  const [target] = await withCancelInviteTargets([tx]);
  if (!isMinterGroupChange(target))
    return "This isn't a MINTER group change, so it can't be signed here.";
  if (tx.approvalStatus && tx.approvalStatus !== 'PENDING') {
    return `This has already been decided (${tx.approvalStatus.toLowerCase().replace('_', ' ')}).`;
  }
  if (intent === 'sign' && tx.type === 'REMOVE_GROUP_ADMIN') {
    const problem = await removalDoubleProblem(tx);
    if (problem) return problem;
  }
  if (typeof tx.blockHeight === 'number') {
    const [group, now] = await Promise.all([getGroupInfo(), getChainNow({ force: true })]);
    const phase = windowPhase(decisionWindow(tx.blockHeight, group), now.height);
    if (phase === 'tooLate' || phase === 'expired') return TOO_LATE[intent];
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
  const flying = latestPerSigner(mine).get(signer.publicKey);
  if (flying) return inFlightProblem(intent, flying.approval);
  // A confirmed answer of yours: look it up through the transaction's own search window.
  const latestMine = await myLatestConfirmedDecision(signer, pendingSignature, tx);
  return confirmedProblem(intent, latestMine ? latestMine.approval : null);
}

/**
 * Sign is never sent on a removal that is a double (rules/double.ts), read
 * fresh: Reject stays, or it runs out.
 */
async function removalDoubleProblem(tx: TxRow): Promise<string | null> {
  const data = await loadDecisions({ force: true });
  const d = data.decisions.find((x) => x.signature === tx.signature);
  if (!d || !isRemovalDouble(d)) return null;
  return d.double?.reason === 'duplicate'
    ? 'The same removal is already waiting in an earlier proposal: answer that one instead.'
    : "There's nothing to remove: they aren't a Minter Admin. Reject it, or let it run out.";
}

/** The admin's newest answer is still on its way into a block. */
function inFlightProblem(intent: DecisionIntent, approval: boolean): string {
  if (approval) {
    return intent === 'sign'
      ? 'Your signature is already on its way. It counts once it is in a block.'
      : 'Your signature is still on its way into a block. You can withdraw it once it is in.';
  }
  return intent === 'sign'
    ? 'Your rejection is still on its way into a block. You can sign once it is in.'
    : 'Your rejection is already on its way. It counts once it is in a block.';
}

/** The admin's latest confirmed answer (null: none yet) against what they want to do. */
function confirmedProblem(intent: DecisionIntent, approval: boolean | null): string | null {
  switch (intent) {
    case 'sign':
      return approval === true ? "You've already signed this." : null;
    case 'reject':
      if (approval === true)
        return "You've signed this. To take your signature back, use Withdraw my signature.";
      return approval === false ? "You've already rejected this." : null;
    case 'withdraw':
      if (approval === false) return 'Your latest answer on chain is already a rejection.';
      return approval === null
        ? "You haven't signed this, so there's no signature to withdraw."
        : null;
  }
}

async function myLatestConfirmedDecision(
  signer: Signer,
  pendingSignature: string,
  tx: TxRow
): Promise<ApprovalRow | null> {
  if (typeof tx.blockHeight !== 'number') return null;
  const now = await getChainNow();
  const rows = (
    await getApprovalsInRange(tx.blockHeight - 10, now.height, { force: true, slot: 'guard' })
  ).rows
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
  if (stored) return 'This person was already approved: they only need to press Join now.';
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

/**
 * Before proposing to decline a join request: a kick of someone who asked to
 * join MINTER and isn't a member, which takes their request away once the
 * Minter Admins sign it.
 */
export async function guardDecline(signer: Signer, address: string): Promise<string | null> {
  const notAdmin = await requireAdmin(signer);
  if (notAdmin) return notAdmin;
  const [membership, joinRequest, kick, invite] = await Promise.all([
    getMembership(address, { force: true }),
    getJoinRequestFor(address, { force: true }),
    findWaiting('GROUP_KICK', address),
    findWaiting('GROUP_INVITE', address),
  ]);
  if (membership.isAdmin)
    return 'This is a Minter Admin, in MINTER already: there’s no join request to decline.';
  if (membership.isMember)
    return 'Already in MINTER, so there’s no join request to decline. To remove them, use Remove a member.';
  if (!joinRequest)
    return 'This account hasn’t asked to join MINTER, so there’s no join request to decline.';
  if (kick) return 'Declining this join request is already waiting for signatures.';
  if (invite)
    return 'A nomination for them is collecting signatures. Reject that one instead, or let it run out.';
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

/** Before proposing to cancel an approved invite. */
export async function guardCancelInvite(signer: Signer, invitee: string): Promise<string | null> {
  const notAdmin = await requireAdmin(signer);
  if (notAdmin) return notAdmin;
  const [stored, waiting] = await Promise.all([
    getStoredInviteFor(invitee, { force: true }),
    findWaiting('CANCEL_GROUP_INVITE', invitee),
  ]);
  if (!stored) return 'There is no approved invite stored for this account.';
  if (waiting) return 'Cancelling this invite is already waiting for signatures.';
  return null;
}

/**
 * Before a change to the Minter Admins, under the app's rules
 * (rules/adminChange.ts): a member may propose themselves, an admin may
 * propose another member or step down, and only admins may propose
 * removing another admin.
 */
async function guardAdminChange(
  signer: Signer,
  kind: AdminChangeKind,
  subject: string
): Promise<string | null> {
  const self = subject === signer.address;
  const [proposerIsAdmin, membership, waiting] = await Promise.all([
    isMinterAdmin(signer.address),
    getMembership(subject, { force: true }),
    findWaiting(kind === 'addAdmin' ? 'ADD_GROUP_ADMIN' : 'REMOVE_GROUP_ADMIN', subject),
  ]);
  const block = adminChangeBlock({
    kind,
    self,
    proposerIsAdmin,
    subjectIsMember: membership.isMember,
    subjectIsAdmin: membership.isAdmin,
    subjectIsOwner: subject === NULL_OWNER,
    waiting: Boolean(waiting),
  });
  return block ? adminChangeBlockText(block, kind, self) : null;
}

/** Before proposing a new Minter Admin: yourself as a member, or another member as an admin. */
export function guardAddAdmin(signer: Signer, member: string): Promise<string | null> {
  return guardAdminChange(signer, 'addAdmin', member);
}

/** Before proposing to remove a Minter Admin: another one as an admin, or yourself (stepping down). */
export async function guardRemoveAdmin(signer: Signer, admin: string): Promise<string | null> {
  if (admin === NULL_OWNER) return adminChangeBlockText('owner', 'removeAdmin', false);
  return guardAdminChange(signer, 'removeAdmin', admin);
}

/**
 * Before the JOIN_GROUP (Accept nomination / Join now / Show you're ready to
 * mint). Core lists a join request only once it is in a block, so the
 * account's own unconfirmed ones are checked too: one sent a moment ago
 * (or before a reload) is never sent twice.
 */
export async function guardJoin(signer: Signer): Promise<string | null> {
  const [membership, bans, joinRequest, unconfirmed] = await Promise.all([
    getMembership(signer.address, { force: true }),
    getBans({ force: true }),
    getJoinRequestFor(signer.address, { force: true }),
    getUnconfirmedBy(signer.publicKey, 'JOIN_GROUP'),
  ]);
  if (membership.isMember) return "You're already in MINTER.";
  if (activeBanFor(bans, signer.address))
    return 'Your account is banned from MINTER, so it can’t join until the ban is lifted.';
  // The same words however the request was sent (Accept nomination, or Show you're ready to mint).
  if (joinRequest) return "Your join request is already in: you're ready. Nothing more to send.";
  if (unconfirmed.some((tx) => tx.type === 'JOIN_GROUP' && Number(tx.groupId) === MINTER_GROUP_ID))
    return 'Your join request is already on its way into a block. Check again in a minute or two.';
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
    return 'There is no open nomination for this person to support. You can propose a nomination for them instead.';
  if (open.nomination?.publisher.address === signer.address)
    return 'You nominated this person already.';
  return null;
}

/**
 * Before publishing Considering (or "No longer considering"): a current
 * Minter Admin with a registered name to publish under. Considering needs
 * the decision still pending and able to count, or the nomination still
 * waiting for its first signature; clearing is always allowed.
 */
export async function guardConsidering(
  signer: Signer & { name?: string | null },
  target: ConsideringTarget,
  cleared: boolean
): Promise<string | null> {
  const notAdmin = await requireAdmin(signer);
  if (notAdmin) return notAdmin;
  if (!signer.name)
    return 'Considering is published under your registered name, and your account has none yet.';
  if (cleared) return null;
  if ('pendingSignature' in target) {
    const tx = await getTransaction(target.pendingSignature, { force: true });
    if (!tx || (tx.approvalStatus && tx.approvalStatus !== 'PENDING'))
      return 'This decision isn’t waiting for signatures any more.';
    if (typeof tx.blockHeight === 'number') {
      const [group, now] = await Promise.all([getGroupInfo(), getChainNow({ force: true })]);
      const phase = windowPhase(decisionWindow(tx.blockHeight, group), now.height);
      if (phase === 'tooLate' || phase === 'expired')
        return 'Too late: signatures and rejections can no longer count on this one.';
    }
    return null;
  }
  const nominations = await loadNominationsFor(target.nomineeAddress, { force: true });
  return nominations.some((n) => n.state === 'waiting')
    ? null
    : 'This nomination isn’t waiting for a first signature any more.';
}
