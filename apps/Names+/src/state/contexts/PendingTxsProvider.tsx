// PendingTxsProvider.tsx
import { ReactNode, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAtom } from 'jotai';
import { pendingTxsAtom, TransactionCategory } from '../global/names';
import { PendingTxsContext } from '../../hooks/useHandlePendingTxs';

const TX_CHECK_INTERVAL = 80000;

export const PendingTxsProvider = ({ children }: { children: ReactNode }) => {
  const [pendingTxs, setPendingTxs] = useAtom(pendingTxsAtom);
  const hasAvatarRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    const interval = setInterval(() => {
      const categories = Object.keys(pendingTxs);

      categories.forEach((category) => {
        const txs = pendingTxs[category as TransactionCategory];
        if (!txs) return;

        Object.entries(txs).forEach(async ([signature, tx]) => {
          try {
            const response = await fetch(
              `/transactions/signature/${signature}`
            );
            if (!response.ok) throw new Error(`Fetch failed for ${signature}`);
            const data = await response.json();

            if (data?.blockHeight) {
              setPendingTxs((prev) => {
                const newCategory = {
                  ...prev[category as TransactionCategory],
                };
                delete newCategory[signature];

                const updated = {
                  ...prev,
                  [category]: newCategory,
                };

                if (Object.keys(newCategory).length === 0) {
                  delete updated[category as TransactionCategory];
                }

                return updated;
              });

              tx.callback?.();
            }
          } catch (err) {
            console.error(`Failed to check tx ${signature}`, err);
          }
        });
      });
    }, TX_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [pendingTxs, setPendingTxs]);

  const clearPendingTxs = useCallback(
    (category: string, fieldName: string, values: string[]) => {
      setPendingTxs((prev) => {
        const categoryTxs = prev[category as TransactionCategory];
        if (!categoryTxs) return prev;

        const filtered = Object.fromEntries(
          Object.entries(categoryTxs).filter(
            ([_, tx]) => !values.includes(tx[fieldName as 'name'])
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

  const getHasAvatar = useCallback((name: string) => {
    return hasAvatarRef.current[name] || null;
  }, []);
  const setHasAvatar = useCallback((name: string, hasAvatar: boolean) => {
    hasAvatarRef.current = {
      ...hasAvatarRef.current,
      [name]: hasAvatar,
    };
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
