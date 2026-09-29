import { describe, expect, it } from 'vitest';
import { defaultDirection, filterNamesForSale, sortNamesForSale } from './marketSort';

const rows = [
  { name: 'bob', salePrice: 5, registered: 300 },
  { name: 'Alice', salePrice: 20, registered: 100 },
  { name: 'carlos', salePrice: 5, registered: 200 },
];

describe('market sort and filter', () => {
  it('sorts by name ignoring case, with a stable name tiebreak', () => {
    expect(sortNamesForSale(rows, 'name', 'asc').map((r) => r.name)).toEqual(['Alice', 'bob', 'carlos']);
    expect(sortNamesForSale(rows, 'salePrice', 'asc').map((r) => r.name)).toEqual(['bob', 'carlos', 'Alice']);
    expect(sortNamesForSale(rows, 'salePrice', 'desc').map((r) => r.name)).toEqual(['Alice', 'bob', 'carlos']);
  });

  it('sorts by length and by registration time', () => {
    expect(sortNamesForSale(rows, 'length', 'asc').map((r) => r.name)).toEqual(['bob', 'Alice', 'carlos']);
    expect(sortNamesForSale(rows, 'registered', 'desc').map((r) => r.name)).toEqual(['bob', 'carlos', 'Alice']);
    expect(defaultDirection('registered')).toBe('desc');
    expect(defaultDirection('salePrice')).toBe('asc');
  });

  it('filters case-insensitively and leaves the input untouched', () => {
    expect(filterNamesForSale(rows, ' AL ').map((r) => r.name)).toEqual(['Alice']);
    expect(filterNamesForSale(rows, '')).toBe(rows);
  });
});
