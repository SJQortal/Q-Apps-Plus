import { describe, expect, it } from 'vitest';
import type { TxRow } from '../../data/types';
import { alikeRuns, firstRuns } from './alikeRuns';

const JACOB = 'QdRETwrRUCXYFmYKmGFagohivu327PjPds';
const GIVER = 'Qcf3cJLh6BqnB4u5B4Z77KvuhoPj28YhP5';
const OTHER = 'QPdUFvVHi9ihxrx66ZY3Qs4GomPhAX1yuU1';

let n = 0;
const row = (fields: Partial<TxRow>): TxRow => ({
  type: 'PAYMENT',
  timestamp: 1_000 + n,
  signature: `sig${n++}`,
  txGroupId: 0,
  blockHeight: 100,
  ...fields,
});

describe('runs of alike transactions', () => {
  it('puts consecutive rows that say the same thing together, whatever their block', () => {
    const moves = Array.from({ length: 6 }, () =>
      row({ type: 'TRANSFER_PRIVS', creatorAddress: GIVER, blockHeight: 1_585_006 })
    );
    const pay = row({ creatorAddress: JACOB, recipient: OTHER, amount: '29.8' });
    const runs = alikeRuns([pay, ...moves], JACOB);
    expect(runs.map((r) => r.length)).toEqual([1, 6]);

    const publishes = [10, 11, 15].map((h) =>
      row({
        type: 'ARBITRARY',
        creatorAddress: GIVER,
        name: 'crowetic',
        service: 'DOCUMENT_PRIVATE',
        identifier: `id${h}`,
        blockHeight: h,
      })
    );
    expect(alikeRuns(publishes).map((r) => r.length)).toEqual([3]);
  });

  it('keeps apart what reads differently, what isn’t next to each other, and what waits', () => {
    const a = row({ creatorAddress: JACOB, recipient: OTHER, amount: '1' });
    const b = row({ creatorAddress: JACOB, recipient: OTHER, amount: '2' });
    const c = row({ creatorAddress: JACOB, recipient: OTHER, amount: '1' });
    expect(alikeRuns([a, b, c], JACOB).map((r) => r.length)).toEqual([1, 1, 1]);
    const waiting = [
      row({ creatorAddress: JACOB, recipient: OTHER, amount: '1', blockHeight: undefined }),
      row({ creatorAddress: JACOB, recipient: OTHER, amount: '1', blockHeight: undefined }),
    ];
    expect(alikeRuns(waiting, JACOB).map((r) => r.length)).toEqual([1, 1]);
  });

  it('never groups level moves where their recipients can’t be told apart', () => {
    const moves = [1, 2].map(() =>
      row({ type: 'TRANSFER_PRIVS', creatorAddress: GIVER, blockHeight: 5 })
    );
    // From the giver's side, or on the whole chain's list: each its own row.
    expect(alikeRuns(moves, GIVER).map((r) => r.length)).toEqual([1, 1]);
    expect(alikeRuns(moves).map((r) => r.length)).toEqual([1, 1]);
  });

  it('takes the first lines whole', () => {
    const rows = [
      row({ creatorAddress: JACOB, recipient: OTHER, amount: '1' }),
      ...Array.from({ length: 3 }, () =>
        row({ type: 'TRANSFER_PRIVS', creatorAddress: GIVER, blockHeight: 7 })
      ),
      row({ creatorAddress: JACOB, recipient: OTHER, amount: '5' }),
    ];
    expect(firstRuns(rows, 2, JACOB)).toHaveLength(4);
  });
});
