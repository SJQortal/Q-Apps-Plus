import { describe, expect, it } from 'vitest';
import type { TxRow } from '../../data/types';
import fixture from './__fixtures__/qortBook.json';
import { parseAtomic } from './money';
import { orderQort, qortBook, qortMinted, type OrderState, type OrderTrade } from './qortBook';

const Q = (n: string) => parseAtomic(n) ?? 0n;
const ME = 'QaAccountAAAAAAAAAAAAAAAAAAAAAAAAA';
const YOU = 'QbAccountBBBBBBBBBBBBBBBBBBBBBBBBB';
const row = (fields: Record<string, unknown>) =>
  ({ signature: `s${Math.random()}`, timestamp: 1, blockHeight: 1, ...fields }) as unknown as TxRow;

describe('qortBook on real accounts that never minted', () => {
  // Real rows from Simon's node: payments, trades, name sales, asset orders, fees.
  for (const account of fixture.accounts)
    it(`comes to exactly 0 minted for ${account.address.slice(0, 8)}…`, () => {
      expect(account.blocksMinted).toBe(0);
      const book = qortBook(account.rows as unknown as TxRow[], account.address);
      const orders = book.orders.reduce((sum, id) => {
        const got = (account.orders as Record<string, { order: OrderState; trades: OrderTrade[] }>)[
          id
        ];
        return sum + orderQort(id, got.order, got.trades);
      }, 0n);
      expect(book.orders.length).toBe(Object.keys(account.orders).length);
      expect(qortMinted(Q(account.balance), book, orders)).toBe(0n);
    });
});

describe('qortBook', () => {
  it('sorts what moved: received, sent, purchased, returned, names, fees', () => {
    const book = qortBook(
      [
        row({ type: 'PAYMENT', creatorAddress: YOU, recipient: ME, amount: '10', fee: '0.01' }),
        row({ type: 'PAYMENT', creatorAddress: ME, recipient: YOU, amount: '3', fee: '0.01' }),
        row({
          type: 'TRANSFER_ASSET',
          creatorAddress: YOU,
          recipient: ME,
          amount: '5',
          assetId: 7,
          fee: '0.01',
        }),
        row({
          type: 'MULTI_PAYMENT',
          creatorAddress: YOU,
          payments: [{ recipient: ME, assetId: 0, amount: '2' }],
          fee: '0.01',
        }),
        row({
          type: 'DEPLOY_AT',
          creatorAddress: ME,
          aTAddress: 'AOwn',
          amount: '100',
          assetId: 0,
          fee: '0.002',
        }),
        row({
          type: 'AT',
          creatorAddress: 'QdSnUy6sUiEnaN87dWmE92g1uQjrvPgrWG',
          atAddress: 'AOwn',
          recipient: ME,
          amount: '40',
          assetId: 0,
          fee: '0',
        }),
        row({
          type: 'AT',
          creatorAddress: 'QdSnUy6sUiEnaN87dWmE92g1uQjrvPgrWG',
          atAddress: 'AOther',
          recipient: ME,
          amount: '25',
          assetId: 0,
          fee: '0',
        }),
        row({ type: 'BUY_NAME', creatorAddress: ME, seller: YOU, amount: '4', fee: '0.01' }),
        row({ type: 'ARBITRARY', creatorAddress: ME, fee: '0.01' }),
      ],
      ME
    );
    expect(book.received).toBe(Q('12'));
    expect(book.sent).toBe(Q('3'));
    expect(book.purchased).toBe(Q('25'));
    expect(book.returned).toBe(Q('40'));
    expect(book.deployed).toBe(Q('100'));
    expect(book.names).toBe(-Q('4'));
    expect(book.fees).toBe(Q('0.032'));
    expect(book.ownAts).toEqual(['AOwn']);
    // 50 QORT now: 50 − (12 − 3 + 25 + 40 − 100 + −4 − 0.032) = 80.032 minted.
    expect(qortMinted(Q('50'), book, 0n)).toBe(Q('80.032'));
  });

  it('settles an order selling QORT from its state and trades', () => {
    // 2 of an asset at 10 QORT each, amount in the asset wanted: 20 QORT taken; cancelled after 1.
    const order: OrderState = {
      haveAssetId: 0,
      wantAssetId: 10,
      amount: '2',
      price: '10',
      fulfilled: '1',
      isClosed: true,
      isFulfilled: false,
      amountAssetId: 10,
    };
    const trades: OrderTrade[] = [
      {
        initiatingOrderId: 'o1',
        targetOrderId: 't',
        targetAmount: '1',
        initiatorAmount: '10',
        initiatorSaving: '0',
      },
    ];
    expect(orderQort('o1', order, trades)).toBe(-Q('10'));
    // Buying QORT: what each trade paid it.
    expect(
      orderQort('o2', { ...order, haveAssetId: 10, wantAssetId: 0, amountAssetId: 0 }, [
        { initiatingOrderId: 'x', targetOrderId: 'o2', targetAmount: '1', initiatorAmount: '400' },
      ])
    ).toBe(Q('400'));
  });
});
