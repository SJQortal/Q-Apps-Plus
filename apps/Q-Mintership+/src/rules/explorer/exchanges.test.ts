import { describe, expect, it } from 'vitest';
import type { TxRow } from '../../data/types';
import { exchangeFlow, exchangeLine, exchangeName } from './exchanges';

const TRADEOGRE = 'QcZPChiGmwLu3Lrp2mfLSjZ3yHKmtrogRe';
const row = (amount: string, height: number, timestamp: number) =>
  ({ signature: `s${height}`, type: 'PAYMENT', amount, blockHeight: height, timestamp }) as unknown as TxRow;

describe('exchanges', () => {
  it('knows the exchanges Simon listed, by their deposit accounts', () => {
    expect(exchangeName(TRADEOGRE)).toBe('TradeOgre');
    expect(exchangeName('QVbi8fvVDeF8jRxBWZvbGJPEtwnnNJFWQh')).toBe('nonkyc.io');
    expect(exchangeName('QaBcDeFgHiJkLmNoPqRsTuVwXyZ123456')).toBeNull();
  });

  it('adds up what an account paid one, and says it in a line', () => {
    const march = Date.UTC(2025, 2, 3);
    const may = Date.UTC(2026, 4, 5);
    const flow = exchangeFlow(TRADEOGRE, 'sent', [
      row('4999.99', 10, march),
      row('5000.00', 20, may),
    ]);
    expect(flow?.qort).toBe(999_999_000_000n);
    expect(flow?.rows[0].blockHeight).toBe(20);
    expect(exchangeLine(flow!)).toBe(
      'Sent 9,999.99 QORT to TradeOgre, an exchange, in 2 payments (Mar 2025 – May 2026).'
    );
    const one = exchangeFlow(TRADEOGRE, 'received', [row('12', 5, may)], true);
    expect(exchangeLine(one!)).toMatch(
      /^Received 12 QORT from TradeOgre, an exchange, in its newest 1 payment \(there are older ones\) \(\d+ May 2026\)\.$/
    );
    expect(exchangeFlow(TRADEOGRE, 'sent', [])).toBeNull();
  });
});
