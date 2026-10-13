/**
 * The Decisions screen's small rules and words, kept pure so tests can pin
 * them: the admin's own answer and when Sign, Reject and Withdraw are
 * offered, what each phase says, ban lengths and reasons.
 */
import { BAN_MAX_SECONDS } from '../../data/constants';
import { heightToTime, type ChainNow } from '../../data/chain';
import type { Decision } from '../../rules/decision';
import { signerState, withdrewSignature } from '../../rules/tally';
import { formatBlock, formatCount, formatDateTime, formatDuration } from '../../utils/format';
import type { PendingAnswers, PendingWrite } from '../../writes/optimistic';
import type { WriteOutcome } from '../../writes/runner';

export type MyAnswer = ReturnType<typeof signerState>;

/** "10,080 blocks (about 8 days 12 hours)": how long a decision collects signatures. */
export function signingWindowText(maximumBlockDelay: number, msPerBlock: number): string {
  return `${formatCount(maximumBlockDelay)} blocks (about ${formatDuration(
    maximumBlockDelay * msPerBlock,
    { precise: true }
  )})`;
}

/** Why step 2 (the admin's own signature) didn't go through, in one plain sentence. */
export function secondStepProblem(outcome: WriteOutcome | null): string {
  switch (outcome?.status) {
    case 'declined':
      return 'You cancelled step 2 in Hub.';
    case 'blocked':
      return outcome.reason;
    case 'unknown':
    case 'failed':
      return outcome.message;
    default:
      return 'Step 2 did not run.';
  }
}

/** The DOM id of a decision's card, for ?d= links. */
export function decisionCardId(signature: string): string {
  return `decision-${signature}`;
}

/** The signed-in admin's answer on a decision ('none' without a tally or key). */
export function myAnswer(d: Decision, publicKey: string | null | undefined): MyAnswer {
  return d.tally && publicKey ? signerState(d.tally, publicKey) : 'none';
}

export type AnswerIntent = keyof PendingAnswers;

const INTENTS: AnswerIntent[] = ['sign', 'reject', 'withdraw'];

/** The newest answer this device is sending or waiting on, or null (a failed try doesn't count). */
export function newestPending(
  pending: PendingAnswers
): { intent: AnswerIntent; write: PendingWrite } | null {
  let newest: { intent: AnswerIntent; write: PendingWrite } | null = null;
  for (const intent of INTENTS) {
    const write = pending[intent];
    if (!write || (write.status !== 'sending' && write.status !== 'confirming')) continue;
    if (!newest || write.at >= newest.write.at) newest = { intent, write };
  }
  return newest;
}

/** The admin's own answer on a decision, as the card and the lists show it. */
export interface AnswerView {
  /** Signed, rejected (or withdrawn), or no answer. */
  shown: 'none' | 'signed' | 'rejected';
  /** In a block; false while it is on its way. */
  settled: boolean;
  /** The rejection withdrew the admin's own signature. */
  withdrew: boolean;
  /** An answer from this device is still being sent or confirmed: no new one until it is in. */
  busy: boolean;
  /** Being sent right now (the checks, or Hub's dialog). */
  sending: AnswerIntent | null;
  /** "Signed ✓", "Rejected (confirming…)", "Signature withdrawn", … or null. */
  label: string | null;
  /** The chain's word for the admin's answer. */
  chain: MyAnswer;
  /** A try from this device that hasn't shown up (Hub stopped waiting). */
  failed: boolean;
}

const NO_ANSWERS: PendingAnswers = { sign: null, reject: null, withdraw: null };

/**
 * The admin's answer: the chain's (confirmed, or on its way), unless an
 * answer sent from this device is newer and not in a block yet. That one
 * shows as "(confirming…)" until the chain has it, then settles.
 */
export function answerView(
  d: Decision,
  publicKey: string | null | undefined,
  pending: PendingAnswers = NO_ANSWERS
): AnswerView {
  const chain = myAnswer(d, publicKey);
  const chainWithdrew = Boolean(d.tally && publicKey && withdrewSignature(d.tally, publicKey));
  const newest = newestPending(pending);
  let shown: AnswerView['shown'];
  let settled: boolean;
  let withdrew: boolean;
  let busy = false;
  if (newest && newest.write.status === 'confirming') {
    shown = newest.intent === 'sign' ? 'signed' : 'rejected';
    settled = chain === shown;
    withdrew = shown === 'rejected' && (newest.intent === 'withdraw' || (settled && chainWithdrew));
    busy = !settled;
  } else {
    shown =
      chain === 'signed' || chain === 'confirming'
        ? 'signed'
        : chain === 'rejected' || chain === 'rejecting'
          ? 'rejected'
          : 'none';
    settled = chain === 'signed' || chain === 'rejected';
    withdrew = shown === 'rejected' && chainWithdrew;
    busy = newest?.write.status === 'sending';
  }
  return {
    shown,
    settled: shown === 'none' ? false : settled,
    withdrew,
    busy,
    sending: newest?.write.status === 'sending' ? newest.intent : null,
    label: answerLabel(shown, settled, withdrew),
    chain,
    failed: INTENTS.some((i) => pending[i]?.status === 'failed') && !newest,
  };
}

function answerLabel(
  shown: AnswerView['shown'],
  settled: boolean,
  withdrew: boolean
): string | null {
  if (shown === 'signed') return settled ? 'Signed ✓' : 'Signed ✓ (confirming…)';
  if (shown === 'rejected') {
    if (withdrew) return settled ? 'Signature withdrawn' : 'Withdrawn (confirming…)';
    return settled ? 'Rejected' : 'Rejected (confirming…)';
  }
  return null;
}

/** A new answer can still count: early or open, with a tally, on the usual route. */
function answerable(d: Decision): boolean {
  if (!d.tally || d.unusualRoute) return false;
  return d.phase === 'open' || d.phase === 'early';
}

/**
 * Sign is offered while a new signature can still count (early or open),
 * to an admin who hasn't signed, or whose rejection is in a block: only the
 * latest answer counts, so a signature replaces it.
 */
export function canSign(d: Decision, view: AnswerView): boolean {
  if (!answerable(d) || view.busy) return false;
  return view.shown === 'none' || (view.shown === 'rejected' && view.settled);
}

/** Reject is offered to an admin with no answer yet, while it can still count. */
export function canReject(d: Decision, view: AnswerView): boolean {
  return answerable(d) && !view.busy && view.shown === 'none';
}

/**
 * Enough signatures, but Core applies it no sooner than two blocks from
 * now: a withdrawal sent now lands in the next block at the earliest and
 * counts from the one after, so it can still stop it.
 */
export function stillStoppable(d: Decision, now: Pick<ChainNow, 'height'>): boolean {
  return (
    d.phase === 'thresholdMet' &&
    !d.unusualRoute &&
    d.tally !== null &&
    d.applyAtHeight !== null &&
    d.applyAtHeight >= now.height + 2
  );
}

/**
 * "Withdraw my signature" replaces Sign once the admin's signature is in a
 * block, while a withdrawal can still count (also with enough signatures,
 * as long as it can still stop it).
 */
export function canWithdraw(d: Decision, view: AnswerView, now: Pick<ChainNow, 'height'>): boolean {
  return (
    (answerable(d) || stillStoppable(d, now)) &&
    !view.busy &&
    view.shown === 'signed' &&
    view.settled
  );
}

/** Waiting for this admin: they can sign it and haven't answered it at all. */
export function isWaitingForMe(d: Decision, view: AnswerView): boolean {
  return canSign(d, view) && view.shown === 'none';
}

/** When Core applies a decision with enough signatures: "in the next block", or "at block X (in about T)". */
export function whenApplied(d: Pick<Decision, 'applyAtHeight'>, now: ChainNow): string {
  const h = d.applyAtHeight;
  if (h === null || h <= now.height + 1) return 'in the next block';
  return `at ${formatBlock(h)} (in about ${formatDuration(Math.max(0, heightToTime(now, h) - now.timestamp))})`;
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
      return `Enough signatures: Core applies it ${whenApplied(d, now)}. Nobody has to do anything else.`;
    case 'rejectedMet': {
      const when = whenApplied(d, now);
      return when === 'in the next block'
        ? `Enough rejections: Core ends it as rejected in the next block. It can be proposed again.`
        : `Enough rejections: Core ends it as rejected ${when}, unless it has ${d.tally?.needed ?? 'enough'} signatures by then (signatures are counted first). It can be proposed again.`;
    }
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
