import { beforeEach, describe, expect, it } from 'vitest';
import { fetchCallsFor, mockFetchRoute } from '../../test/setup';
import { getQueryState, peekQuery, resetQueries } from '../query';
import {
  getGlobalTx,
  getGlobalWaiting,
  globalTxKey,
  globalWaitingKey,
  rangeFor,
  resetGlobalTxSlots,
} from './globalTx';

const params = (call: string) => new URL(call, 'http://x').searchParams;

beforeEach(() => {
  resetQueries();
  resetGlobalTxSlots();
});

describe('rangeFor', () => {
  it('covers the latest 1,000 or 10,000 blocks up to the tip, or 10,000 from a block', () => {
    expect(rangeFor({ kind: 'latest', blocks: 1000 }, 2_757_500)).toEqual({
      start: 2_756_501,
      limit: 1000,
    });
    expect(rangeFor({ kind: 'latest', blocks: 10000 }, 2_757_500)).toEqual({
      start: 2_747_501,
      limit: 10_000,
    });
    expect(rangeFor({ kind: 'from', start: 2_600_000 }, 2_757_500)).toEqual({
      start: 2_600_000,
      limit: 10_000,
    });
  });

  it('never reaches past the tip, so a range’s rows don’t move while it is paged', () => {
    expect(rangeFor({ kind: 'from', start: 2_757_000 }, 2_757_500)).toEqual({
      start: 2_757_000,
      limit: 501,
    });
    expect(rangeFor({ kind: 'latest', blocks: 1000 }, 400)).toEqual({ start: 1, limit: 400 });
    expect(rangeFor({ kind: 'from', start: 0 }, 400).start).toBe(1);
  });
});

describe('getGlobalTx', () => {
  it('asks for 20 confirmed rows of the types in a block range, newest first', async () => {
    mockFetchRoute('/transactions/search', [{ type: 'PAYMENT', signature: 's1', timestamp: 1 }]);
    const page = await getGlobalTx(['PAYMENT', 'TRANSFER_ASSET'], { start: 100, limit: 1000 }, 40);
    const [call] = fetchCallsFor('/transactions/search');
    expect(call).toBe(
      '/transactions/search?txType=PAYMENT&txType=TRANSFER_ASSET&startBlock=100&blockLimit=1000&confirmationStatus=CONFIRMED&limit=20&offset=40&reverse=true'
    );
    expect(page).toMatchObject({ offset: 40, done: true });
    expect(
      peekQuery(globalTxKey(['PAYMENT', 'TRANSFER_ASSET'], { start: 100, limit: 1000 }, 40))
    ).toBe(page);
    expect(globalTxKey(['TRANSFER_ASSET', 'PAYMENT'], { start: 100, limit: 1000 }, 40)).toBe(
      'xglobal:PAYMENT,TRANSFER_ASSET:100:1000:40'
    );
  });

  it('every type: no txType, still 20 rows and a block range', async () => {
    mockFetchRoute('/transactions/search', () =>
      Array.from({ length: 20 }, (_, i) => ({ type: 'PAYMENT', signature: `s${i}`, timestamp: i }))
    );
    const page = await getGlobalTx([], { start: 5, limit: 10 }, 0);
    const p = params(fetchCallsFor('/transactions/search')[0]);
    expect(p.getAll('txType')).toEqual([]);
    expect(p.get('limit')).toBe('20');
    expect(p.get('blockLimit')).toBe('10');
    expect(p.get('confirmationStatus')).toBe('CONFIRMED');
    expect(page.done).toBe(false);
  });

  it('drops the pages of an older tip’s range once the newer one loads', async () => {
    mockFetchRoute('/transactions/search', []);
    const old = { start: 1001, limit: 1000 };
    await getGlobalTx(['PAYMENT'], old, 0, { endsAtTip: true });
    await getGlobalTx(['PAYMENT'], old, 20, { endsAtTip: true });
    // A fixed range ("from a block") is kept.
    await getGlobalTx(['PAYMENT'], { start: 1001, limit: 10_000 }, 0);
    await getGlobalTx(['PAYMENT'], { start: 1003, limit: 1000 }, 0, { endsAtTip: true });
    await Promise.resolve();
    expect(getQueryState(globalTxKey(['PAYMENT'], old, 0)).status).toBe('idle');
    expect(getQueryState(globalTxKey(['PAYMENT'], old, 20)).status).toBe('idle');
    expect(peekQuery(globalTxKey(['PAYMENT'], { start: 1003, limit: 1000 }, 0))).toBeDefined();
    expect(peekQuery(globalTxKey(['PAYMENT'], { start: 1001, limit: 10_000 }, 0))).toBeDefined();
  });
});

describe('getGlobalWaiting', () => {
  it('reads the mempool apart: 20 of the types, no block range', async () => {
    mockFetchRoute('/transactions/unconfirmed', [
      { type: 'PAYMENT', signature: 'w1', timestamp: 1 },
    ]);
    const rows = await getGlobalWaiting(['PAYMENT']);
    const p = params(fetchCallsFor('/transactions/unconfirmed')[0]);
    expect(p.getAll('txType')).toEqual(['PAYMENT']);
    expect(p.get('limit')).toBe('20');
    expect(p.get('startBlock')).toBeNull();
    expect(p.get('blockLimit')).toBeNull();
    expect(p.get('confirmationStatus')).toBeNull();
    expect(rows).toHaveLength(1);
    expect(globalWaitingKey(['PAYMENT'])).toBe('xglobal:waiting:PAYMENT');
    expect(globalWaitingKey([])).toBe('xglobal:waiting:all');
  });
});
