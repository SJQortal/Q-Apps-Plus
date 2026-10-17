/**
 * Searching the rows a tab has read (Simon, 2026-10-17: connections and
 * transactions, by typing part of something, similar words found too).
 * Rows are found by what they show (rules/explorer/searchText.ts) and by
 * the names of the accounts in them:
 *
 * - names already read for the session count at once; while a search is
 *   typed, the primary names of the tab's other accounts are read too (each
 *   `name:<address>`, shared with the whole app and kept 30 minutes), 4 at
 *   a time, at most NAME_READS for one tab, so a name finds its rows even
 *   when they were never on screen;
 * - what is typed is also looked up as the start of a registered name
 *   (data/nameSearch.ts findNameOwners: one small cached read per search),
 *   so a row of any account owning such a name, primary or not, matches,
 *   and says so (heldNameTag: "holds the name “Simon Dixon”") where the
 *   name it shows is another.
 *
 * Nothing is read until something is typed; nothing polls.
 */
import { useEffect, useMemo } from 'react';
import { getPrimaryName } from '../../../data/accounts';
import type { GroupLabel } from '../../../data/explorer/account';
import { runPool } from '../../../data/explorer/sets';
import {
  findNameOwners,
  NAME_SEARCH_LIMIT,
  nameMatchKey,
  type NameHit,
} from '../../../data/nameSearch';
import { visibleName } from '../../../rules/explorer/nameNotes';
import { getQueryState, peekQuery } from '../../../data/query';
import { useQuery } from '../../../hooks/useQuery';
import { useStoreValues } from '../../../hooks/useStoreValues';
import type { SearchNames } from '../../../rules/explorer/searchText';
import {
  foldText,
  matchQuery,
  parseQuery,
  type MatchStrength,
  type SearchQuery,
} from '../../../utils/fuzzySearch';

/** Primary names read for one tab's search, at most. */
export const NAME_READS = 300;

const quiet = () => undefined;

export interface RowSearch {
  /** What was typed, or null with no search. */
  query: SearchQuery | null;
  /** The names known now, for building a row's text. */
  names: SearchNames;
  /** Bumps as names come in, for memoizing rows' texts on it. */
  namesVersion: string;
  /**
   * How a row is found: 'match', 'similar' or null; 'match' for every row
   * with no search. `text` is what the row shows (folded or not), `accounts`
   * the accounts in it.
   */
  test: (row: {
    text: string;
    accounts?: readonly (string | null | undefined)[];
    folded?: boolean;
  }) => MatchStrength | null;
  /** Names are still being read for this search. */
  reading: boolean;
  /**
   * For an account found by a name it holds that starts with what was
   * typed, other than the name the row shows: "holds the name “Simon
   * Dixon”"; else null.
   */
  heldNameTag: (address: string | null | undefined) => string | null;
}

/** Search `rows` by `text`; `accounts` are every account the tab's rows involve. */
export function useRowSearch(text: string, accounts: readonly string[]): RowSearch {
  const query = useMemo(() => parseQuery(text), [text]);
  const active = query !== null;

  // The tab's accounts, once each, the first NAME_READS.
  const wanted = useMemo(() => {
    if (!active) return [];
    return [...new Set(accounts.filter((a) => typeof a === 'string' && /^[QA]/.test(a)))].slice(
      0,
      NAME_READS
    );
  }, [active, accounts]);
  const joined = wanted.join('\n');
  useEffect(() => {
    const todo = (joined ? joined.split('\n') : []).filter(
      // An AT has no name; one already read (or being read) needs nothing.
      (address) => address.startsWith('Q') && peekQuery(`name:${address}`) === undefined
    );
    void runPool(todo, 4, (address) => getPrimaryName(address).then(quiet, quiet));
  }, [joined]);
  const loaded = useStoreValues<string | null>(wanted.map((address) => `name:${address}`));
  const known = useMemo(() => {
    const map = new Map<string, string>();
    wanted.forEach((address, i) => {
      const name = loaded[i];
      if (typeof name === 'string' && name) map.set(address, name);
    });
    return map;
    // `loaded` is a new array each render: keyed on what it holds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, loaded.join('\n')]);
  // Still reading: a name not read yet or on its way (one that failed is done; an AT has none).
  const reading =
    active &&
    wanted.some((address) => {
      if (!address.startsWith('Q')) return false;
      const status = getQueryState(`name:${address}`).status;
      return status === 'idle' || status === 'loading';
    });

  // What is typed, as the start of a registered name: its owners.
  const ownersKey = active ? nameMatchKey(text) : null;
  const owners = useQuery(ownersKey, () => findNameOwners(text));
  const ownerSet = useMemo(() => new Set(owners.data ?? []), [owners.data]);
  // Which names each owner was found by (the search's own cached page; an owner
  // missing from it was found by the exact name typed).
  const heldBy = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!owners.data) return map;
    const typedName = text.trim();
    const hits =
      peekQuery<NameHit[]>(`namesearch:${NAME_SEARCH_LIMIT}:${typedName.toLowerCase()}`) ?? [];
    for (const hit of hits) map.set(hit.owner, [...(map.get(hit.owner) ?? []), hit.name]);
    for (const owner of owners.data) if (!map.has(owner)) map.set(owner, [typedName]);
    return map;
  }, [owners.data, text]);

  const names = useMemo<SearchNames>(
    () => ({
      nameOf: (address) =>
        known.get(address) ?? peekQuery<string | null>(`name:${address}`) ?? null,
      groupNameOf: (groupId) => peekQuery<GroupLabel>(`xgroup:${groupId}`)?.name ?? null,
    }),
    [known]
  );

  const test = useMemo<RowSearch['test']>(
    () => (row) => {
      if (!query) return 'match';
      const others = (row.accounts ?? []).filter((a): a is string => typeof a === 'string');
      const extra = others
        .map((address) => names.nameOf(address))
        .filter(Boolean)
        .join(' ');
      const haystack = row.folded
        ? `${row.text} ${foldText(extra)}`
        : foldText(`${row.text} ${others.join(' ')} ${extra}`);
      const found = matchQuery(query, haystack, { folded: true });
      if (found === 'match') return found;
      // An account owning a name that starts with what was typed.
      if (others.some((address) => ownerSet.has(address))) return 'match';
      return found;
    },
    [query, names, ownerSet]
  );

  const heldNameTag = useMemo<RowSearch['heldNameTag']>(
    () => (address) => {
      if (!query || !address) return null;
      const shown = names.nameOf(address)?.toLowerCase();
      const held = (heldBy.get(address) ?? []).filter((name) => name.toLowerCase() !== shown);
      if (!held.length) return null;
      const quoted = held.map((name) => `“${visibleName(name)}”`);
      if (quoted.length === 1) return `holds the name ${quoted[0]}`;
      if (quoted.length === 2) return `holds the names ${quoted[0]} and ${quoted[1]}`;
      return `holds the names ${quoted[0]}, ${quoted[1]} and ${quoted.length - 2} more`;
    },
    [query, names, heldBy]
  );

  return {
    query,
    names,
    namesVersion: `${known.size}:${owners.data?.length ?? 0}`,
    test,
    reading,
    heldNameTag,
  };
}
