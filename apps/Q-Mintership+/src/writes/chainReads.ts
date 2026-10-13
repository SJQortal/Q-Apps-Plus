/**
 * The reads a chain write can change, by key prefix: invalidated when Hub
 * answers a write (writes/flows.ts), and once more when its transaction is
 * seen in a block (hooks/useSettleConfirmingWrites.ts). Kept apart from the
 * write flows so the app shell can use it without loading them.
 */
import { invalidate } from '../data/query';

export const CHAIN_PREFIXES: readonly string[] = [
  'decisions:',
  'pending:',
  'unconfirmed:',
  'approvals:',
  'nominations:',
  'status:',
  'membership:',
  'joinrequest:',
  'invite:',
  'group:',
  'history:',
  'tx:',
  'balance:',
  'qdnsearch:',
  'considering:',
];

export function invalidateReads(prefixes: readonly string[] = CHAIN_PREFIXES): void {
  for (const prefix of prefixes) invalidate(prefix);
}
