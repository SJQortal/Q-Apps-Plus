/**
 * The sponsored accounts' orders (Simon, 2026-10-16: sorting through the
 * Explorer): the first sponsored first (the default, as read), the latest
 * first, the shares still running first, those in MINTER now first, those
 * minting now first, or the most shares first. Ties keep the order of the
 * first share.
 */
import type { SponseeRow } from '../../../data/explorer/sets';

export type SponseeSort = 'first' | 'latest' | 'active' | 'member' | 'minting' | 'shares';

export const SPONSEE_SORTS: ReadonlyArray<{ value: SponseeSort; label: string }> = [
  { value: 'first', label: 'First sponsored first' },
  { value: 'latest', label: 'Latest sponsored first' },
  { value: 'active', label: 'Share still running first' },
  { value: 'member', label: 'In MINTER now first' },
  { value: 'minting', label: 'Minting now first' },
  { value: 'shares', label: 'Most reward shares first' },
];

export function isSponseeSort(value: unknown): value is SponseeSort {
  return SPONSEE_SORTS.some((sort) => sort.value === value);
}

const byStart = (a: SponseeRow, b: SponseeRow) =>
  a.start.height - b.start.height || a.start.timestamp - b.start.timestamp;

export function sortSponsees(rows: readonly SponseeRow[], sort: SponseeSort): SponseeRow[] {
  const first = (yes: (row: SponseeRow) => boolean) => (a: SponseeRow, b: SponseeRow) =>
    Number(yes(b)) - Number(yes(a));
  const primary: Record<SponseeSort, (a: SponseeRow, b: SponseeRow) => number> = {
    first: () => 0,
    latest: (a, b) => -byStart(a, b),
    active: first((row) => row.active),
    member: first((row) => row.member !== null),
    minting: first((row) => row.mintingNow),
    shares: (a, b) => b.shares - a.shares,
  };
  return [...rows].sort((a, b) => primary[sort](a, b) || byStart(a, b));
}
