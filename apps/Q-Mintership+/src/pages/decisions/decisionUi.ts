/**
 * The Decisions screen's small rules and words, kept pure so tests can pin
 * them: when Sign is offered, what each phase says, ban lengths and reasons.
 */
import { BAN_MAX_SECONDS } from '../../data/constants';
import { heightToTime, type ChainNow } from '../../data/chain';
import type { Decision } from '../../rules/decision';
import { signerState } from '../../rules/tally';
import { formatBlock, formatCount, formatDateTime, formatDuration } from '../../utils/format';
import type { PendingWrite } from '../../writes/optimistic';

export type MyAnswer = ReturnType<typeof signerState>;

/** The DOM id of a decision's card, for ?d= links. */
export function decisionCardId(signature: string): string {
  return `decision-${signature}`;
}

/** The signed-in admin's answer on a decision ('none' without a tally or key). */
export function myAnswer(d: Decision, publicKey: string | null | undefined): MyAnswer {
  return d.tally && publicKey ? signerState(d.tally, publicKey) : 'none';
}

/**
 * Sign is offered only while a new signature can still count (early or
 * open) and the admin hasn't signed. A rejection can be replaced, because
 * only the latest answer counts.
 */
export function canSign(d: Decision, answer: MyAnswer, pending: PendingWrite | null): boolean {
  if (!d.tally || d.unusualRoute) return false;
  if (d.phase !== 'open' && d.phase !== 'early') return false;
  if (pending && (pending.status === 'sending' || pending.status === 'confirming')) return false;
  return answer === 'none' || answer === 'rejected';
}

/** "Signed ✓", "Signed ✓ (confirming…)", or null when the admin hasn't signed. */
export function signedLabel(answer: MyAnswer, pending: PendingWrite | null): string | null {
  if (answer === 'signed') return 'Signed ✓';
  if (answer === 'confirming' || pending?.status === 'confirming') return 'Signed ✓ (confirming…)';
  return null;
}

/** True when the admin's signature is in, or on its way (for "hide what I signed"). */
export function isSignedByMe(answer: MyAnswer, pending: PendingWrite | null): boolean {
  return signedLabel(answer, pending) !== null;
}

/** One plain line on where the decision stands, or null when the countdown says it all. */
export function phaseLine(d: Decision, now: ChainNow): string | null {
  const w = d.window;
  switch (d.phase) {
    case 'unconfirmed':
      return 'On its way into a block. The clock starts once it is in one, and signing opens then.';
    case 'early':
      return w
        ? `Just proposed. Signatures count already; it can be applied from ${formatBlock(w.earliestDecisionHeight)} (in about ${formatDuration(Math.max(0, heightToTime(now, w.earliestDecisionHeight) - now.timestamp))}).`
        : null;
    case 'open':
      return null;
    case 'thresholdMet':
      return 'Enough signatures: Core applies it in the next block. Nobody has to do anything else.';
    case 'tooLate':
      return w
        ? `Too late to sign: the last block a signature could count in has passed. It expires at ${formatBlock(w.expiresAtHeight)}.`
        : 'Too late to sign: the last block a signature could count in has passed.';
    case 'expired':
      return 'Expired without enough signatures. It can be proposed again.';
  }
}

/** "Expires at block 2,767,581 (about 20 Oct 2026, 16:02)". */
export function expiryLine(d: Decision, now: ChainNow): string | null {
  if (!d.window) return null;
  const h = d.window.expiresAtHeight;
  return `Expires at ${formatBlock(h)} (about ${formatDateTime(heightToTime(now, h))})`;
}

/** "Permanent", "7 days". */
export function banLengthText(seconds: number | undefined): string {
  if (!seconds) return 'Permanent';
  if (seconds % 86_400 === 0) {
    const days = seconds / 86_400;
    return `${formatCount(days)} day${days === 1 ? '' : 's'}`;
  }
  return formatDuration(seconds * 1000, { precise: true });
}

/**
 * When a timed ban ends. Core counts a ban from the time it was proposed,
 * not from its approval, so this is the proposal time plus the length.
 * Null for a permanent ban (or anything that isn't a ban).
 */
export function banEndLine(d: Decision, now: ChainNow): string | null {
  if (d.kind !== 'ban' || !d.banSeconds) return null;
  const end = d.createdAt + d.banSeconds * 1000;
  // It can't apply before the next block, nor before its window allows.
  const earliest = Math.max(
    now.timestamp + now.msPerBlock,
    d.window ? heightToTime(now, d.window.earliestDecisionHeight) : 0
  );
  return end <= earliest
    ? `Its time has already run out (it ended ${formatDateTime(end)}): a ban counts from when it was proposed, not from approval.`
    : `Ends about ${formatDateTime(end)}: a ban counts from when it was proposed, not from approval.`;
}

export const BAN_MAX_DAYS = BAN_MAX_SECONDS / 86_400;

/**
 * The ban length typed in the form: a whole number of days, 1 to 24.
 * Returns the seconds, or a plain reason it can't be used.
 */
export function parseBanDays(input: string): { seconds: number } | { error: string } {
  const text = input.trim();
  if (!text) return { error: `Enter a number of days, 1 to ${BAN_MAX_DAYS}.` };
  if (!/^\d+$/.test(text)) return { error: 'Use a whole number of days.' };
  const days = Number(text);
  if (days < 1) return { error: 'At least 1 day, or choose a permanent ban.' };
  if (days > BAN_MAX_DAYS)
    return { error: `A ban can last up to ${BAN_MAX_DAYS} days. For longer, choose permanent.` };
  return { seconds: days * 86_400 };
}

/** Core accepts at most 128 bytes (UTF-8) for a kick or ban reason. */
export const REASON_MAX_BYTES = 128;

export function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Why a kick or ban reason can't be sent, or null. */
export function reasonProblem(reason: string): string | null {
  const text = reason.trim();
  if (!text) return 'Say why, in a few words: the other Minter Admins see it.';
  if (utf8Length(text) > REASON_MAX_BYTES)
    return `Too long: Core accepts at most ${REASON_MAX_BYTES} bytes.`;
  return null;
}
