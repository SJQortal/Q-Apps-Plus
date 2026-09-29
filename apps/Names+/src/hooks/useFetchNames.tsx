// PendingTxsContext.tsx
import { createContext, useContext } from 'react';

export type FetchPrimaryNameType = (address: string) => void;

type FetchNamesContextType = {
  fetchPrimaryName: FetchPrimaryNameType;
};

export const FetchNamesContext = createContext<
  FetchNamesContextType | undefined
>(undefined);

export const useFetchNames = () => {
  const context = useContext(FetchNamesContext);
  if (!context) {
    throw new Error('useFetchNames must be used within a FetchNamesProvider');
  }
  return context;
};
