/**
 * The Names tab's orders. Core lists an account's names in the order they
 * were registered (oldest first), so "Oldest" is Core's order and "Newest"
 * its reverse; "Primary first" (the default) is Core's order with the
 * primary name on top. "Latest activity" puts the name whose newest name
 * transaction is the most recent first (names with none read keep Core's
 * order, after them). No order reads anything. Pure.
 */
import type { TxRow } from '../../../../data/types';

export type NameSort = 'primary' | 'newest' | 'oldest' | 'az' | 'za' | 'activity';

export const NAME_SORTS: ReadonlyArray<{ value: NameSort; label: string }> = [
  { value: 'primary', label: 'Primary first' },
  { value: 'newest', label: 'Newest registered' },
  { value: 'oldest', label: 'Oldest registered' },
  { value: 'az', label: 'A to Z' },
  { value: 'za', label: 'Z to A' },
  { value: 'activity', label: 'Latest activity' },
];

export function isNameSort(value: unknown): value is NameSort {
  return NAME_SORTS.some((sort) => sort.value === value);
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/** `names` (Core's order) in the order picked. */
export function sortNames(
  names: readonly string[],
  sort: NameSort,
  primary: string | null,
  byName: ReadonlyMap<string, readonly TxRow[]> | null
): string[] {
  switch (sort) {
    case 'primary':
      return primary !== null && names.includes(primary)
        ? [primary, ...names.filter((name) => name !== primary)]
        : [...names];
    case 'oldest':
      return [...names];
    case 'newest':
      return [...names].reverse();
    case 'az':
      return [...names].sort(collator.compare);
    case 'za':
      return [...names].sort((a, b) => collator.compare(b, a));
    case 'activity': {
      const latest = (name: string) => byName?.get(name)?.[0]?.timestamp ?? -Infinity;
      // Array.sort is stable: names with no activity read keep Core's order.
      return [...names].sort((a, b) => latest(b) - latest(a));
    }
  }
}
