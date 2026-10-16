/**
 * One transaction's page, in words: its group-approval status, who made it,
 * and its raw data as shown (the only place raw JSON shows), with what must
 * never show taken out: what a message says, and what identifies an
 * encrypted QDN resource.
 */
import { NULL_OWNER } from '../../../data/constants';
import type { TxRow } from '../../../data/types';
import { isPrivateService, serviceName } from '../../../rules/explorer/qdnServices';

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

export const NOT_SHOWN = '(not shown)';

/** The fields of an encrypted resource's transaction that would tell what it holds. */
const PRIVATE_QDN_FIELDS = ['identifier', 'data', 'secret', 'metadataHash'];

/**
 * The transaction as raw data for the screen: Core's JSON, less a message's
 * content and an encrypted resource's identifier and data.
 */
export function rawForDisplay(tx: TxRow): Record<string, unknown> {
  const shown: Record<string, unknown> = { ...tx };
  if ((tx.type === 'MESSAGE' || tx.type === 'CHAT') && 'data' in shown) shown.data = NOT_SHOWN;
  if (tx.type === 'ARBITRARY' && isPrivateService(serviceName(tx.service)))
    for (const key of PRIVATE_QDN_FIELDS) if (key in shown) shown[key] = NOT_SHOWN;
  return shown;
}
