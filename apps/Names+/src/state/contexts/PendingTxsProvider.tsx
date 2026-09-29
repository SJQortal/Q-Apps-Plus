import { ReactNode, useCallback, useMemo } from 'react';
import { useAtom } from 'jotai';
import { pendingTxsAtom, TransactionCategory } from '../global/names';
import { PendingTxsContext } from '../../hooks/useHandlePendingTxs';
import { useVisiblePolling } from '../../hooks/useVisiblePolling';
import { knownAvatar, rememberAvatar } from '../../api/names';

export const TX_CHECK_INTERVAL = 80_000;

export const PendingTxsProvider = ({ children }: { children: ReactNode }) => {
  const [pendingTxs, setPendingTxs] = useAtom(pendingTxsAtom);
  const hasPending = Object.values(pendingTxs).some(
    (txs) => txs && Object.keys(txs).length > 0
  );

  const checkPendingTxs = useCallback(async () => {
    const checks: Promise<void>[] = [];
    for (const [category, txs] of Object.entries(pendingTxs)) {
      if (!txs) continue;
      for (const [signature, tx] of Object.entries(txs)) {
        checks.push(
          (async () => {
            try {
              const response = await fetch(`/transactions/signature/${signature}`);
              if (!response.ok) throw new Error(`Fetch failed for ${signature}`);
              const data = await response.json();
              if (!data?.blockHeight) return;
              setPendingTxs((prev) => {
                const newCategory = { ...prev[category as TransactionCategory] };
                delete newCategory[signature];
                const updated = { ...prev, [category]: newCategory };
                if (Object.keys(newCategory).length === 0) {
                  delete updated[category as TransactionCategory];
                }
                return updated;
              });
              tx.callback?.();
            } catch (err) {
              console.error(`Failed to check tx ${signature}`, err);
            }
          })()
        );
      }
    }
    await Promise.all(checks);
  }, [pendingTxs, setPendingTxs]);

  // Only while something is pending, only while the tab is visible, first check after 80 s.
  useVisiblePolling(checkPendingTxs, TX_CHECK_INTERVAL, hasPending, { immediate: false });

  const clearPendingTxs = useCallback(
    (category: string, fieldName: string, values: string[]) => {
      setPendingTxs((prev) => {
        const categoryTxs = prev[category as TransactionCategory];
        if (!categoryTxs) return prev;

        const filtered = Object.fromEntries(
          Object.entries(categoryTxs).filter(
            ([, tx]) => !values.includes(tx[fieldName as 'name'])
          )
        );

        const updated = {
          ...prev,
          [category]: filtered,
        };

        if (Object.keys(filtered).length === 0) {
          delete updated[category as TransactionCategory];
        }

        return updated;
      });
    },
    [setPendingTxs]
  );

  const getHasAvatar = useCallback((name: string) => knownAvatar(name), []);
  const setHasAvatar = useCallback((name: string, hasAvatar: boolean) => {
    rememberAvatar(name, hasAvatar);
  }, []);

  const value = useMemo(
    () => ({
      clearPendingTxs,
      getHasAvatar,
      setHasAvatar,
    }),
    [clearPendingTxs, getHasAvatar, setHasAvatar]
  );

  return (
    <PendingTxsContext.Provider value={value}>
      {children}
    </PendingTxsContext.Provider>
  );
};
