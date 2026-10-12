/**
 * Stale-invite clean-up rules, kept out of the component file: which
 * invites count as recent, how many cancellations are already waiting, and
 * the one-after-another run behind "Propose cancelling all".
 */
import type { StaleInviteDetail } from '../../data/staleInvites';
import type { InviteRow } from '../../data/types';
import type { Decision } from '../../rules/decision';
import { proposeCancelInvite } from '../../writes/flows';
import type { Signer, WriteOutcome } from '../../writes/runner';
import type { BulkReport } from './BulkDialog';

/** Approved this recently: they may still join, so not part of "Propose for all". */
export const RECENT_INVITE_MS = 30 * 86_400_000;

export function isRecentInvite(detail: StaleInviteDetail | undefined, nowMs: number): boolean {
  return Boolean(detail?.approvedAt && nowMs - detail.approvedAt < RECENT_INVITE_MS);
}

/** Cancellations waiting for signatures (any admin's; Core doesn't say for whom). */
export function waitingCancels(decisions: Decision[]): number {
  return decisions.filter(
    (d) => d.kind === 'cancelInvite' && d.phase !== 'expired' && d.phase !== 'tooLate'
  ).length;
}

/** One cancellation after another; a cancel in Hub stops the rest. */
export async function cancelAll(
  signer: Signer,
  rows: InviteRow[],
  report: BulkReport
): Promise<WriteOutcome[]> {
  const outcomes: WriteOutcome[] = [];
  for (let i = 0; i < rows.length; i++) {
    report(i, null, 'checking');
    const outcome = await proposeCancelInvite(signer, rows[i].invitee, (stage) =>
      report(i, null, stage)
    );
    outcomes.push(outcome);
    report(i, outcome);
    if (outcome.status === 'declined') break;
  }
  return outcomes;
}
