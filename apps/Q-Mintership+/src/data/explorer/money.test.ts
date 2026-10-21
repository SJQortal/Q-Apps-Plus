import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCallsFor, mockFetchRoute } from '../../test/setup';
import { ADDR, installWorld } from '../../test/world';
import { FUNDER } from '../../../e2e/world.mjs';
import { getQueryState, peekQuery, resetQueries, setQueryData } from '../query';
import { noteAllList, resetFullHistory } from './fullHistory';
import { dropHeavy, heavy, HeavyCancelled } from './heavy';
import { getAssetTransfers, getPaymentCaps, getPayments, loadOlderPayments, payKey } from './money';

const A = `Q${'a'.repeat(33)}`;
const B = `Q${'b'.repeat(33)}`;

function payments(offset: number, count: number, from = A, to = B) {
  return Array.from({ length: count }, (_, i) => ({
    type: 'PAYMENT',
    signature: `p${offset + i}`.padEnd(88, 'x'),
    timestamp: 1_000_000 - (offset + i),
    blockHeight: 900_000 - (offset + i),
    creatorAddress: from,
    recipient: to,
    amount: '1.00000000',
  }));
}

const params = (path: string) => new URL(path, 'http://x').searchParams;

beforeEach(() => {
  resetQueries();
  resetFullHistory();
});
afterEach(() => vi.useRealTimers());

describe('payments between accounts', () => {
  it('reads every payment each way from payments/between, 1,000 a read (Simon, 2026-10-21)', async () => {
    // 2,350 sent: three reads (1,000, 1,000, 350); 40 received: one.
    mockFetchRoute('/transactions/payments/between', (url: URL) => {
      if (url.searchParams.get('limit') === '1') return [];
      const offset = Number(url.searchParams.get('offset'));
      const total = url.searchParams.get('senderAddress') ? 2350 : 40;
      return payments(offset, Math.max(0, Math.min(1000, total - offset)));
    });
    const sent = await getPayments(A, 'sent');
    expect(sent).toMatchObject({ nextOffset: 2350, done: true });
    expect(sent.rows).toHaveLength(2350);
    const recv = await getPayments(A, 'recv');
    expect(recv).toMatchObject({ nextOffset: 40, done: true });
    const reads = fetchCallsFor('/transactions/payments/between').map(params);
    // The capability check once, then three reads sent and one received.
    expect(reads).toHaveLength(5);
    expect(reads.slice(1, 4).map((r) => [r.get('senderAddress'), r.get('offset')])).toEqual([
      [A, '0'],
      [A, '1000'],
      [A, '2000'],
    ]);
    expect(reads[4].get('recipientAddress')).toBe(A);
    for (const read of reads.slice(1)) {
      expect(read.get('limit')).toBe('1000');
      expect(read.get('reverse')).toBe('true');
      expect(read.get('confirmationStatus')).toBe('CONFIRMED');
    }
    expect(peekQuery(payKey(A, 'sent'))).toBe(sent);
    expect(peekQuery('xcaps')).toEqual({ paymentsBetween: true });
    expect(fetchCallsFor('/transactions/search')).toEqual([]);
  });

  it('stops at 10,000 each way, and “Check older” appends the next 1,000, once each', async () => {
    mockFetchRoute('/transactions/payments/between', (url: URL) => {
      const offset = Number(url.searchParams.get('offset') ?? 0);
      if (url.searchParams.get('limit') === '1') return [];
      // Past 10,000: one more short page, overlapping by one (a new payment arrived meanwhile).
      return offset < 10_000 ? payments(offset, 1000) : payments(9_999, 30);
    });
    const first = await getPayments(A, 'sent');
    expect(first).toMatchObject({ nextOffset: 10_000, done: false });
    expect(first.rows).toHaveLength(10_000);
    const older = await loadOlderPayments(A, 'sent');
    expect(older?.rows).toHaveLength(10_029);
    expect(older).toMatchObject({ nextOffset: 10_030, done: true });
    expect(new Set(older?.rows.map((r) => r.signature)).size).toBe(10_029);
    expect(peekQuery(payKey(A, 'sent'))).toBe(older);
    // Nothing older: no more reads.
    const before = fetchCallsFor('/transactions/payments/between').length;
    await loadOlderPayments(A, 'sent');
    expect(fetchCallsFor('/transactions/payments/between')).toHaveLength(before);
  });

  it('falls back to a heavy PAYMENT search when the node has no payments/between', async () => {
    mockFetchRoute(
      '/transactions/payments/between',
      () => new Response('{"error":404}', { status: 404 })
    );
    mockFetchRoute('/transactions/search', () => [
      ...payments(0, 3, A, B),
      ...payments(10, 2, B, A),
    ]);
    const sent = await getPayments(A, 'sent');
    const recv = await getPayments(A, 'recv');
    expect(sent.rows).toHaveLength(3);
    expect(recv.rows).toHaveLength(2);
    expect(sent.done).toBe(true);
    // Both directions share one search.
    const searches = fetchCallsFor('/transactions/search').map(params);
    expect(searches).toHaveLength(1);
    expect(searches[0].get('address')).toBe(A);
    expect(searches[0].getAll('txType')).toEqual(['PAYMENT']);
    expect(peekQuery('xcaps')).toEqual({ paymentsBetween: false });
  });

  it('never caches a failure as “no payments/between”', async () => {
    mockFetchRoute('/transactions/payments/between', () => new Response('boom', { status: 500 }));
    await expect(getPaymentCaps(A)).rejects.toThrow();
    expect(getQueryState('xcaps').status).toBe('error');
  });
});

describe('asset transfers', () => {
  it('reads TRANSFER_ASSET and MULTI_PAYMENT rows, 1,000 a read, through the heavy limiter', async () => {
    let open!: () => void;
    const gate = { promise: new Promise<void>((r) => (open = r)), resolve: () => open() };
    const busy = [heavy('x', () => gate.promise), heavy('x', () => gate.promise)];
    mockFetchRoute('/transactions/search', []);
    const queued = getAssetTransfers(A, { scope: 'page' });
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchCallsFor('/transactions/search')).toEqual([]);
    dropHeavy('page');
    await expect(queued).rejects.toBeInstanceOf(HeavyCancelled);
    gate.resolve();
    await Promise.all(busy);

    const result = await getAssetTransfers(A);
    expect(result).toEqual({ rows: [], truncated: false });
    const [search] = fetchCallsFor('/transactions/search').map(params);
    expect(search.getAll('txType')).toEqual(['TRANSFER_ASSET', 'MULTI_PAYMENT']);
    expect(search.get('limit')).toBe('1000');
    expect(search.get('reverse')).toBe('true');
    expect(peekQuery(`xassets:${A}`)).toBe(result);
  });

  it('stops at 5,000 and says so', async () => {
    mockFetchRoute('/transactions/search', (url: URL) =>
      payments(Number(url.searchParams.get('offset')), 1000).map((row) => ({
        ...row,
        type: 'TRANSFER_ASSET',
      }))
    );
    const result = await getAssetTransfers(A);
    expect(result.rows).toHaveLength(5000);
    expect(result.truncated).toBe(true);
    expect(fetchCallsFor('/transactions/search')).toHaveLength(5);
  });
});

describe('from the whole history (Simon, 2026-10-21)', () => {
  /** The All list of accountTx.ts, read to its end. */
  function readAll(rows: Record<string, unknown>[]) {
    setQueryData(`xtx:${A}:all`, { rows, nextOffset: rows.length, done: true, checkedAt: 1 });
  }

  it('payments each way and asset transfers come from it, complete, with no read', async () => {
    readAll([
      ...payments(0, 3, A, B),
      ...payments(10, 2, B, A),
      { type: 'TRANSFER_ASSET', signature: 't1', timestamp: 5, blockHeight: 5, creatorAddress: A },
      { type: 'REWARD_SHARE', signature: 'r1', timestamp: 4, blockHeight: 4, creatorAddress: A },
    ]);
    const sent = await getPayments(A, 'sent');
    const recv = await getPayments(A, 'recv');
    const assets = await getAssetTransfers(A);
    expect(sent).toMatchObject({ done: true, nextOffset: 3 });
    expect(sent.rows.map((r) => r.recipient)).toEqual([B, B, B]);
    expect(recv.rows.map((r) => r.creatorAddress)).toEqual([B, B]);
    expect(assets).toEqual({
      rows: [expect.objectContaining({ signature: 't1' })],
      truncated: false,
    });
    expect(fetchCallsFor('/transactions/')).toEqual([]);
  });

  it('a payments list read before is read again from it once the whole history is read', async () => {
    mockFetchRoute('/transactions/payments/between', (url: URL) =>
      url.searchParams.get('limit') === '1' ? [] : payments(0, 1)
    );
    expect((await getPayments(A, 'sent')).rows).toHaveLength(1);
    const rows = payments(0, 7, A, B);
    readAll(rows);
    noteAllList(A, { rows: rows as never, done: true });
    expect(getQueryState(payKey(A, 'sent')).status).toBe('success');
    expect((await getPayments(A, 'sent')).rows).toHaveLength(7);
  });
});

describe('in the mock world', () => {
  it('Kit and Lou’s payments both ways; all of Hal’s 640 payments in one read', async () => {
    installWorld('admin', { strict: true });
    const kitSent = await getPayments(ADDR.kicked, 'sent');
    expect(kitSent.rows.map((r) => r.recipient)).toEqual(Array(4).fill(ADDR.left));
    expect(kitSent.done).toBe(true);
    const kitGot = await getPayments(ADDR.kicked, 'recv');
    // Two from Lou and the first QORT from Hal, newest first.
    expect(kitGot.rows.map((r) => r.creatorAddress)).toEqual([
      ADDR.left,
      ADDR.left,
      FUNDER.address,
    ]);
    const hal = await getPayments(FUNDER.address, 'sent');
    expect(hal).toMatchObject({ nextOffset: 640, done: true });
    const assets = await getAssetTransfers(ADDR.admin);
    expect(assets.rows.map((r) => r.type).sort()).toEqual(['MULTI_PAYMENT', 'TRANSFER_ASSET']);
  });
});
