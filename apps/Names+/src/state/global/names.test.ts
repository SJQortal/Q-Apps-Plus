import { describe, expect, it } from 'vitest';
import { createStore } from 'jotai';
import {
  allSortedPendingTxsAtom,
  isNamePendingTx,
  pendingTxsAtom,
  sortedPendingTxsByCategoryAtom,
  type NameTransactions,
  type PendingTxsState,
} from './names';

function tx(
  type: NameTransactions['type'],
  name: string,
  timestamp: number,
  signature = `${type}-${name}`
): NameTransactions {
  return {
    type,
    name,
    timestamp,
    signature,
    status: 'PENDING',
    callback: () => {},
  } as unknown as NameTransactions;
}

describe('pending name transactions', () => {
  const state: PendingTxsState = {
    REGISTER_NAME: { a: tx('REGISTER_NAME', 'alice', 10, 'a') },
    SELL_NAME: {
      b: tx('SELL_NAME', 'bob', 30, 'b'),
      c: tx('SELL_NAME', 'carol', 20, 'c'),
    },
  };

  it('finds a name in any category', () => {
    expect(isNamePendingTx('alice', state)).toBe(true);
    expect(isNamePendingTx('carol', state)).toBe(true);
    expect(isNamePendingTx('dave', state)).toBe(false);
    expect(isNamePendingTx('alice', {})).toBe(false);
  });

  it('sorts every pending transaction newest first', () => {
    const store = createStore();
    store.set(pendingTxsAtom, state);
    expect(store.get(allSortedPendingTxsAtom).map((t) => t.name)).toEqual([
      'bob',
      'carol',
      'alice',
    ]);
  });

  it('sorts one category newest first and returns [] for an empty one', () => {
    const store = createStore();
    store.set(pendingTxsAtom, state);
    expect(
      store.get(sortedPendingTxsByCategoryAtom('SELL_NAME')).map((t) => t.name)
    ).toEqual(['bob', 'carol']);
    expect(store.get(sortedPendingTxsByCategoryAtom('BUY_NAME'))).toEqual([]);
  });
});
