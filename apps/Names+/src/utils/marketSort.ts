import type { NamesForSale } from '../state/global/names';
import type { SortBy, SortDirection } from '../interfaces';

export const SORT_KEYS: SortBy[] = ['name', 'salePrice', 'length', 'registered'];

/** The direction that makes sense first for each key: newest first, cheapest first, A first. */
export function defaultDirection(sortBy: SortBy): SortDirection {
  return sortBy === 'registered' ? 'desc' : 'asc';
}

export function filterNamesForSale(rows: NamesForSale[], filter: string): NamesForSale[] {
  const needle = filter.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => row.name.toLowerCase().includes(needle));
}

export function sortNamesForSale(
  rows: NamesForSale[],
  sortBy: SortBy,
  direction: SortDirection
): NamesForSale[] {
  const sign = direction === 'asc' ? 1 : -1;
  const byName = (a: NamesForSale, b: NamesForSale) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  return [...rows].sort((a, b) => {
    let result = 0;
    switch (sortBy) {
      case 'salePrice':
        result = Number(a.salePrice) - Number(b.salePrice);
        break;
      case 'length':
        result = a.name.length - b.name.length;
        break;
      case 'registered':
        result = (a.registered ?? 0) - (b.registered ?? 0);
        break;
      default:
        result = byName(a, b);
    }
    if (Number.isNaN(result)) result = 0;
    return result !== 0 ? sign * result : byName(a, b);
  });
}
