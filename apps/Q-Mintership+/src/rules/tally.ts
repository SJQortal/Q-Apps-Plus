/**
 * Counting the signatures on a pending group transaction, as Qortal Core does
 * (HSQLDBTransactionRepository.getApprovalData + Transaction.getApprovalDecision):
 *
 * - only CONFIRMED GROUP_APPROVAL transactions count;
 * - per signer (admin public key) only the latest one counts: the newest
 *   timestamp, then the larger signature on a tie;
 * - `approval: true` is a signature, `approval: false` a rejection. Both are
 *   measured against the same threshold, approvals first, so a tie is an
 *   approval. A rejection takes nothing from anyone else's signature.
 * - Withdrawing a signature is a rejection sent after it: only the latest
 *   counts, so the signature stops counting and the rejection counts instead.
 *
 * Unconfirmed approvals are shown as "confirming" so the UI can update at
 * once; they count only once they are in a block.
 */
import { base58Decode, compareBytes } from '../qortal/base58';
import { approvalsNeeded, meetsThreshold, type ApprovalThreshold } from './threshold';

export interface ApprovalRow {
  signature: string;
  pendingSignature: string;
  adminPublicKey: string;
  /** The signer's address, when the row carries it (`creatorAddress`). */
  creatorAddress?: string;
  approval: boolean;
  timestamp: number;
  /** Null or undefined while unconfirmed. */
  blockHeight?: number | null;
}

export interface SignerDecision {
  adminPublicKey: string;
  address?: string;
  approval: boolean;
  timestamp: number;
  blockHeight: number | null;
  signature: string;
  /**
   * A rejection sent after a confirmed signature of the same admin on this
   * transaction: a withdrawn signature. Always false for a signature.
   */
  withdrew: boolean;
}

export interface Tally {
  /** Signers whose latest confirmed decision is an approval: these count. */
  approvals: SignerDecision[];
  /** Signers whose latest confirmed decision is a rejection: these count too. */
  rejections: SignerDecision[];
  /** Unconfirmed decisions newer than the signer's latest confirmed one. */
  inFlight: SignerDecision[];
  approvalCount: number;
  rejectionCount: number;
  /** Approvals once every in-flight decision confirms. */
  projectedApprovalCount: number;
  needed: number;
  totalAdmins: number;
  threshold: ApprovalThreshold;
  /** The confirmed approvals meet the threshold: Core applies it in its next decision block. */
  met: boolean;
  /** The confirmed rejections meet the threshold (and the approvals don't). */
  rejectedMet: boolean;
}

function toDecision(row: ApprovalRow, confirmed: ApprovalRow[] = []): SignerDecision {
  const approval = row.approval === true;
  return {
    adminPublicKey: row.adminPublicKey,
    address: row.creatorAddress,
    approval,
    timestamp: row.timestamp,
    blockHeight: typeof row.blockHeight === 'number' ? row.blockHeight : null,
    signature: row.signature,
    withdrew:
      !approval &&
      confirmed.some(
        (earlier) =>
          earlier.adminPublicKey === row.adminPublicKey &&
          earlier.approval === true &&
          isNewerDecision(row, earlier)
      ),
  };
}

function safeBytes(signature: string): Uint8Array {
  try {
    return base58Decode(signature);
  } catch {
    return new Uint8Array(0);
  }
}

/** True when `a` is newer than `b` under Core's ordering. */
export function isNewerDecision(
  a: { timestamp: number; signature: string },
  b: { timestamp: number; signature: string }
): boolean {
  if (a.timestamp !== b.timestamp) return a.timestamp > b.timestamp;
  return compareBytes(safeBytes(a.signature), safeBytes(b.signature)) > 0;
}

/** Each signer's latest row among `rows`. */
export function latestPerSigner(rows: ApprovalRow[]): Map<string, ApprovalRow> {
  const latest = new Map<string, ApprovalRow>();
  for (const row of rows) {
    const current = latest.get(row.adminPublicKey);
    if (!current || isNewerDecision(row, current)) latest.set(row.adminPublicKey, row);
  }
  return latest;
}

/**
 * The tally for one pending transaction. `rows` may hold approvals for other
 * transactions and unconfirmed ones; they are filtered here.
 */
export function tallyApprovals(params: {
  pendingSignature: string;
  rows: ApprovalRow[];
  threshold: ApprovalThreshold;
  totalAdmins: number;
}): Tally {
  const mine = params.rows.filter((row) => row.pendingSignature === params.pendingSignature);
  const confirmed = mine.filter((row) => typeof row.blockHeight === 'number');
  const unconfirmed = mine.filter((row) => typeof row.blockHeight !== 'number');

  const latestConfirmed = latestPerSigner(confirmed);
  const approvals: SignerDecision[] = [];
  const rejections: SignerDecision[] = [];
  for (const row of latestConfirmed.values()) {
    (row.approval ? approvals : rejections).push(toDecision(row, confirmed));
  }

  const inFlight: SignerDecision[] = [];
  for (const row of latestPerSigner(unconfirmed).values()) {
    const settled = latestConfirmed.get(row.adminPublicKey);
    if (!settled || isNewerDecision(row, settled)) inFlight.push(toDecision(row, confirmed));
  }

  // What the count becomes once the in-flight decisions confirm.
  const projected = new Map<string, boolean>();
  for (const row of latestConfirmed.values()) projected.set(row.adminPublicKey, row.approval);
  for (const decision of inFlight) projected.set(decision.adminPublicKey, decision.approval);
  const projectedApprovalCount = [...projected.values()].filter(Boolean).length;

  const byTime = (a: SignerDecision, b: SignerDecision) => a.timestamp - b.timestamp;
  approvals.sort(byTime);
  rejections.sort(byTime);
  inFlight.sort(byTime);

  const met = meetsThreshold(params.threshold, approvals.length, params.totalAdmins);
  return {
    approvals,
    rejections,
    inFlight,
    approvalCount: approvals.length,
    rejectionCount: rejections.length,
    projectedApprovalCount,
    needed: approvalsNeeded(params.threshold, params.totalAdmins),
    totalAdmins: params.totalAdmins,
    threshold: params.threshold,
    met,
    rejectedMet: !met && meetsThreshold(params.threshold, rejections.length, params.totalAdmins),
  };
}

/** The signer's current decision on the transaction, confirmed or in flight. */
export function signerState(
  tally: Tally,
  adminPublicKey: string
): 'signed' | 'confirming' | 'rejected' | 'rejecting' | 'none' {
  const flying = tally.inFlight.find((d) => d.adminPublicKey === adminPublicKey);
  if (flying) return flying.approval ? 'confirming' : 'rejecting';
  if (tally.approvals.some((d) => d.adminPublicKey === adminPublicKey)) return 'signed';
  if (tally.rejections.some((d) => d.adminPublicKey === adminPublicKey)) return 'rejected';
  return 'none';
}

/**
 * The confirmed counts once the admin's new decision (`approval`) is in a
 * block, everything else unchanged: what Withdraw and Reject show.
 */
export function countsAfter(
  tally: Pick<Tally, 'approvals' | 'rejections'>,
  adminPublicKey: string,
  approval: boolean
): { approvals: number; rejections: number } {
  const others = (list: SignerDecision[]) =>
    list.filter((d) => d.adminPublicKey !== adminPublicKey).length;
  return {
    approvals: others(tally.approvals) + (approval ? 1 : 0),
    rejections: others(tally.rejections) + (approval ? 0 : 1),
  };
}

/** True when the admin's current answer (confirmed or in flight) is a withdrawn signature. */
export function withdrewSignature(tally: Tally, adminPublicKey: string): boolean {
  const flying = tally.inFlight.find((d) => d.adminPublicKey === adminPublicKey);
  if (flying) return flying.withdrew;
  return tally.rejections.some((d) => d.adminPublicKey === adminPublicKey && d.withdrew);
}
