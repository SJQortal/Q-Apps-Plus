import { describe, expect, it } from 'vitest';
import type { TxRow } from '../../../../data/types';
import { unchangedSince } from './byName';

const tx = (type: string) => ({ type, signature: type, timestamp: 1 }) as TxRow;

describe('a name unchanged since its registration', () => {
  it('is one whose own transactions, read in full, are just its registration', () => {
    expect(unchangedSince([tx('REGISTER_NAME')], false)).toBe(true);
    expect(unchangedSince([tx('REGISTER_NAME'), tx('UPDATE_NAME')], false)).toBe(false);
    expect(unchangedSince([tx('BUY_NAME')], false)).toBe(false);
    // Not known: a read that stopped short, one still loading, or none found.
    expect(unchangedSince([tx('REGISTER_NAME')], true)).toBe(false);
    expect(unchangedSince(undefined, false)).toBe(false);
    expect(unchangedSince([], false)).toBe(false);
  });
});
