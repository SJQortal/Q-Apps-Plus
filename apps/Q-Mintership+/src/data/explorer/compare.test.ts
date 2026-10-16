import { beforeEach, describe, expect, it } from 'vitest';
import { fetchCallsFor, mockFetchRoute } from '../../test/setup';
import { peekQuery, queryLoadCounts, resetQueries, setQueryData } from '../query';
import {
  getPairPayments,
  getTradesAsSeller,
  pairKey,
  tradesKey,
  type PairPayments,
} from './compare';

const A = `Q${'a'.repeat(33)}`;
const B = `Q${'b'.repeat(33)}`;
const C = `Q${'c'.repeat(33)}`;
const PK = '9FvNoo1GnEGDmE9KEpueY2UgaC4BwLaZr4EJFf6pzJpA';
const AT = `A${'t'.repeat(33)}`;

const params = (path: string) => new URL(path, 'http://x').searchParams;

function payment(i: number, from: string, to: string) {
  return {
    type: 'PAYMENT',
    signature: `p${i}`.padEnd(88, 'x'),
    timestamp: 1_000_000 + i,
    blockHeight: 900_000 + i,
    creatorAddress: from,
    recipient: to,
    amount: '1.00000000',
  };
}

beforeEach(() => resetQueries());

describe('payments between two accounts', () => {
  it('reads each way once, from payments/between (newest 100, confirmed), keyed by pair', async () => {
    mockFetchRoute('/transactions/payments/between', (url: URL) => {
      const from = url.searchParams.get('senderAddress');
      const to = url.searchParams.get('recipientAddress');
      if (!from || !to) return [];
      return from === A ? [payment(2, A, B), payment(1, A, B)] : [payment(3, B, A)];
    });
    const ab = await getPairPayments(A, B);
    const ba = await getPairPayments(B, A);
    expect(ab.rows).toHaveLength(2);
    expect(ab.capped).toBe(false);
    expect(ba.rows).toHaveLength(1);
    const reads = fetchCallsFor('/transactions/payments/between')
      .map(params)
      .filter((p) => p.get('senderAddress') && p.get('recipientAddress'));
    expect(reads).toHaveLength(2);
    expect(reads.map((p) => [p.get('senderAddress'), p.get('recipientAddress')])).toEqual([
      [A, B],
      [B, A],
    ]);
    for (const read of reads) {
      expect(read.get('limit')).toBe('100');
      expect(read.get('reverse')).toBe('true');
      expect(read.get('confirmationStatus')).toBe('CONFIRMED');
    }
    expect(pairKey(A, B)).toBe(`xpair:${A}:${B}`);
    expect(peekQuery<PairPayments>(pairKey(B, A))).toBe(ba);
    // Cached: a second read of the same pair makes no call.
    await getPairPayments(A, B);
    expect(queryLoadCounts().xpair).toBe(2);
    expect(fetchCallsFor('/transactions/search')).toEqual([]);
  });

  it('says a full page may have more', async () => {
    mockFetchRoute('/transactions/payments/between', (url: URL) =>
      url.searchParams.get('senderAddress')
        ? Array.from({ length: 100 }, (_, i) => payment(i, A, B))
        : []
    );
    await expect(getPairPayments(A, B)).resolves.toMatchObject({ capped: true });
  });

  it('on a node without payments/between, keeps the sender’s own payments to that recipient', async () => {
    setQueryData('xcaps', { paymentsBetween: false });
    mockFetchRoute('/transactions/search', [payment(1, A, B), payment(2, A, C), payment(3, C, A)]);
    const ab = await getPairPayments(A, B);
    expect(ab.rows.map((row) => row.recipient)).toEqual([B]);
    expect(fetchCallsFor('/transactions/payments/between')).toEqual([]);
  });
});

describe('trades sold on the trade portal', () => {
  it('reads by the seller’s public key only (never the buyer’s), the newest 100', async () => {
    mockFetchRoute('/crosschain/trades', [
      {
        tradeTimestamp: 1_000,
        qortAmount: '12.00000000',
        btcAmount: '0.50000000',
        foreignAmount: '0.50000000',
        atAddress: AT,
        sellerAddress: A,
        buyerReceivingAddress: B,
      },
      {
        tradeTimestamp: 2_000,
        qortAmount: '3.00000000',
        foreignAmount: '0.10000000',
        atAddress: AT,
        sellerAddress: A,
        buyerReceivingAddress: C,
      },
      { junk: true },
    ]);
    const trades = await getTradesAsSeller(PK);
    expect(trades.capped).toBe(false);
    // Newest first, each with its buyer's receiving address.
    expect(trades.rows).toEqual([
      {
        timestamp: 2_000,
        qortAmount: '3.00000000',
        foreignAmount: '0.10000000',
        atAddress: AT,
        seller: A,
        buyer: C,
      },
      {
        timestamp: 1_000,
        qortAmount: '12.00000000',
        foreignAmount: '0.50000000',
        atAddress: AT,
        seller: A,
        buyer: B,
      },
    ]);
    const [read] = fetchCallsFor('/crosschain/trades').map(params);
    expect(read.get('sellerPublicKey')).toBe(PK);
    expect(read.get('limit')).toBe('100');
    expect(read.get('reverse')).toBe('true');
    expect(read.has('buyerPublicKey')).toBe(false);
    expect(tradesKey(PK)).toBe(`xtrades:${PK}`);
    expect(peekQuery(tradesKey(PK))).toBe(trades);
  });
});
