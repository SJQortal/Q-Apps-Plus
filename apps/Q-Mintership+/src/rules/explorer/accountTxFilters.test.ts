import { describe, expect, it } from 'vitest';
import type { TxRow } from '../../data/types';
import {
  byAmount,
  DEFAULT_FILTERS,
  dayStart,
  filterSummary,
  filtersToParams,
  isAboutName,
  isFiltered,
  parseFilters,
  qortAmount,
  rangeProblem,
  typesToAsk,
  type TxFilters,
} from './accountTxFilters';

const params = (query: string) => {
  const p = new URLSearchParams(query);
  return (key: string) => p.get(key);
};
const tx = (over: Partial<TxRow>): TxRow =>
  ({
    type: 'PAYMENT',
    timestamp: 1,
    signature: Math.random().toString(36),
    txGroupId: 0,
    ...over,
  }) as TxRow;

describe('the filters in the URL', () => {
  it('reads every filter, and anything unknown as its default', () => {
    expect(parseFilters(params(''))).toEqual(DEFAULT_FILTERS);
    expect(
      parseFilters(
        params('kind=names&type=BUY_NAME&name=Q-Maps&when=dates&from=2026-09-01&order=oldest')
      )
    ).toEqual({
      kind: 'names',
      type: 'BUY_NAME',
      name: 'Q-Maps',
      when: 'dates',
      from: '2026-09-01',
      to: null,
      order: 'oldest',
    });
    // A type of another kind, a bad date, a block in a date range, an unknown order.
    expect(
      parseFilters(
        params('kind=payments&type=BUY_NAME&when=dates&from=2026-02-30&to=27000&order=size')
      )
    ).toEqual({ ...DEFAULT_FILTERS, kind: 'payments', when: 'dates' });
    expect(parseFilters(params('when=blocks&from=2700000&to=x'))).toMatchObject({
      when: 'blocks',
      from: '2700000',
      to: null,
    });
  });

  it('writes each filter, leaving out the defaults, and round-trips', () => {
    expect(filtersToParams(DEFAULT_FILTERS)).toEqual({
      kind: null,
      type: null,
      name: null,
      when: null,
      from: null,
      to: null,
      order: null,
    });
    const picked: TxFilters = {
      kind: 'qdn',
      type: null,
      name: 'Q-Maps',
      when: 'blocks',
      from: '2700000',
      to: '2710000',
      order: 'amount',
    };
    const written = new URLSearchParams(
      Object.entries(filtersToParams(picked)).filter((e): e is [string, string] => e[1] !== null)
    );
    expect(parseFilters((key) => written.get(key))).toEqual(picked);
    expect(isFiltered(picked)).toBe(true);
    expect(isFiltered(DEFAULT_FILTERS)).toBe(false);
    // "Last 7 days" keeps no from/to.
    expect(filtersToParams({ ...DEFAULT_FILTERS, when: '7d', from: '1' })).toMatchObject({
      when: '7d',
      from: null,
    });
  });
});

describe('typesToAsk', () => {
  it('asks for the kind’s types, the exact type, or with a name only the types that carry one', () => {
    expect(typesToAsk(DEFAULT_FILTERS)).toEqual([]);
    expect(typesToAsk({ ...DEFAULT_FILTERS, kind: 'qdn' })).toEqual(['ARBITRARY']);
    expect(typesToAsk({ ...DEFAULT_FILTERS, kind: 'names', type: 'BUY_NAME' })).toEqual([
      'BUY_NAME',
    ]);
    expect(typesToAsk({ ...DEFAULT_FILTERS, name: 'Q-Maps' })).toEqual([
      'REGISTER_NAME',
      'UPDATE_NAME',
      'SELL_NAME',
      'CANCEL_SELL_NAME',
      'BUY_NAME',
      'ARBITRARY',
    ]);
    expect(typesToAsk({ ...DEFAULT_FILTERS, kind: 'qdn', name: 'Q-Maps' })).toEqual(['ARBITRARY']);
    // Payments are never about a name.
    expect(typesToAsk({ ...DEFAULT_FILTERS, kind: 'payments', name: 'Q-Maps' })).toBeNull();
  });

  it('matches a name, and a rename’s new name', () => {
    expect(isAboutName(tx({ type: 'ARBITRARY', name: 'Q-Maps' }), 'Q-Maps')).toBe(true);
    expect(isAboutName(tx({ type: 'UPDATE_NAME', name: 'Old', newName: 'Q-Maps' }), 'Q-Maps')).toBe(
      true
    );
    expect(isAboutName(tx({ type: 'ARBITRARY', name: 'q-maps' }), 'Q-Maps')).toBe(false);
  });
});

describe('biggest amount first', () => {
  it('counts the QORT each moves, and puts the ones that move none last', () => {
    expect(qortAmount(tx({ amount: '1.5' }))).toBe(150_000_000n);
    expect(qortAmount(tx({ type: 'TRANSFER_ASSET', amount: '9', assetId: 3 }))).toBeNull();
    expect(
      qortAmount(
        tx({
          type: 'MULTI_PAYMENT',
          payments: [
            { recipient: 'a', amount: '1', assetId: 0 },
            { recipient: 'b', amount: '2.5', assetId: 0 },
            { recipient: 'c', amount: '100', assetId: 7 },
          ],
        })
      )
    ).toBe(350_000_000n);
    expect(qortAmount(tx({ type: 'REGISTER_NAME' }))).toBeNull();
    const rows = [
      tx({ signature: 'none1', type: 'REGISTER_NAME' }),
      tx({ signature: 'small', amount: '0.1' }),
      tx({ signature: 'none2', type: 'JOIN_GROUP' }),
      tx({ signature: 'big', type: 'BUY_NAME', amount: '250' }),
    ];
    expect(byAmount(rows).map((r) => r.signature)).toEqual(['big', 'small', 'none1', 'none2']);
  });
});

describe('ranges typed', () => {
  it('reads a day as its local midnight, and refuses a day that doesn’t exist', () => {
    expect(new Date(dayStart('2026-09-01')).getHours()).toBe(0);
    expect(new Date(dayStart('2026-09-01')).getDate()).toBe(1);
    expect(dayStart('2026-02-30')).toBeNaN();
  });

  it('says what is wrong with a range', () => {
    const today = '2026-10-16';
    expect(rangeProblem('dates', '', '', today, null)).toBe(
      'Pick a first day, a last day, or both.'
    );
    expect(rangeProblem('dates', '2026-11-01', '', today, null)).toBe(
      'The first day is in the future.'
    );
    expect(rangeProblem('dates', '2026-09-30', '2026-09-01', today, null)).toBe(
      'The first day is after the last day.'
    );
    expect(rangeProblem('dates', '2026-09-01', '', today, null)).toBeNull();
    expect(rangeProblem('blocks', '27x', '', today, 100)).toBe(
      'Enter block numbers, like 2700000 or 2,700,000.'
    );
    // As the app shows them, with separators.
    expect(rangeProblem('blocks', '1,519,621', '1 600 000', today, 2_000_000)).toBeNull();
    expect(rangeProblem('blocks', '1,600,000', '1,519,621', today, 2_000_000)).toBe(
      'The first block is after the last block.'
    );
    expect(rangeProblem('blocks', '200', '', today, 100)).toBe('The chain is at block 100.');
    expect(rangeProblem('blocks', '50', '10', today, 100)).toBe(
      'The first block is after the last block.'
    );
    expect(rangeProblem('blocks', '', '10', today, 100)).toBeNull();
  });

  it('sums up what is picked in one line', () => {
    expect(filterSummary(DEFAULT_FILTERS, 'All')).toBeNull();
    expect(
      filterSummary(
        { ...DEFAULT_FILTERS, kind: 'names', name: 'Q-Maps', when: '7d', order: 'oldest' },
        'Names'
      )
    ).toBe('Names about “Q-Maps” · last 7 days · oldest first');
    expect(
      filterSummary({ ...DEFAULT_FILTERS, when: 'blocks', from: '2700000', to: '2700100' }, 'All')
    ).toBe('All transactions · blocks 2,700,000–2,700,100');
    expect(filterSummary({ ...DEFAULT_FILTERS, kind: 'names', type: 'BUY_NAME' }, 'Names')).toBe(
      'Name purchase'
    );
  });
});
