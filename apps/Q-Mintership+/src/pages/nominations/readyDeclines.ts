/**
 * Ready to mint's "Decline", for Minter Admins: a kick of someone who asked
 * to join and isn't a member, worded as declining their join request
 * (rules/decline.ts). What waits already comes from the Decisions queue the
 * nominations read: no read of its own.
 */
import { useMemo } from 'react';
import type { DecisionsData } from '../../data/decisions';
import { approvalsNeeded } from '../../rules/threshold';
import type { ProposeContext } from '../decisions/ProposeDialog';
import { useStoredValue } from './useReadyToMint';

/** The words a row says while a decline of its join request waits. */
export const DECLINE_WAITING = 'A decline is waiting for Minter Admins’ signatures';

export interface ReadyDeclines {
  /** Waiting kicks by subject: the decision's signature. */
  waiting: ReadonlyMap<string, string>;
  /** What the dialog's words need; null until the queue is in. */
  ctx: ProposeContext | null;
}

/** The waiting declines and the queue's numbers, from the cached Decisions queue. */
export function useReadyDeclines(): ReadyDeclines {
  const queue = useStoredValue<DecisionsData>('decisions:queue').data;
  return useMemo(() => {
    const waiting = new Map<string, string>();
    if (!queue) return { waiting, ctx: null };
    for (const d of queue.decisions)
      if (d.kind === 'kick' && d.subject && d.phase !== 'expired' && !waiting.has(d.subject))
        waiting.set(d.subject, d.signature);
    return {
      waiting,
      ctx: {
        needed: approvalsNeeded(queue.group.approvalThreshold, queue.admins.adminCount),
        totalAdmins: queue.admins.adminCount,
        maximumBlockDelay: queue.group.maximumBlockDelay,
        msPerBlock: queue.now.msPerBlock,
        signers: queue.admins.signers,
      },
    };
  }, [queue]);
}
