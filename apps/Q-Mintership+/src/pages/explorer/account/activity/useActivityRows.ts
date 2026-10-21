/**
 * The transactions Overview's Activity chart draws: the account's own list
 * (`xtx:<address>:all`, shared with the Transactions tab and Latest
 * transactions, data/explorer/accountTx.ts), read on page by page of 100
 * through the heavy-read limiter until it holds `target` rows or reaches
 * the account's first transaction. The newest `step` first (1,000 unless the
 * person picked another number in Activity's settings); Read older adds
 * `step` more; Read all of it goes on to ACTIVITY_MAX. Each page costs Core about half a second on a busy account,
 * so nothing reads past what was asked; leaving the page drops what is
 * queued (useHeavyScope on the account page).
 */
import { useEffect, useRef, useState } from 'react';
import { accountTxKey, getAccountTx } from '../../../../data/explorer/accountTx';
import { HeavyCancelled } from '../../../../data/explorer/heavy';
import type { TxRow } from '../../../../data/types';
import { useQuery } from '../../../../hooks/useQuery';
import { ACTIVITY_FIRST_READ_DEFAULT, ACTIVITY_FIRST_READ_MAX } from '../../../../state/settings';

/** The default step; each person can pick their own (Activity's settings). */
export const ACTIVITY_STEP = ACTIVITY_FIRST_READ_DEFAULT;
export const ACTIVITY_MAX = ACTIVITY_FIRST_READ_MAX;

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

/** `step`: how many it reads at first and on each Read older (the person's own setting). */
export function useActivityRows(
  address: string,
  enabled: boolean,
  step: number = ACTIVITY_STEP
): ActivityRows {
  const list = useQuery(enabled ? accountTxKey(address, []) : null, (force) =>
    getAccountTx(address, [], { force })
  );
  const [goal, setGoal] = useState({ address, step, target: step });
  // Another account, or the setting changed: its own first read again.
  const target = goal.address === address && goal.step === step ? goal.target : step;
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
    readMore: () => setGoal({ address, step, target: Math.min(ACTIVITY_MAX, held + step) }),
    readAll: () => setGoal({ address, step, target: ACTIVITY_MAX }),
    retry: () => {
      setFailed(null);
      if (!data) void list.refetch();
    },
  };
}
