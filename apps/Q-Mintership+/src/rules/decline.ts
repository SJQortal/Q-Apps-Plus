/**
 * Declining a join request: a MINTER kick of someone who asked to join and
 * isn't a member. Once the Minter Admins sign it, Core deletes their join
 * request (they leave Requested to join MINTER Group) and they can send a
 * new one later. It
 * is the same GROUP_KICK as a removal, so which one it is comes from the
 * person's join request: the join requests list while it waits, their
 * MINTER history once decided. Pure; the loaders feed it.
 */
import type { TxRow } from '../data/types';

/** A waiting decline, and the action that proposes one. */
export const DECLINE_TITLE = 'Decline a join request';
/** An approved decline, in History and on a person's page. */
export const DECLINED_TITLE = 'Join request declined';

/** Marks the waiting kicks of people with a join request as declines (`asking`: who has one). */
export function markDeclines<T extends { kind: string; subject: string | null }>(
  decisions: readonly T[],
  asking: ReadonlySet<string>,
  admins: ReadonlySet<string>
): Array<T & { decline?: boolean }> {
  return decisions.map((d) =>
    d.kind === 'kick' && d.subject && asking.has(d.subject) && !admins.has(d.subject)
      ? { ...d, decline: true }
      : d
  );
}

export interface JoinRequestStory {
  /** Approved kicks that took away a join request: declines. */
  declined: Set<string>;
  /** Kicks (any outcome) proposed while the account had asked to join and wasn't a member. */
  proposedAsDecline: Set<string>;
}

const APPLIED = new Set(['APPROVED', 'NOT_REQUIRED']);

interface Step {
  tx: TxRow;
  height: number;
  /** 0: in its own block; 1: applied by the Minter Admins' signatures (after a block's own). */
  phase: 0 | 1;
  /** A kick's proposal, looked at for whether a join request was open then. */
  probe?: boolean;
}

/**
 * Walks an account's MINTER history oldest first: a JOIN_GROUP with no
 * approved invite waiting is a join request, and with one it makes them a
 * member; an approved invite makes someone with a join request a member;
 * an approved kick takes away a join request if there is one (a decline),
 * otherwise their membership (and the invite that let them in, even when
 * the history in hand doesn't show it used); a ban takes away either. Only
 * what the history in hand shows counts: a kick with no join request on
 * record is never taken for a decline.
 */
export function joinRequestStory(address: string, history: readonly TxRow[]): JoinRequestStory {
  const steps: Step[] = [];
  for (const tx of history) {
    if (typeof tx.blockHeight !== 'number') continue;
    if (tx.type === 'JOIN_GROUP' || tx.type === 'LEAVE_GROUP') {
      if (tx.creatorAddress === address && tx.approvalStatus !== 'INVALID')
        steps.push({ tx, height: tx.blockHeight, phase: 0 });
      continue;
    }
    if (!aboutAddress(tx, address)) continue;
    if (tx.type === 'GROUP_KICK') steps.push({ tx, height: tx.blockHeight, phase: 0, probe: true });
    if (!APPLIED.has(String(tx.approvalStatus))) continue;
    const approved = typeof tx.approvalHeight === 'number';
    steps.push({
      tx,
      height: approved ? (tx.approvalHeight as number) : tx.blockHeight,
      phase: approved ? 1 : 0,
    });
  }
  steps.sort((a, b) => a.height - b.height || a.phase - b.phase || a.tx.timestamp - b.tx.timestamp);

  const story: JoinRequestStory = { declined: new Set(), proposedAsDecline: new Set() };
  let member = false;
  let invite = false;
  let request = false;
  for (const { tx, probe } of steps) {
    if (probe) {
      if (request && !member) story.proposedAsDecline.add(tx.signature);
      continue;
    }
    switch (tx.type) {
      case 'JOIN_GROUP':
        if (invite) [member, invite, request] = [true, false, false];
        else if (!member) request = true;
        break;
      case 'LEAVE_GROUP':
        [member, invite] = [false, false];
        break;
      case 'GROUP_INVITE':
        if (request) [member, request] = [true, false];
        else invite = true;
        break;
      case 'CANCEL_GROUP_INVITE':
        invite = false;
        break;
      case 'GROUP_KICK':
        if (request && !member) {
          story.declined.add(tx.signature);
          request = false;
        } else {
          // A member's kick: whatever let them in was used.
          [member, invite] = [false, false];
        }
        break;
      case 'GROUP_BAN':
        if (request && !member) request = false;
        else [member, invite] = [false, false];
        break;
    }
  }
  return story;
}

/** Whether a MINTER kick declines (or, not applied, proposed to decline) a join request. */
export function isDeclineIn(
  story: JoinRequestStory,
  tx: Pick<TxRow, 'signature' | 'approvalStatus'>
): boolean {
  return APPLIED.has(String(tx.approvalStatus))
    ? story.declined.has(tx.signature)
    : story.proposedAsDecline.has(tx.signature);
}

/** A group change about `address` (a cancelled invite in their own history that they didn't make is about them). */
function aboutAddress(tx: TxRow, address: string): boolean {
  switch (tx.type) {
    case 'GROUP_INVITE':
      return tx.invitee === address;
    case 'CANCEL_GROUP_INVITE':
      return tx.invitee === address || (!tx.invitee && tx.creatorAddress !== address);
    case 'GROUP_KICK':
      return tx.member === address;
    case 'GROUP_BAN':
      return tx.offender === address;
    default:
      return false;
  }
}
