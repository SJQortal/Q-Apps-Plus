/**
 * One transaction's page, in words: its group-approval status and who made
 * it. Its raw response as shown is rules/explorer/rawTx.ts.
 */
import { NULL_OWNER } from '../../../data/constants';
import type { TxRow } from '../../../data/types';

const ADDRESS_RE = /^[QA][1-9A-HJ-NP-Za-km-z]{33}$/;

/** A transaction's group-approval status in words; null when it needs none. */
export function approvalWords(status: unknown): string | null {
  switch (status) {
    case 'PENDING':
      return 'Waiting for group approval';
    case 'APPROVED':
      return 'Approved by the group';
    case 'REJECTED':
      return 'Rejected';
    case 'EXPIRED':
      return 'Expired';
    case 'INVALID':
      return 'Not valid';
    default:
      return null;
  }
}

/** Who made it: an AT's own address for an AT's transaction; nobody for Core's own account. */
export function makerOf(tx: TxRow): string | null {
  const maker = tx.type === 'AT' ? tx.atAddress : tx.creatorAddress;
  return typeof maker === 'string' && ADDRESS_RE.test(maker) && maker !== NULL_OWNER ? maker : null;
}
