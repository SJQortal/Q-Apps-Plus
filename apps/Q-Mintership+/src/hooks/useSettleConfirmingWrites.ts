/**
 * Ends a write's faster refresh (writes/optimistic.ts → useConfirmingWrites)
 * as soon as its transaction is in a block, instead of after the whole
 * 5-minute window, and reloads the views once then, so "(confirming…)"
 * settles at once. Mounted once, in the app shell.
 *
 * Reads, only while a write from this device waits for its block: the tip
 * (the same 'chain:now' read the views share), and on each new tip one
 * GET /transactions/signature/{sig} per write still waiting. A write with no
 * signature from Hub keeps the 5-minute cap.
 */
import { useEffect } from 'react';
import { getDefaultStore, useAtomValue } from 'jotai';
import { getChainNow } from '../data/chain';
import { getTransaction } from '../data/txs';
import { invalidateReads } from '../writes/chainReads';
import { pendingWritesAtom, settleWrite, waitsForBlock } from '../writes/optimistic';
import { CONFIRMING_REFRESH_MS } from './useData';
import { useQuery } from './useQuery';

/** The writes to look up: waiting for their block, with a signature to look for. */
function lookups(): Array<{ key: string; signature: string }> {
  const now = Date.now();
  return Object.values(getDefaultStore().get(pendingWritesAtom))
    .filter((entry) => waitsForBlock(entry, now) && entry.signature)
    .map((entry) => ({ key: entry.key, signature: entry.signature as string }));
}

export function useSettleConfirmingWrites(): void {
  const all = useAtomValue(pendingWritesAtom);
  const now = Date.now();
  const waiting = Object.values(all).some((entry) => waitsForBlock(entry, now) && entry.signature);
  const chain = useQuery('chain:now', (force) => getChainNow({ force }), {
    refreshMs: CONFIRMING_REFRESH_MS,
    enabled: waiting,
  });
  const height = chain.data?.height;

  useEffect(() => {
    if (!waiting || height === undefined) return;
    for (const { key, signature } of lookups()) {
      void getTransaction(signature, { force: true })
        .then((row) => {
          if (typeof row?.blockHeight !== 'number') return;
          settleWrite(key, signature);
          // The views read it now, rather than at their next minute.
          invalidateReads();
        })
        .catch(() => {
          // Looked up again at the next tip; the window still ends it.
        });
    }
  }, [waiting, height]);
}
