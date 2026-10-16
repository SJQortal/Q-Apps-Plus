import { describe, expect, it } from 'vitest';
import { coverageLines, inCommonState } from './compareView';
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
const failedRead = () => ({
  data: undefined,
  error: new Error('down'),
  isError: true,
  isLoading: false,
  refetch: async () => undefined,
});
const made = (part: Record<string, unknown> = {}) => ({
  names: [],
  namesTruncated: false,
  truncated: [],
  ...part,
});

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
    made: both(made()),
    trades: both({ rows: [], capped: false }),
    sides: [{ trades: { rows: [], capped: false } }, { trades: { rows: [], capped: false } }],
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

describe('Copy findings: what was read', () => {
  it('every read in: how far each one goes', () => {
    expect(coverageLines(compareData(), { paymentsBetween: true })).toEqual([
      'Payments between each pair: every QORT payment each way, up to the newest 100.',
      'Asset transfers and multi-payments: each account’s newest 100.',
      'Trade portal sales: each account’s newest 100.',
      'Reward shares, level moves and name sales: all of each account’s.',
      'Q-Mintership records: under every name each account owns.',
      'The same accounts in their payments: in each account’s newest 100 QORT payments each way and newest 100 asset transfers and multi-payments.',
    ]);
  });

  it('says which reads are capped, still out or failed, instead of claiming all', () => {
    const lines = coverageLines(
      compareData({
        links: [read({ rows: [], truncated: true, privs: {} }), read(undefined)],
        made: [read(made({ namesTruncated: true })), read(made({ truncated: ['vote'] }))],
        assets: [read({ rows: [], truncated: false }), failedRead()],
        trades: [read({ rows: [], capped: false }), read(undefined)],
        sides: [{ trades: { rows: [], capped: false } }, { trades: undefined }],
      }),
      { paymentsBetween: false }
    );
    expect(lines).toEqual([
      'Payments between each pair: from the sender’s newest 100 QORT payments (this node can’t search the payments between two accounts).',
      'Asset transfers and multi-payments: A’s newest 100; couldn’t be read for B.',
      'Trade portal sales: A’s newest 100; not read yet for B.',
      'Reward shares, level moves and name sales: A’s newest 500 (every level move read); not read yet for B.',
      'Q-Mintership records: under every name each account owns; only the first 500 names of A; some kinds stopped at their ceiling for B (the newest 300 records of a kind per 40 names).',
      'The same accounts in their payments: in A’s newest 100 QORT payments each way and newest 100 asset transfers and multi-payments; couldn’t be read for B.',
    ]);
    // Nothing read yet for anyone: no claim at all, only that it is still out.
    expect(coverageLines(compareData({ links: [read(undefined), read(undefined)] }))[3]).toBe(
      'Reward shares, level moves and name sales: not read yet for A and B.'
    );
  });
});
