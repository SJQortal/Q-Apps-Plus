/**
 * Stale-invite clean-up rules, kept out of the component file: which
 * invites count as recent, which already have a cancellation waiting, and
 * the one-after-another run behind "Propose cancelling all".
 */
import type { StaleInviteDetail } from '../../data/staleInvites';
import type { GroupTxType, InviteRow } from '../../data/types';
import type { Decision } from '../../rules/decision';
import { feesShortfall, proposeAndSign, type OwnSignatureOutcome } from '../../writes/flows';
import { SIGN_NEW_TX_CHECK } from '../../writes/explain';
import type { Signer } from '../../writes/runner';
import type { BulkCounts, BulkOutcome, BulkReport, BulkStep } from './BulkDialog';
import { secondStepProblem } from './decisionUi';

/** Approved this recently: they may still join, so not part of "Propose for all". */
export const RECENT_INVITE_MS = 30 * 86_400_000;

export function isRecentInvite(detail: StaleInviteDetail | undefined, nowMs: number): boolean {
  return Boolean(detail?.approvedAt && nowMs - detail.approvedAt < RECENT_INVITE_MS);
}

/** Cancellations still waiting (any admin's), as Core's PENDING status says. */
function waitingCancelDecisions(decisions: Decision[]): Decision[] {
  return decisions.filter((d) => d.kind === 'cancelInvite' && d.phase !== 'expired');
}

/** The invitees whose invite already has a cancellation waiting for signatures. */
export function waitingCancelInvitees(decisions: Decision[]): Set<string> {
  return new Set(
    waitingCancelDecisions(decisions)
      .map((d) => d.subject)
      .filter((s): s is string => s !== null)
  );
}

/** Waiting cancellations whose invitee couldn't be read. */
export function unmatchedCancels(decisions: Decision[]): number {
  return waitingCancelDecisions(decisions).filter((d) => d.subject === null).length;
}

/** Each item of "Propose cancelling all": the cancellation, then the proposer's signature on it. */
export const CANCEL_AND_SIGN_STEPS: BulkStep[] = [
  { action: 'CANCEL_GROUP_INVITE', title: 'Propose it' },
  { action: 'SIGN_TRANSACTION', title: 'Sign it', check: SIGN_NEW_TX_CHECK },
];

/** "2 of 3 proposed and signed. 1 more was proposed without your signature: …" */
export function cancelAllSummary({ total, sent, partial, stopped }: BulkCounts): string {
  const parts = [`${sent} of ${total} proposed and signed.`];
  if (partial)
    parts.push(
      partial === 1
        ? '1 more was proposed without your signature: sign it in the queue once it’s in a block.'
        : `${partial} more were proposed without your signature: sign them in the queue once they’re in a block.`
    );
  if (stopped) parts.push('You cancelled one in Hub, so the rest were not sent.');
  if (sent) parts.push('Each counts once it is in a block.');
  return parts.join(' ');
}

/**
 * One proposal and its proposer's signature, as one item of a run: both
 * went through, or step 1 did and step 2 didn't (the proposal then waits to
 * be signed from the queue), or step 1's own outcome.
 */
export function ownSignatureItem(result: OwnSignatureOutcome): BulkOutcome {
  const { proposal, approval } = result;
  if (proposal.status !== 'sent') return proposal;
  // The item is the proposal: its transaction, found late if either step was.
  if (approval?.status === 'sent')
    return { ...proposal, recovered: proposal.recovered || approval.recovered };
  if (approval?.status === 'declined')
    return {
      ...proposal,
      partial:
        'Proposed ✓. You cancelled your signature in Hub, so the rest were not sent. Sign this one in the queue once it’s in a block.',
      stopped: true,
    };
  return {
    ...proposal,
    partial: `Proposed ✓. Your signature didn’t go through: ${secondStepProblem(approval)} Sign it in the queue once it’s in a block.`,
  };
}

/**
 * One cancellation after another, each followed by the proposer's own
 * signature on it (two Hub confirmations each, as for a single proposal).
 * The fees of the whole run are checked first, quietly: only a balance that
 * can't pay them all stops it. A cancel in Hub, at either step, stops the rest.
 */
export async function cancelAll(
  signer: Signer,
  rows: InviteRow[],
  report: BulkReport
): Promise<BulkOutcome[]> {
  if (!rows.length) return [];
  report(0, null, { step: 0, stage: 'checking' });
  const short = await feesShortfall(
    signer,
    rows.flatMap((): GroupTxType[] => ['CANCEL_GROUP_INVITE', 'GROUP_APPROVAL'])
  );
  if (short) {
    const blocked: BulkOutcome = {
      status: 'blocked',
      reason: `All ${rows.length} with your signatures need ${short.total} in fees, and your confirmed balance is ${short.balance}. Propose them one at a time instead.`,
      stopped: true,
    };
    report(0, blocked);
    return [blocked];
  }
  const outcomes: BulkOutcome[] = [];
  for (let i = 0; i < rows.length; i++) {
    report(i, null, { step: 0, stage: 'checking' });
    const result = await proposeAndSign(
      signer,
      { kind: 'cancelInvite', subject: rows[i].invitee },
      (p) => report(i, null, { step: p.step - 1, stage: p.stage, signature: p.signature })
    );
    const outcome = ownSignatureItem(result);
    outcomes.push(outcome);
    report(i, outcome);
    if (outcome.status === 'declined' || outcome.stopped) break;
  }
  return outcomes;
}
