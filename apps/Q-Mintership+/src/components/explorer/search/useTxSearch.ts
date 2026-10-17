/**
 * The search over a list of transactions (an account's Transactions tab):
 * each row's text as the row shows it (rules/explorer/searchText.ts, told
 * from the list's account, a minting level's recipient as the row says
 * it), the accounts in it, and useRowSearch. Rows that match come first,
 * in the list's order, then those only similar.
 */
import { useCallback, useMemo } from 'react';
import { peekQuery } from '../../../data/query';
import type { TxRow } from '../../../data/types';
import { txSearchText } from '../../../rules/explorer/searchText';
import { describeTx, type TxWords } from '../../../rules/explorer/txWords';
import { foldText } from '../../../utils/fuzzySearch';
import { shortAddress } from '../../../utils/format';
import { useRowSearch, type RowSearch } from './useRowSearch';

export interface TxSearchTiers {
  /** Rows that match, in the list's order. */
  match: TxRow[];
  /** Rows only similar, in the list's order. */
  similar: TxRow[];
}

/** describeTx as a row in `viewpoint`'s list says it (useTxWords' rule, without a read). */
function wordsOf(tx: TxRow, viewpoint: string | null): TxWords {
  const privs = tx.type === 'TRANSFER_PRIVS';
  const toViewpoint = privs && viewpoint && tx.creatorAddress !== viewpoint ? viewpoint : null;
  const privsRecipient =
    toViewpoint ?? (privs ? (peekQuery<string | null>(`xprivs:${tx.signature}`) ?? null) : null);
  return describeTx(tx, { viewpoint, privsRecipient });
}

export function useTxSearch(
  rows: readonly TxRow[],
  viewpoint: string | null,
  text: string
): RowSearch & {
  tiers: TxSearchTiers | null;
  tiersOf: (rows: readonly TxRow[]) => TxSearchTiers;
  /** Why the search found a row, when an account in it was found by a name it holds. */
  hintOf: (tx: TxRow) => string | null;
} {
  const active = text.trim() !== '';
  const described = useMemo(
    () => (active ? rows.map((tx) => ({ tx, words: wordsOf(tx, viewpoint) })) : []),
    [active, rows, viewpoint]
  );
  const accounts = useMemo(() => described.flatMap(({ words }) => words.participants), [described]);
  const search = useRowSearch(text, accounts);
  const { query, names, test } = search;

  const tiersOf = useCallback(
    (list: readonly TxRow[], known?: ReadonlyArray<{ tx: TxRow; words: TxWords }>) => {
      const tiers: TxSearchTiers = { match: [], similar: [] };
      const entries = known ?? list.map((tx) => ({ tx, words: wordsOf(tx, viewpoint) }));
      for (const { tx, words } of entries) {
        const found = test({
          text: foldText(txSearchText(tx, words, names)),
          accounts: words.participants,
          folded: true,
        });
        if (found === 'match') tiers.match.push(tx);
        else if (found === 'similar') tiers.similar.push(tx);
      }
      return tiers;
    },
    [names, test, viewpoint]
  );
  const tiers = useMemo(
    () => (query ? tiersOf(rows, described) : null),
    [query, rows, described, tiersOf]
  );
  const participants = useMemo(
    () => new Map(described.map(({ tx, words }) => [tx.signature, words.participants])),
    [described]
  );
  const { heldNameTag } = search;
  const hintOf = useCallback(
    (tx: TxRow) => {
      for (const address of participants.get(tx.signature) ?? []) {
        const tag = heldNameTag(address);
        if (tag) return `${names.nameOf(address) ?? shortAddress(address)} ${tag}`;
      }
      return null;
    },
    [participants, heldNameTag, names]
  );
  return { ...search, tiers, tiersOf: (list) => tiersOf(list), hintOf };
}
