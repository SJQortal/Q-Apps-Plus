/**
 * One decision by its signature, for its own page (/decisions/<signature>),
 * whether it still waits or was decided long ago.
 *
 * Reads: GET /transactions/signature/{sig} (and, for an invite
 * cancellation, its raw bytes once, for the group and invitee Core's JSON
 * leaves out). A decided one also reads who signed it: the GROUP_APPROVALs
 * in its own blocks only (rules/outcome.ts → signatureRange, at most one
 * window), kept 30 minutes. A waiting one is shown from the Decisions queue
 * itself (hooks/useData.ts → useDecisions), which already has its
 * signatures and clock.
 *
 * A kick says whether it declines a join request (rules/decline.ts): while
 * it waits, from the join requests (the cached list the nominations read);
 * once decided, from the person's own MINTER history (the cached read their
 * page makes).
 */
import { isMinterGroupChange, isUnusualApprovalRoute, toApprovalRow } from '../rules/decision';
import { isDeclineIn, joinRequestStory } from '../rules/decline';
import {
  decidedHeight,
  decisionOutcome,
  signatureRange,
  type DecisionOutcome,
} from '../rules/outcome';
import { latestPerSigner, type ApprovalRow } from '../rules/tally';
import { getChainNow } from './chain';
import { getGroupInfo, getJoinRequests } from './group';
import { fetchQuery } from './query';
import {
  getAddressHistory,
  getApprovalsInRange,
  getTransaction,
  withCancelInviteTargets,
} from './txs';
import type { TxRow } from './types';

export type DecisionLink =
  /** Core doesn't know this signature (a cut-short link, or not on this node yet). */
  | { kind: 'unknown' }
  /** A transaction, but not a MINTER group change. */
  | { kind: 'other'; tx: TxRow }
  /** A MINTER change on an unusual approval route (shown to Minter Admins only). */
  | { kind: 'unusual'; tx: TxRow }
  /** Still collecting signatures: the queue has its card. */
  | { kind: 'pending'; tx: TxRow; decline?: boolean }
  | {
      kind: 'decided';
      tx: TxRow;
      /** A kick that declined (or proposed to decline) a join request. */
      decline?: boolean;
      outcome: Exclude<DecisionOutcome, 'pending'>;
      /** The block it was decided in, when the chain says. */
      decidedAt: number | null;
      /** Each Minter Admin's latest answer on it, approvals first. */
      approvals: ApprovalRow[];
      rejections: ApprovalRow[];
      /** True when the signatures couldn't be read (the outcome still shows). */
      signaturesUnread: boolean;
    };

/** Who signed a decided transaction, from its own blocks only. */
async function decidedSignatures(
  tx: TxRow,
  maximumBlockDelay: number
): Promise<{ approvals: ApprovalRow[]; rejections: ApprovalRow[] }> {
  const now = await getChainNow();
  const range = signatureRange(tx, maximumBlockDelay, now.height);
  if (!range) return { approvals: [], rejections: [] };
  const rows = (
    await getApprovalsInRange(range.start, range.end, { ttlMs: 30 * 60_000, slot: 'decision' })
  ).rows
    .map(toApprovalRow)
    .filter((r): r is ApprovalRow => r !== null && r.pendingSignature === tx.signature);
  const latest = [...latestPerSigner(rows).values()].sort((a, b) => a.timestamp - b.timestamp);
  return {
    approvals: latest.filter((r) => r.approval),
    rejections: latest.filter((r) => !r.approval),
  };
}

/** Whether a kick declines a join request: false for anything else, or when it can't be read. */
async function declines(tx: TxRow, waiting: boolean): Promise<boolean> {
  const member = tx.type === 'GROUP_KICK' ? tx.member : undefined;
  if (!member) return false;
  try {
    if (waiting) return (await getJoinRequests()).some((r) => r.joiner === member);
    return isDeclineIn(joinRequestStory(member, (await getAddressHistory(member)).rows), tx);
  } catch {
    return false;
  }
}

/** Key `decisionlink:<signature>`. */
export function loadDecisionLink(
  signature: string,
  options: { force?: boolean } = {}
): Promise<DecisionLink> {
  return fetchQuery(
    `decisionlink:${signature}`,
    async () => {
      const found = await getTransaction(signature, { force: options.force });
      if (!found) return { kind: 'unknown' };
      // An invite cancellation names its group and invitee only in its raw bytes.
      const [tx] = await withCancelInviteTargets([found]);
      if (isUnusualApprovalRoute(tx)) return { kind: 'unusual', tx };
      if (!isMinterGroupChange(tx)) return { kind: 'other', tx };
      const outcome = decisionOutcome(tx);
      if (outcome === 'pending') return { kind: 'pending', tx, decline: await declines(tx, true) };
      const [group, decline] = await Promise.all([getGroupInfo(), declines(tx, false)]);
      let signatures = { approvals: [] as ApprovalRow[], rejections: [] as ApprovalRow[] };
      let signaturesUnread = false;
      if (outcome !== 'applied') {
        try {
          signatures = await decidedSignatures(tx, group.maximumBlockDelay);
        } catch {
          signaturesUnread = true;
        }
      }
      return {
        kind: 'decided',
        tx,
        decline,
        outcome,
        decidedAt: decidedHeight(tx, group.maximumBlockDelay),
        ...signatures,
        signaturesUnread,
      };
    },
    { ttlMs: 30_000, force: options.force }
  );
}
