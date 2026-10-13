/**
 * A person's nomination rounds, for their nomination's own page: each
 * MINTER invite for them is one round (the first Minter Admin's signature
 * creates it and starts the clock), newest first, with how it ended. Pure:
 * fed their confirmed MINTER history, plus a waiting invite the history
 * doesn't list yet (still unconfirmed).
 */
import { MINTER_GROUP_ID } from '../data/constants';
import type { TxRow } from '../data/types';
import { decidedHeight, decisionOutcome, type DecisionOutcome } from './outcome';

export interface NominationRound {
  /** The invite's signature: the round's decision (/decisions/<signature>). */
  signature: string;
  /** 1 for their first round. */
  number: number;
  outcome: DecisionOutcome;
  /** The Minter Admin who made the first signature (created the invite). */
  firstSigner: string | null;
  startedAt: number;
  startedHeight: number | null;
  /** The block it was decided in, when it was. */
  decidedHeight: number | null;
}

function isInviteFor(tx: TxRow, address: string): boolean {
  return (
    tx.type === 'GROUP_INVITE' &&
    tx.invitee === address &&
    (tx.groupId === undefined || tx.groupId === MINTER_GROUP_ID)
  );
}

export function nominationRounds(
  rows: readonly TxRow[],
  address: string,
  maximumBlockDelay: number,
  waiting: TxRow | null = null
): NominationRound[] {
  const bySignature = new Map<string, TxRow>();
  for (const tx of waiting ? [...rows, waiting] : rows) {
    // The history's confirmed copy wins over a waiting one read earlier.
    if (isInviteFor(tx, address) && !bySignature.has(tx.signature))
      bySignature.set(tx.signature, tx);
  }
  const oldestFirst = [...bySignature.values()].sort(
    (a, b) => a.timestamp - b.timestamp || (a.blockHeight ?? 0) - (b.blockHeight ?? 0)
  );
  return oldestFirst
    .map((tx, i) => ({
      signature: tx.signature,
      number: i + 1,
      outcome: decisionOutcome(tx),
      firstSigner: tx.creatorAddress ?? null,
      startedAt: tx.timestamp,
      startedHeight: typeof tx.blockHeight === 'number' ? tx.blockHeight : null,
      decidedHeight: decidedHeight(tx, maximumBlockDelay),
    }))
    .reverse();
}
