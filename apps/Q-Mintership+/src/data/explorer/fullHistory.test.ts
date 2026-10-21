/**
 * The whole history, once read, feeds the Connections reads (fullHistory.ts;
 * Simon, 2026-10-21: "since I fetched all the accounts transactions in
 * overview, it should show all history in connections and so on").
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { fetchCallsFor, mockFetchRoute } from '../../test/setup';
import { getQueryState, resetQueries, setQueryData } from '../query';
import { accountTxKey, getAccountTx } from './accountTx';
import { allListKey, fullHistory, noteAllList, resetFullHistory } from './fullHistory';
import { getLinks } from './links';
import { payKey } from './money';

const A = `Q${'a'.repeat(33)}`;
const B = `Q${'b'.repeat(33)}`;

const row = (type: string, i: number, extra: Record<string, unknown> = {}) => ({
  type,
  signature: `${type}${i}`.padEnd(88, 'x'),
  timestamp: 1_000_000 - i,
  blockHeight: 900_000 - i,
  creatorAddress: A,
  ...extra,
});

beforeEach(() => {
  resetQueries();
  resetFullHistory();
});

describe('the whole history', () => {
  it('is the All list of accountTx.ts, and only once it is read to its end', () => {
    expect(allListKey(A)).toBe(accountTxKey(A, []));
    expect(fullHistory(A)).toBeNull();
    setQueryData(allListKey(A), { rows: [row('PAYMENT', 1)], nextOffset: 100, done: false });
    expect(fullHistory(A)).toBeNull();
    setQueryData(allListKey(A), { rows: [row('PAYMENT', 1)], nextOffset: 1, done: true });
    expect(fullHistory(A)).toHaveLength(1);
  });

  it('gives the links search every reward share, level move and name sale, with no search', async () => {
    const rows = [
      row('PAYMENT', 1, { recipient: B }),
      ...Array.from({ length: 700 }, (_, i) => row('REWARD_SHARE', i + 2, { recipient: B })),
      row('BUY_NAME', 800, { creatorAddress: B, seller: A }),
    ];
    setQueryData(allListKey(A), { rows, nextOffset: rows.length, done: true });
    const links = await getLinks(A);
    expect(links.rows).toHaveLength(701);
    expect(links.truncated).toBe(false);
    expect(fetchCallsFor('/transactions/search')).toEqual([]);
  });

  it('reaching its end marks the Connections reads stale, once per new length', async () => {
    // A small account: its first page is the whole history.
    mockFetchRoute('/transactions/search', [row('PAYMENT', 1, { recipient: B })]);
    setQueryData(payKey(A, 'sent'), { rows: [], nextOffset: 0, done: true });
    const before = getQueryState(payKey(A, 'sent'));
    const list = await getAccountTx(A, []);
    expect(list.done).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(getQueryState(payKey(A, 'sent'))).not.toBe(before);
    const marked = getQueryState(payKey(A, 'sent'));
    noteAllList(A, list);
    expect(getQueryState(payKey(A, 'sent'))).toBe(marked);
  });
});
