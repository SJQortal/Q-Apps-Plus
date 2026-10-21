/**
 * The orders an account's groups can be listed in (Overview → Groups):
 * MINTER first (the default, then Core's order), by name, by members, its
 * own groups first (owner, then admin), or by when the group was made. Ties
 * go by name; a count or a date Core didn't give goes last. Pure.
 */
import type { GroupOf } from '../../data/explorer/account';

export type GroupSort =
  'minter' | 'az' | 'za' | 'members' | 'fewest' | 'roles' | 'newest' | 'oldest';

export const GROUP_SORTS: ReadonlyArray<{ value: GroupSort; label: string }> = [
  { value: 'minter', label: 'MINTER first' },
  { value: 'az', label: 'Name A–Z' },
  { value: 'za', label: 'Name Z–A' },
  { value: 'members', label: 'Most members' },
  { value: 'fewest', label: 'Fewest members' },
  { value: 'roles', label: 'Owner and admin first' },
  { value: 'newest', label: 'Newest group first' },
  { value: 'oldest', label: 'Oldest group first' },
];

export function isGroupSort(value: unknown): value is GroupSort {
  return GROUP_SORTS.some((option) => option.value === value);
}

const nameOf = (g: GroupOf) => g.groupName || `Group #${g.groupId}`;
const byName = (a: GroupOf, b: GroupOf) =>
  nameOf(a).localeCompare(nameOf(b), undefined, { sensitivity: 'base', numeric: true });

/** Bigger first (or smaller with `ascending`); a missing value goes last either way. */
function byValue(get: (g: GroupOf) => number | undefined, ascending: boolean) {
  return (a: GroupOf, b: GroupOf) => {
    const x = get(a);
    const y = get(b);
    if (x === undefined || y === undefined) {
      if (x === y) return byName(a, b);
      return x === undefined ? 1 : -1;
    }
    return (ascending ? x - y : y - x) || byName(a, b);
  };
}

/** Its part in the group: 0 owner, 1 admin, 2 member. */
function roleOf(g: GroupOf, address: string): number {
  if (g.owner === address) return 0;
  return g.isAdmin ? 1 : 2;
}

/** The groups in `sort`'s order (a new array). `minterId` goes first in the default order. */
export function sortGroups(
  groups: readonly GroupOf[],
  sort: GroupSort,
  address: string,
  minterId: number
): GroupOf[] {
  const list = [...groups];
  switch (sort) {
    case 'minter':
      return [
        ...list.filter((g) => g.groupId === minterId),
        ...list.filter((g) => g.groupId !== minterId),
      ];
    case 'az':
      return list.sort(byName);
    case 'za':
      return list.sort((a, b) => byName(b, a));
    case 'members':
      return list.sort(byValue((g) => g.memberCount, false));
    case 'fewest':
      return list.sort(byValue((g) => g.memberCount, true));
    case 'roles':
      return list.sort((a, b) => roleOf(a, address) - roleOf(b, address) || byName(a, b));
    case 'newest':
      return list.sort(byValue((g) => g.created, false));
    case 'oldest':
      return list.sort(byValue((g) => g.created, true));
  }
}
