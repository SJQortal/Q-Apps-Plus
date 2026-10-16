import { describe, expect, it } from 'vitest';
import { inCommonState } from './compareView';
import type { CompareData } from './useCompareData';

const A = `Q${'a'.repeat(33)}`;
const B = `Q${'b'.repeat(33)}`;

const read = (data: unknown) => ({
  data,
  error: undefined,
  isError: false,
  isLoading: data === undefined,
  refetch: async () => undefined,
});
const both = (data: unknown) => [read(data), read(data)];

/** What In common reads for two accounts, every read in and nothing shared. */
function compareData(part: Record<string, unknown> = {}): CompareData {
  return {
    live: [A, B],
    links: both({ rows: [], truncated: false, privs: {} }),
    first: both({ firstOwn: null, funding: null, firstSeen: null }),
    sent: both({ rows: [], nextOffset: 0, done: true }),
    recv: both({ rows: [], nextOffset: 0, done: true }),
    assets: both({ rows: [], truncated: false }),
    groups: both([]),
    sponsors: [],
    firstPayers: [],
    counterparties: { rows: [], atLeftOut: 0, busyLeftOut: 0 },
    groupsShared: [],
    timing: [],
    ...part,
  } as unknown as CompareData;
}

describe('In common', () => {
  it('every check read and nothing shared: each is none found', () => {
    expect(inCommonState(compareData())).toMatchObject({
      reading: false,
      any: false,
      empty: [
        'a shared sponsor',
        'a shared first payer',
        'the same accounts in their payments',
        'shared groups (MINTER aside)',
      ],
      failed: [],
    });
  });

  it('shared accounts that were all left out are not “none found”', () => {
    for (const counterparties of [
      { rows: [], atLeftOut: 1, busyLeftOut: 0 },
      { rows: [], atLeftOut: 0, busyLeftOut: 2 },
    ]) {
      const state = inCommonState(compareData({ counterparties }));
      expect(state.empty).not.toContain('the same accounts in their payments');
      expect(state.empty).toContain('a shared sponsor');
      // The section shows, for its "none besides these. Left out: …" line.
      expect(state.any).toBe(true);
    }
  });
});
