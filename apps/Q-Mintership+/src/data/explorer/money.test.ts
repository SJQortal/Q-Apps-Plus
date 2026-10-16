import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCallsFor, mockFetchRoute } from '../../test/setup';
import { ADDR, installWorld } from '../../test/world';
import { FUNDER } from '../../../e2e/world.mjs';
import { getQueryState, peekQuery, resetQueries } from '../query';
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

beforeEach(() => resetQueries());
afterEach(() => vi.useRealTimers());

describe('payments between accounts', () => {
  it('reads the newest 100 each way from payments/between, a light read', async () => {
    mockFetchRoute('/transactions/payments/between', (url: URL) =>
      url.searchParams.get('limit') === '1'
        ? []
        : payments(Number(url.searchParams.get('offset')), 100)
    );
    const sent = await getPayments(A, 'sent');
    expect(sent).toMatchObject({ nextOffset: 100, done: false });
    expect(sent.rows).toHaveLength(100);
    await getPayments(A, 'recv');
    const reads = fetchCallsFor('/transactions/payments/between').map(params);
    // The capability check once, then one read each way.
    expect(reads).toHaveLength(3);
    expect(reads[1].get('senderAddress')).toBe(A);
    expect(reads[2].get('recipientAddress')).toBe(A);
    for (const read of reads.slice(1)) {
      expect(read.get('limit')).toBe('100');
      expect(read.get('reverse')).toBe('true');
      expect(read.get('confirmationStatus')).toBe('CONFIRMED');
    }
    expect(peekQuery(payKey(A, 'sent'))).toBe(sent);
    expect(peekQuery('xcaps')).toEqual({ paymentsBetween: true });
    expect(fetchCallsFor('/transactions/search')).toEqual([]);
  });

  it('“Check older” appends the next 100, once each', async () => {
    mockFetchRoute('/transactions/payments/between', (url: URL) => {
      const offset = Number(url.searchParams.get('offset') ?? 0);
      if (url.searchParams.get('limit') === '1') return [];
      // The second page overlaps the first by one (a new payment arrived meanwhile).
      return offset === 0 ? payments(0, 100) : payments(99, 30);
    });
    await getPayments(A, 'sent');
    const older = await loadOlderPayments(A, 'sent');
    expect(older?.rows).toHaveLength(129);
    expect(older).toMatchObject({ nextOffset: 130, done: true });
    expect(new Set(older?.rows.map((r) => r.signature)).size).toBe(129);
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
  it('reads the newest 100 TRANSFER_ASSET and MULTI_PAYMENT rows through the heavy limiter', async () => {
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
    expect(search.get('limit')).toBe('100');
    expect(search.get('reverse')).toBe('true');
    expect(peekQuery(`xassets:${A}`)).toBe(result);
  });
});

describe('in the mock world', () => {
  it('Kit and Lou’s payments both ways; Hal’s 640 payments read 100 at a time', async () => {
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
    expect(hal).toMatchObject({ nextOffset: 100, done: false });
    const assets = await getAssetTransfers(ADDR.admin);
    expect(assets.rows.map((r) => r.type).sort()).toEqual(['MULTI_PAYMENT', 'TRANSFER_ASSET']);
  });
});
