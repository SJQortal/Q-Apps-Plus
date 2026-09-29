// PendingTxsProvider.tsx
import { ReactNode, useCallback, useMemo } from 'react';
import { useSetAtom } from 'jotai';
import { primaryNameAtom } from '../global/names';
import { FetchNamesContext } from '../../hooks/useFetchNames';

export const FetchNamesProvider = ({ children }: { children: ReactNode }) => {
  const setPrimaryName = useSetAtom(primaryNameAtom);
  const fetchPrimaryName = useCallback(
    async (address: string) => {
      if (!address) return;
      try {
        const res = await qortalRequest({
          action: 'GET_PRIMARY_NAME',
          address,
        });
        if (res) {
          setPrimaryName(res);
        }
      } catch (error) {
        console.error(error);
      }
    },
    [setPrimaryName]
  );

  const value = useMemo(
    () => ({
      fetchPrimaryName,
    }),
    [fetchPrimaryName]
  );

  return (
    <FetchNamesContext.Provider value={value}>
      {children}
    </FetchNamesContext.Provider>
  );
};
