/**
 * A transaction in words (rules/explorer/txWords.ts) for the screen, with
 * the one thing Core's JSON leaves out: who received a minting level
 * (TRANSFER_PRIVS). In an account's own list the account either made the
 * move or received it (Core's address search finds no one else), so a move
 * it didn't make was to it, and nothing needs reading; otherwise the
 * recipient is read once from the raw bytes (`xprivs:<signature>`, kept for
 * the session).
 */
import { useMemo } from 'react';
import { getPrivsRecipient } from '../../data/explorer/account';
import type { TxRow } from '../../data/types';
import { useQuery } from '../../hooks/useQuery';
import { describeTx, type TxWords } from '../../rules/explorer/txWords';

/**
 * `viewpoint`: the account whose list `tx` comes from (an address search
 * for it), or null where there is none (one transaction's page, Transactions
 * on Qortal).
 */
export function useTxWords(tx: TxRow, viewpoint: string | null = null): TxWords {
  const privs = tx.type === 'TRANSFER_PRIVS';
  const toViewpoint = privs && viewpoint && tx.creatorAddress !== viewpoint ? viewpoint : null;
  const read = privs && !toViewpoint;
  const recipient = useQuery(read ? `xprivs:${tx.signature}` : null, () =>
    getPrivsRecipient(tx.signature)
  );
  const privsRecipient = toViewpoint ?? recipient.data ?? null;
  return useMemo(
    () => describeTx(tx, { viewpoint, privsRecipient }),
    [tx, viewpoint, privsRecipient]
  );
}
