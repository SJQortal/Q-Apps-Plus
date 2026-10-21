/**
 * Exchanges' QORT deposit accounts (Simon, 2026-10-17: "add the
 * notification if users were sending QORT to exchanges"), and what an
 * account paid them or got from them. Pure; the payments come from
 * data/explorer/money.ts (getExchangePayments).
 */
import type { TxRow } from '../../data/types';
import { formatDate, plural } from '../../utils/format';
import { monthRange } from './connections';
import { formatAtomic, parseAtomic } from './money';

/** Deposit accounts of exchanges, by address. */
export const KNOWN_EXCHANGES: Readonly<Record<string, string>> = {
  QcZPChiGmwLu3Lrp2mfLSjZ3yHKmtrogRe: 'TradeOgre',
  QVbi8fvVDeF8jRxBWZvbGJPEtwnnNJFWQh: 'nonkyc.io',
};

/** "TradeOgre" for an exchange's account, else null. */
export function exchangeName(address: string | null | undefined): string | null {
  return (address && KNOWN_EXCHANGES[address]) || null;
}

/** What an account paid one exchange, or got from it. */
export interface ExchangeFlow {
  exchange: string;
  address: string;
  direction: 'sent' | 'received';
  /** The payments, newest first. */
  rows: TxRow[];
  qort: bigint;
  /** Only the newest were read: there may be older ones. */
  more: boolean;
}

/** One flow from its payment rows; null when there are none. */
export function exchangeFlow(
  address: string,
  direction: ExchangeFlow['direction'],
  rows: readonly TxRow[],
  more = false
): ExchangeFlow | null {
  const exchange = exchangeName(address);
  if (!exchange || !rows.length) return null;
  const sorted = [...rows].sort(
    (a, b) => (b.blockHeight ?? 0) - (a.blockHeight ?? 0) || b.timestamp - a.timestamp
  );
  const qort = sorted.reduce((sum, row) => sum + (parseAtomic(row.amount) ?? 0n), 0n);
  return { exchange, address, direction, rows: sorted, qort, more };
}

/**
 * "Sent 9,999.99 QORT to TradeOgre, an exchange, in 10 payments (Mar 2025 –
 * May 2026)."; "Received 12 QORT from nonkyc.io, an exchange, in 1 payment
 * (2 Jun 2026)."
 */
export function exchangeLine(flow: ExchangeFlow): string {
  const newest = flow.rows[0].timestamp;
  const oldest = flow.rows[flow.rows.length - 1].timestamp;
  const when = flow.rows.length === 1 ? formatDate(newest) : monthRange(oldest, newest);
  const count = flow.more
    ? `its newest ${plural(flow.rows.length, 'payment')} (there are older ones)`
    : plural(flow.rows.length, 'payment');
  return flow.direction === 'sent'
    ? `Sent ${formatAtomic(flow.qort)} QORT to ${flow.exchange}, an exchange, in ${count} (${when}).`
    : `Received ${formatAtomic(flow.qort)} QORT from ${flow.exchange}, an exchange, in ${count} (${when}).`;
}
