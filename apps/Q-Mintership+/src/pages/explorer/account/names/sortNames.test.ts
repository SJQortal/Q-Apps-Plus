import { describe, expect, it } from 'vitest';
import type { TxRow } from '../../../../data/types';
import { isNameSort, sortNames } from './sortNames';

const tx = (name: string, timestamp: number): TxRow =>
  ({
    type: 'UPDATE_NAME',
    name,
    timestamp,
    signature: `${name}${timestamp}`,
    txGroupId: 0,
  }) as TxRow;

describe('sortNames', () => {
  const names = ['beta', 'Alpha', 'gamma', 'item 10', 'item 9'];

  it('puts the primary name first, then Core’s order (when each was registered)', () => {
    expect(sortNames(names, 'primary', 'gamma', null)).toEqual([
      'gamma',
      'beta',
      'Alpha',
      'item 10',
      'item 9',
    ]);
    expect(sortNames(names, 'primary', null, null)).toEqual(names);
    expect(sortNames(names, 'primary', 'not hers', null)).toEqual(names);
  });

  it('keeps or reverses Core’s order for oldest and newest', () => {
    expect(sortNames(names, 'oldest', 'gamma', null)).toEqual(names);
    expect(sortNames(names, 'newest', 'gamma', null)).toEqual([...names].reverse());
  });

  it('sorts A to Z and back, ignoring case, numbers as numbers', () => {
    expect(sortNames(names, 'az', null, null)).toEqual([
      'Alpha',
      'beta',
      'gamma',
      'item 9',
      'item 10',
    ]);
    expect(sortNames(names, 'za', null, null)).toEqual([
      'item 10',
      'item 9',
      'gamma',
      'beta',
      'Alpha',
    ]);
  });

  it('puts the most recently active name first; names with none read keep Core’s order', () => {
    const byName = new Map([
      ['gamma', [tx('gamma', 30), tx('gamma', 5)]],
      ['beta', [tx('beta', 50)]],
    ]);
    expect(sortNames(names, 'activity', null, byName)).toEqual([
      'beta',
      'gamma',
      'Alpha',
      'item 10',
      'item 9',
    ]);
    expect(sortNames(names, 'activity', null, null)).toEqual(names);
  });

  it('knows its own orders', () => {
    expect(isNameSort('az')).toBe(true);
    expect(isNameSort('size')).toBe(false);
  });
});
