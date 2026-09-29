// PendingTxsContext.tsx
import { createContext, useContext } from 'react';

type PendingTxsContextType = {
  clearPendingTxs: (
    category: string,
    fieldName: string,
    values: string[]
  ) => void;
  getHasAvatar: (name: string) => boolean | null;
  setHasAvatar: (name: string, hasAvatar: boolean) => void;
};

export const PendingTxsContext = createContext<
  PendingTxsContextType | undefined
>(undefined);

export const usePendingTxs = () => {
  const context = useContext(PendingTxsContext);
  if (!context) {
    throw new Error('usePendingTxs must be used within a PendingTxsProvider');
  }
  return context;
};
