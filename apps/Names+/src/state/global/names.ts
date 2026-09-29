import { atom } from 'jotai';

export const isNamePendingTx = (
  name: string,
  pendingTxs: PendingTxsState
): boolean => {
  for (const category of Object.keys(pendingTxs) as TransactionCategory[]) {
    const txMap = pendingTxs[category];
    if (!txMap) continue;

    for (const tx of Object.values(txMap)) {
      if (tx.name === name) {
        return true;
      }
    }
  }

  return false;
};

interface AdditionalFields {
  callback: () => void;
  status: 'PENDING';
}
interface RegisterNameTransaction {
  type: 'REGISTER_NAME';
  timestamp: number;
  reference: string;
  fee: string;
  signature: string;
  txGroupId: number;
  blockHeight: number;
  approvalStatus: 'NOT_REQUIRED';
  creatorAddress: string;
  registrantPublicKey: string;
  name: string;
  data: string;
}

interface UpdateNameTransaction {
  type: 'UPDATE_NAME';
  timestamp: number;
  reference: string;
  fee: string;
  signature: string;
  txGroupId: number;
  blockHeight: number;
  approvalStatus: 'NOT_REQUIRED';
  creatorAddress: string;
  ownerPublicKey: string;
  name: string;
  newName: string;
  newData: string;
}

export interface SellNameTransaction {
  type: 'SELL_NAME';
  timestamp: number;
  reference: string;
  fee: string;
  signature: string;
  txGroupId: number;
  blockHeight: number;
  approvalStatus: 'NOT_REQUIRED';
  creatorAddress: string;
  ownerPublicKey: string;
  name: string;
  amount: string;
}

interface CancelSellNameTransaction {
  type: 'CANCEL_SELL_NAME';
  timestamp: number;
  reference: string;
  fee: string;
  signature: string;
  txGroupId: number;
  blockHeight: number;
  approvalStatus: 'NOT_REQUIRED';
  creatorAddress: string;
  ownerPublicKey: string;
  name: string;
}

interface BuyNameTransaction {
  type: 'BUY_NAME';
  timestamp: number;
  reference: string;
  fee: string;
  signature: string;
  txGroupId: number;
  blockHeight: number;
  approvalStatus: 'NOT_REQUIRED';
  creatorAddress: string;
  buyerPublicKey: string;
  name: string;
  amount: string;
  seller: string;
}

export type NameTransactions =
  | (RegisterNameTransaction & AdditionalFields)
  | (UpdateNameTransaction & AdditionalFields)
  | (SellNameTransaction & AdditionalFields)
  | (CancelSellNameTransaction & AdditionalFields)
  | (BuyNameTransaction & AdditionalFields);

type TransactionMap = {
  [signature: string]: NameTransactions;
};

export type TransactionCategory = NameTransactions['type'];

export type PendingTxsState = {
  [key in TransactionCategory]?: TransactionMap;
};

export interface Names {
  name: string;
  owner: string;
}
export interface NamesForSale {
  name: string;
  salePrice: number;
}
export const namesAtom = atom<Names[]>([]);
export const primaryNameAtom = atom('');
export const forSaleAtom = atom<NamesForSale[]>([]);
export const pendingTxsAtom = atom<PendingTxsState>({});

export const sortedPendingTxsByCategoryAtom = (category: string) =>
  atom((get) => {
    const txsByCategory = get(pendingTxsAtom)[category as TransactionCategory];
    if (!txsByCategory) return [];

    return Object.values(txsByCategory).sort(
      (a, b) => b.timestamp - a.timestamp
    ); // Newest to oldest
  });

export const allSortedPendingTxsAtom = atom((get) => {
  const allTxsByCategory = get(pendingTxsAtom);

  const allTxs = Object.values(allTxsByCategory)
    .flatMap((categoryMap) => Object.values(categoryMap))
    .filter((tx) => typeof tx.timestamp === 'number');

  return allTxs.sort((a, b) => b.timestamp - a.timestamp);
});

export const refreshAtom = atom(0);
export const forceRefreshAtom = atom(null, (get, set) => {
  set(refreshAtom, get(refreshAtom) + 1);
});
