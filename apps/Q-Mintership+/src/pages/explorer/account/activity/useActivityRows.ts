/**
 * The transactions Overview's Activity chart draws: the account's own list
 * (`xtx:<address>:all`, shared with the Transactions tab and Latest
 * transactions, data/explorer/accountTx.ts), read on page by page of 100
 * through the heavy-read limiter until it holds `target` rows or reaches
 * the account's first transaction. The newest ACTIVITY_STEP first; Read
 * further back adds ACTIVITY_STEP more; Read all of it goes on to
 * ACTIVITY_MAX. Each page costs Core about half a second on a busy account,
 * so nothing reads past what was asked; leaving the page drops what is
 * queued (useHeavyScope on the account page).
 */
import { useEffect, useRef, useState } from 'react';
import { accountTxKey, getAccountTx } from '../../../../data/explorer/accountTx';
import { HeavyCancelled } from '../../../../data/explorer/heavy';
import type { TxRow } from '../../../../data/types';
import { useQuery } from '../../../../hooks/useQuery';

export const ACTIVITY_STEP = 1_000;
export const ACTIVITY_MAX = 20_000;

export interface ActivityRows {
  /** Every transaction read so far, newest first (undefined before the first page). */
  rows: TxRow[] | undefined;
  /** Its first transaction has been read: the whole history is in. */
  done: boolean;
  /** A page is being read. */
  reading: boolean;
  /** How many it is reading up to. */
  target: number;
  error: unknown;
  readMore: () => void;
  readAll: () => void;
  retry: () => void;
}

export function useActivityRows(address: string, enabled: boolean): ActivityRows {
  const list = useQuery(enabled ? accountTxKey(address, []) : null, (force) =>
    getAccountTx(address, [], { force })
  );
  const [goal, setGoal] = useState({ address, target: ACTIVITY_STEP });
  const target = goal.address === address ? goal.target : ACTIVITY_STEP;
  const [failed, setFailed] = useState<unknown>(null);
  const [reading, setReading] = useState(false);
  const busy = useRef(false);
  const data = list.data;
  const held = data?.rows.length ?? 0;
  const done = data?.done ?? false;

  // Runs again when a page lands and when its read ends (`reading`), so the next one starts.
  useEffect(() => {
    if (!enabled || !data || done || busy.current || reading || failed || held >= target) return;
    busy.current = true;
    setReading(true);
    getAccountTx(address, [], { older: true })
      .catch((error: unknown) => {
        if (!(error instanceof HeavyCancelled)) setFailed(error);
      })
      .finally(() => {
        busy.current = false;
        setReading(false);
      });
  }, [enabled, data, done, reading, failed, held, target, address]);

  return {
    rows: data?.rows,
    done,
    reading: reading || list.isLoading,
    target,
    error: failed ?? (list.isError && !data ? list.error : null),
    readMore: () => setGoal({ address, target: Math.min(ACTIVITY_MAX, held + ACTIVITY_STEP) }),
    readAll: () => setGoal({ address, target: ACTIVITY_MAX }),
    retry: () => {
      setFailed(null);
      if (!data) void list.refetch();
    },
  };
}
