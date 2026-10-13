/**
 * The status engine: who the signed-in account is, as far as MINTER is
 * concerned, so Home can speak to them (docs/apps/Q-Mintership+.md → Statuses).
 *
 * Order (first match wins):
 *   outside Hub → signed out → Minter Admin → member (level 5+ / 0–4) →
 *   banned → approved invite not used → nominated → former member
 *   (kicked / left) → not in MINTER yet.
 */
import { levelProgress, type LevelProgress } from './levels';
import { BAN_MAX_SECONDS, NOMINATOR_MIN_LEVEL } from '../data/constants';
import type { BanRow, InviteRow, TxRow } from '../data/types';
import type { Nomination } from '../data/nominations';
import { nominatorBlock } from './nomination';

export type StatusKind =
  | 'outsideHub'
  | 'signedOut'
  | 'admin'
  | 'memberNominator'
  | 'member'
  | 'formerBanned'
  | 'approvedInvite'
  | 'nominated'
  | 'formerKicked'
  | 'formerLeft'
  | 'newcomer';

export interface Removal {
  kind: 'kick' | 'ban' | 'leave';
  /** When it took effect (ms, estimated from the approval block for kicks and bans). */
  at: number;
  height: number | null;
  /** The admin who proposed it (kick, ban). */
  by: string | null;
  reason?: string;
  signature: string;
  /** A ban's length in seconds (0 = permanent). */
  banSeconds?: number;
  /** A ban the Minter Admins lifted (an approved CANCEL_GROUP_BAN after it): when (ms). */
  liftedAt?: number;
  /**
   * A timed ban whose end has passed: when it ended (ms). Its length counts
   * from when it was proposed, as Core records it; never before it took
   * effect. Only bans up to 24 days get a date.
   */
  endedAt?: number;
}

/** How a ban that is no longer in force ended. */
export interface BanEnd {
  how: 'lifted' | 'ended';
  /**
   * When (ms); null when the history doesn't date it (a permanent ban, or one
   * longer than 24 days, with no lift found).
   */
  at: number | null;
}

/**
 * How a removal by a ban ended, for an account the ban no longer holds:
 * lifted by the Minter Admins, or a timed ban past its end (whichever came
 * first). Null for a kick or leaving.
 */
export function banEnd(removal: Removal): BanEnd | null {
  if (removal.kind !== 'ban') return null;
  // A timed ban that ran out before the lift was approved ended then.
  const { endedAt, liftedAt } = removal;
  if (endedAt !== undefined && (liftedAt === undefined || endedAt <= liftedAt))
    return { how: 'ended', at: endedAt };
  if (liftedAt !== undefined) return { how: 'lifted', at: liftedAt };
  return { how: 'ended', at: null };
}

export interface MyStatus {
  kind: StatusKind;
  address: string;
  name: string | null;
  level: number;
  /** Blocks minted as Core counts them for levels. */
  blocksMinted: number;
  progress: LevelProgress;
  isMember: boolean;
  isAdmin: boolean;
  /** The account sent JOIN_GROUP and the request is open. */
  hasJoinRequest: boolean;
  activeBan: BanRow | null;
  storedInvite: InviteRow | null;
  /** The newest way the account left MINTER, if it ever did. */
  removal: Removal | null;
  /** The account was in MINTER before (evidence: an approved invite before the removal). */
  wasMember: boolean;
  /** The open nomination for this account. */
  nomination: Nomination | null;
  canNominate: boolean;
  /** Why not, in plain words (null when they can). */
  nominateBlock: string | null;
}

export interface StatusInputs {
  hub: 'outside' | 'signedOut' | 'signedIn';
  address: string;
  name: string | null;
  level: number;
  blocksMinted: number;
  isMember: boolean;
  isAdmin: boolean;
  hasJoinRequest: boolean;
  activeBan: BanRow | null;
  storedInvite: InviteRow | null;
  /** The account's confirmed MINTER transactions (any role). */
  history: TxRow[];
  /** Open nominations for this account (waiting, signing, approved, blocked). */
  nominations: Nomination[];
  msPerBlock: number;
  tip: { height: number; timestamp: number };
}

/** The time a decided transaction took effect, estimated from its approval block. */
function effectiveTime(tx: TxRow, tip: StatusInputs['tip'], msPerBlock: number): number {
  const height = typeof tx.approvalHeight === 'number' ? tx.approvalHeight : tx.blockHeight;
  if (typeof height !== 'number') return tx.timestamp;
  return tip.timestamp - (tip.height - height) * msPerBlock;
}

const DONE = new Set(['APPROVED', 'NOT_REQUIRED']);

/** The account's newest removal from MINTER: an approved kick or ban about it, or its own LEAVE_GROUP. */
export function latestRemoval(
  address: string,
  history: TxRow[],
  tip: StatusInputs['tip'],
  msPerBlock: number
): Removal | null {
  let best: Removal | null = null;
  for (const tx of history) {
    if (!DONE.has(String(tx.approvalStatus))) continue;
    let kind: Removal['kind'] | null = null;
    if (tx.type === 'GROUP_KICK' && tx.member === address) kind = 'kick';
    else if (tx.type === 'GROUP_BAN' && tx.offender === address) kind = 'ban';
    else if (tx.type === 'LEAVE_GROUP' && tx.creatorAddress === address) kind = 'leave';
    if (!kind) continue;
    const at = effectiveTime(tx, tip, msPerBlock);
    if (!best || at > best.at) {
      best = {
        kind,
        at,
        height:
          typeof tx.approvalHeight === 'number' ? tx.approvalHeight : (tx.blockHeight ?? null),
        by: kind === 'leave' ? null : (tx.creatorAddress ?? null),
        reason: typeof tx.reason === 'string' ? tx.reason : undefined,
        signature: tx.signature,
        ...(kind === 'ban' ? banTiming(tx, at, tip) : {}),
      };
    }
  }
  if (best?.kind === 'ban') {
    const liftedAt = banLiftedAt(address, history, best.at, tip, msPerBlock);
    if (liftedAt !== null) best = { ...best, liftedAt };
  }
  return best;
}

/** A ban's length, and for a timed one already over, when it ended (`at`: when it took effect). */
function banTiming(
  tx: TxRow,
  at: number,
  tip: StatusInputs['tip']
): Pick<Removal, 'banSeconds' | 'endedAt'> {
  const banSeconds = Number(tx.timeToLive ?? 0);
  // Only bans up to 24 days get a date; a longer one, once over, has ended without one.
  if (!(banSeconds > 0) || banSeconds > BAN_MAX_SECONDS) return { banSeconds };
  const end = Math.max(at, tx.timestamp + banSeconds * 1000);
  // Only an end that has passed is a date to give.
  return end <= tip.timestamp ? { banSeconds, endedAt: end } : { banSeconds };
}

/** When the Minter Admins lifted a ban that took effect at `after`: an approved CANCEL_GROUP_BAN about the account. */
export function banLiftedAt(
  address: string,
  history: TxRow[],
  after: number,
  tip: StatusInputs['tip'],
  msPerBlock: number
): number | null {
  let lifted: number | null = null;
  for (const tx of history) {
    if (tx.type !== 'CANCEL_GROUP_BAN' || tx.member !== address) continue;
    if (!DONE.has(String(tx.approvalStatus))) continue;
    const at = effectiveTime(tx, tip, msPerBlock);
    if (at > after && (lifted === null || at < lifted)) lifted = at;
  }
  return lifted;
}

/** Evidence the account was a member before `before`: an approved (or pre-approval-era) invite for it. */
export function wasMemberBefore(address: string, history: TxRow[], before: number): boolean {
  return history.some(
    (tx) =>
      tx.type === 'GROUP_INVITE' &&
      tx.invitee === address &&
      DONE.has(String(tx.approvalStatus)) &&
      tx.timestamp < before
  );
}

/**
 * How a former member last left MINTER, and when it took effect (ms):
 * removed (a kick), banned, or left. A ban also says how it ended.
 */
export interface FormerMember {
  kind: 'removed' | 'banned' | 'left';
  at: number;
  /** Banned: lifted, or ended. */
  ban?: BanEnd;
}

/**
 * Whether the account was in MINTER once and isn't now: its newest removal
 * (an approved kick or ban, or its own LEAVE_GROUP), counted only when it
 * was a member before it, as the status engine counts `wasMember`. A kicked
 * join request alone is not a former member. Null otherwise. For a ban it
 * says how it ended, so it suits accounts the ban no longer holds (Ready to
 * mint leaves out bans in force).
 */
export function formerMember(
  address: string,
  history: TxRow[],
  tip: StatusInputs['tip'],
  msPerBlock: number
): FormerMember | null {
  const removal = latestRemoval(address, history, tip, msPerBlock);
  if (!removal) return null;
  if (removal.kind === 'leave') return { kind: 'left', at: removal.at };
  if (!wasMemberBefore(address, history, removal.at)) return null;
  if (removal.kind === 'kick') return { kind: 'removed', at: removal.at };
  return { kind: 'banned', at: removal.at, ban: banEnd(removal) ?? undefined };
}

export function resolveStatus(input: StatusInputs): MyStatus {
  const progress = levelProgress(input.level, input.blocksMinted, NOMINATOR_MIN_LEVEL);
  const removal =
    input.hub === 'signedIn'
      ? latestRemoval(input.address, input.history, input.tip, input.msPerBlock)
      : null;
  const wasMember = removal
    ? wasMemberBefore(input.address, input.history, removal.at) || removal.kind === 'leave'
    : false;
  const nomination = input.nominations[0] ?? null;
  const block = nominatorBlock({
    isAdmin: input.isAdmin,
    isMember: input.isMember,
    level: input.level,
    hasName: Boolean(input.name),
  });

  let kind: StatusKind;
  if (input.hub === 'outside') kind = 'outsideHub';
  else if (input.hub === 'signedOut') kind = 'signedOut';
  else if (input.isAdmin) kind = 'admin';
  else if (input.isMember) kind = input.level >= NOMINATOR_MIN_LEVEL ? 'memberNominator' : 'member';
  else if (input.activeBan) kind = 'formerBanned';
  else if (input.storedInvite) kind = 'approvedInvite';
  else if (nomination) kind = 'nominated';
  else if (removal && removal.kind !== 'leave') kind = 'formerKicked';
  else if (removal) kind = 'formerLeft';
  else kind = 'newcomer';

  return {
    kind,
    address: input.address,
    name: input.name,
    level: input.level,
    blocksMinted: input.blocksMinted,
    progress,
    isMember: input.isMember || input.isAdmin,
    isAdmin: input.isAdmin,
    hasJoinRequest: input.hasJoinRequest,
    activeBan: input.activeBan,
    storedInvite: input.storedInvite,
    removal,
    wasMember,
    nomination,
    canNominate: block === null,
    nominateBlock: block,
  };
}
