import { beforeEach, describe, expect, it } from 'vitest';
import { fetchCallsFor, mockFetchRoute } from '../../test/setup';
import { invalidate, peekQuery, resetQueries } from '../query';
import type { TxRow } from '../types';
import {
  accountTxKey,
  getAccountTx,
  getUnconfirmedOf,
  mergeNewest,
  mergeOlder,
  unconfirmedKey,
  type AccountTxList,
} from './accountTx';
import { dropHeavy, heavy, HeavyCancelled } from './heavy';

const A = 'QSeDMkseNfi9b5K5no8aX8jqc3y78vuxr7';
const PK = '8nYB4aUv1kD7S3c9f5j2bE6Wq1xH4rTzP3mL9vK2sA7d';

/** Core's list for A, newest first: signature `s<n>`, higher n newer. */
function txs(from: number, to: number): TxRow[] {
  const rows: TxRow[] = [];
  for (let n = from; n >= to; n--)
    rows.push({ type: 'PAYMENT', timestamp: n * 1000, signature: `s${n}`, txGroupId: 0 });
  return rows;
}

/** Answer the address search from `list` (newest first), as Core pages it. */
function serve(list: () => TxRow[]) {
  mockFetchRoute('/transactions/search', (url: URL) => {
    const offset = Number(url.searchParams.get('offset'));
    const limit = Number(url.searchParams.get('limit'));
    return list().slice(offset, offset + limit);
  });
}

const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => resetQueries());

describe('accountTxKey', () => {
  it('is one key per list: the family’s types sorted, or all', () => {
    expect(accountTxKey(A, [])).toBe(`xtx:${A}:all`);
    expect(accountTxKey(A, ['TRANSFER_ASSET', 'PAYMENT', 'MULTI_PAYMENT'])).toBe(
      `xtx:${A}:MULTI_PAYMENT,PAYMENT,TRANSFER_ASSET`
    );
  });
});

describe('getAccountTx', () => {
  it('reads the newest 100, confirmed, newest first, with each type repeated', async () => {
    serve(() => txs(250, 1));
    const list = await getAccountTx(A, ['PAYMENT', 'MULTI_PAYMENT']);
    const [call] = fetchCallsFor('/transactions/search');
    const params = new URL(call, 'http://x').searchParams;
    expect(params.get('address')).toBe(A);
    expect(params.getAll('txType')).toEqual(['PAYMENT', 'MULTI_PAYMENT']);
    expect(params.get('confirmationStatus')).toBe('CONFIRMED');
    expect(params.get('limit')).toBe('100');
    expect(params.get('offset')).toBe('0');
    expect(params.get('reverse')).toBe('true');
    expect(call.indexOf('address=')).toBeLessThan(call.indexOf('txType='));
    expect(list.rows).toHaveLength(100);
    expect(list.rows[0].signature).toBe('s250');
    expect(list).toMatchObject({ nextOffset: 100, done: false });
    expect(peekQuery(`xtx:${A}:MULTI_PAYMENT,PAYMENT`)).toBe(list);
  });

  it('asks for no type at all for All', async () => {
    serve(() => txs(3, 1));
    const list = await getAccountTx(A, []);
    expect(fetchCallsFor('/transactions/search')[0]).not.toContain('txType');
    expect(list).toMatchObject({ nextOffset: 3, done: true });
  });

  it('appends older pages, skipping rows it already holds', async () => {
    let list = txs(250, 1);
    serve(() => list);
    await getAccountTx(A, []);
    // Two arrive before "Load older": Core's offsets move by two.
    list = txs(252, 1);
    const older = await getAccountTx(A, [], { older: true });
    expect(
      new URL(fetchCallsFor('/transactions/search')[1], 'http://x').searchParams.get('offset')
    ).toBe('100');
    expect(older.rows).toHaveLength(198);
    expect(new Set(older.rows.map((r) => r.signature)).size).toBe(198);
    expect(older.rows.at(-1)?.signature).toBe('s53');
    expect(older).toMatchObject({ nextOffset: 200, done: false });
    const last = await getAccountTx(A, [], { older: true });
    expect(last.rows.at(-1)?.signature).toBe('s1');
    expect(last.done).toBe(true);
    // Done: nothing more is read.
    await getAccountTx(A, [], { older: true });
    expect(fetchCallsFor('/transactions/search')).toHaveLength(3);
  });

  it('on Refresh puts the new rows on top and shifts the offset by them, leaving no gap', async () => {
    let list = txs(250, 1);
    serve(() => list);
    await getAccountTx(A, []);
    await getAccountTx(A, [], { older: true });
    list = txs(253, 1);
    invalidate(`xtx:${A}:`);
    const fresh = await getAccountTx(A, [], { force: true });
    expect(fresh.rows.slice(0, 3).map((r) => r.signature)).toEqual(['s253', 's252', 's251']);
    expect(fresh.rows).toHaveLength(203);
    expect(fresh.nextOffset).toBe(203);
    const older = await getAccountTx(A, [], { older: true });
    const offsets = fetchCallsFor('/transactions/search').map((c) =>
      new URL(c, 'http://x').searchParams.get('offset')
    );
    expect(offsets).toEqual(['0', '100', '0', '203']);
    // Every row once, in Core's order: nothing skipped, nothing repeated.
    expect(older.rows.map((r) => r.signature)).toEqual(list.slice(0, 253).map((r) => r.signature));
  });

  it('starts over when more than a page arrived since', () => {
    const before: AccountTxList = {
      rows: txs(150, 1),
      nextOffset: 150,
      done: true,
      checkedAt: 1,
    };
    const merged = mergeNewest(before, txs(400, 301));
    expect(merged.rows.map((r) => r.signature)).toEqual(txs(400, 301).map((r) => r.signature));
    expect(merged).toMatchObject({ nextOffset: 100, done: false });
  });

  it('takes a short newest page as the whole list', () => {
    const before: AccountTxList = { rows: txs(5, 1), nextOffset: 5, done: true, checkedAt: 1 };
    expect(mergeNewest(before, txs(7, 1))).toMatchObject({ nextOffset: 7, done: true });
    expect(mergeNewest(before, txs(7, 1)).rows).toHaveLength(7);
    expect(mergeOlder(before, []).done).toBe(true);
  });

  it('waits for the heavy-read limiter, scoped to the account', async () => {
    serve(() => txs(10, 1));
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const busy = [heavy('other', () => gate), heavy('other', () => gate)];
    const read = getAccountTx(A, []);
    await tick();
    expect(fetchCallsFor('/transactions/search')).toHaveLength(0);
    dropHeavy(A);
    await expect(read).rejects.toBeInstanceOf(HeavyCancelled);
    release();
    await Promise.all(busy);
    await expect(getAccountTx(A, [])).resolves.toMatchObject({ done: true });
  });
});

describe('getUnconfirmedOf', () => {
  it('reads what the account sent from the mempool by its public key, kept 20 s', async () => {
    mockFetchRoute('/transactions/unconfirmed', [
      { type: 'PAYMENT', timestamp: 1, signature: 'old', txGroupId: 0 },
      { type: 'PAYMENT', timestamp: 2, signature: 'new', txGroupId: 0 },
    ]);
    const rows = await getUnconfirmedOf(PK);
    expect(rows.map((r) => r.signature)).toEqual(['new', 'old']);
    const [call] = fetchCallsFor('/transactions/unconfirmed');
    expect(new URL(call, 'http://x').searchParams.get('creator')).toBe(PK);
    expect(unconfirmedKey(PK)).toBe(`xunconf:${PK}`);
    expect(peekQuery(`xunconf:${PK}`)).toBe(rows);
    await getUnconfirmedOf(PK);
    expect(fetchCallsFor('/transactions/unconfirmed')).toHaveLength(1);
  });
});
