/**
 * Q-Asset trades read from an account's orders (trades.ts; Simon,
 * 2026-10-21), in the mock world: Pia Promote's sell order of 6 GEMCOIN
 * waited, and Ben Target's buy order for 120 QORT came in and matched it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCallsFor } from '../../test/setup';
import { ADDR, installWorld } from '../../test/world';
import { getAccountTrades, getOrderFills, tradesKey } from './trades';
import { peekQuery } from '../query';

afterEach(() => vi.useRealTimers());

const params = (path: string) => new URL(path, 'http://x').searchParams;

describe('an account’s asset trades', () => {
  it('reads its orders with Core’s filters, then the trades of the filled ones only', async () => {
    installWorld('learner', { strict: true });
    const ben = await getAccountTrades(ADDR.banTarget);
    // Core's flags are exact filters: one read per state an order can be in.
    const reads = fetchCallsFor(`/assets/orders/${ADDR.banTarget}`).map(params);
    expect(reads.map((r) => [r.get('includeClosed'), r.get('includeFulfilled')])).toEqual([
      ['true', 'true'],
      ['true', 'false'],
      ['false', 'false'],
    ]);
    for (const read of reads) {
      expect(read.get('reverse')).toBe('true');
      expect(Number(read.get('limit'))).toBe(100);
    }
    // Its open order, never filled, has no trades to read.
    expect(fetchCallsFor(/\/trades\?/)).toHaveLength(1);
    expect(ben.orders).toBe(1);
    expect(ben.truncated).toBe(false);
    expect(ben.trades).toHaveLength(1);
    expect(ben.trades[0]).toMatchObject({
      self: ADDR.banTarget,
      other: ADDR.promote,
      initiated: true,
      height: 2_150_400,
      gave: { assetId: 0, asset: 'QORT', amount: '120.00000000' },
      got: { assetId: 77, asset: 'GEMCOIN', amount: '6.00000000' },
    });
    // Both orders as evidence: its own and Pia's.
    expect(ben.trades[0].txs.map((tx) => tx.creatorAddress).sort()).toEqual(
      [ADDR.banTarget, ADDR.promote].sort()
    );
    expect(peekQuery(tradesKey(ADDR.banTarget))).toBe(ben);
  });

  it('tells the same trade from the other side', async () => {
    installWorld('learner', { strict: true });
    const pia = await getAccountTrades(ADDR.promote);
    expect(pia.trades).toEqual([
      expect.objectContaining({
        self: ADDR.promote,
        other: ADDR.banTarget,
        initiated: false,
        height: 2_150_400,
        gave: { assetId: 77, asset: 'GEMCOIN', amount: '6.00000000' },
        got: { assetId: 0, asset: 'QORT', amount: '120.00000000' },
      }),
    ]);
  });

  it('an account with no orders: three small reads, no trades', async () => {
    installWorld('learner', { strict: true });
    const lou = await getAccountTrades(ADDR.left);
    expect(lou).toEqual({ trades: [], orders: 0, truncated: false });
    // The three order reads, nothing else.
    expect(fetchCallsFor('/assets/')).toHaveLength(3);
  });

  it('one order’s fills are kept for the session', async () => {
    installWorld('learner', { strict: true });
    const ben = await getAccountTrades(ADDR.banTarget);
    const reads = fetchCallsFor('/assets/').length;
    const fills = await getOrderFills(ben.trades[0].orderId, ADDR.banTarget);
    expect(fills).toEqual(ben.trades);
    expect(fetchCallsFor('/assets/')).toHaveLength(reads);
  });
});
