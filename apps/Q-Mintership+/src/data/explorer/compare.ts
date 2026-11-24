/**
 * Compare's own reads (the rest are the account reads it shares with the
 * account page: xacct, xfirst, xgroups, xpay, xlinks, xassets, xmade…):
 *
 * - QORT payments between two accounts, one way:
 *   `/transactions/payments/between?senderAddress=X&recipientAddress=Y`,
 *   the newest 100 (a few ms, not a heavy search), `xpair:<X>:<Y>`. Read
 *   both ways for every pair. A node without `payments/between` (xcaps)
 *   gets them from the sender's own payment page instead.
 * - Trades an account sold on the trade portal:
 *   `/crosschain/trades?sellerPublicKey=<pk>`, all of them in one read
 *   (Core filters the AT's creator: about 6 ms; its limit and offset skip
 *   rows, so none is given: Hub's Explorer port, 2026-11-22, found a pair's
 *   older sale missed past the newest 100), `xtrades:<pk>`. Never by the
 *   buyer's key: Core answers that one in seconds. A trade between two
 *   compared accounts is one whose buyer receives at the other's address.
 *
 * All GET, cached, none polled.
 */
import type { TxRow } from '../types';
import { getJson, query } from '../core';
import { fetchQuery } from '../query';
import { getPaymentCaps, getPayments } from './money';

export const PAIR_LIMIT = 100;
export const TRADES_LIMIT = 100;

export const pairKey = (sender: string, recipient: string) => `xpair:${sender}:${recipient}`;
export const tradesKey = (publicKey: string) => `xtrades:${publicKey}`;

export interface PairPayments {
  /** QORT payments from the sender to the recipient, newest first. */
  rows: TxRow[];
  /** Core had a full page: there may be older ones. */
  capped: boolean;
}

/** The newest 100 QORT payments `sender` made to `recipient`. */
export function getPairPayments(
  sender: string,
  recipient: string,
  options: { force?: boolean; scope?: string } = {}
): Promise<PairPayments> {
  return fetchQuery(
    pairKey(sender, recipient),
    async () => {
      const caps = await getPaymentCaps(sender);
      if (!caps.paymentsBetween) {
        // An older node: the sender's own newest payments, kept to this recipient.
        const page = await getPayments(sender, 'sent', { scope: options.scope ?? sender });
        return {
          rows: page.rows.filter((row) => row.recipient === recipient),
          capped: !page.done,
        };
      }
      const rows = await getJson<TxRow[]>(
        `/transactions/payments/between?${query({
          senderAddress: sender,
          recipientAddress: recipient,
          confirmationStatus: 'CONFIRMED',
          // One more than it keeps: "older ones not read" only when there is one.
          limit: PAIR_LIMIT + 1,
          reverse: true,
        })}`
      );
      const list = Array.isArray(rows) ? rows : [];
      return { rows: list.slice(0, PAIR_LIMIT), capped: list.length > PAIR_LIMIT };
    },
    { ttlMs: 10 * 60_000, force: options.force }
  );
}

/** One completed trade on the trade portal (Core's trade summary). */
export interface Trade {
  /** When it completed (ms); null when Core gives no time (a pruned node). */
  timestamp: number | null;
  /** QORT sold, as Core writes it ("12.00000000"). */
  qortAmount: string;
  /** What the buyer paid, in the other coin (Core doesn't name the coin here). */
  foreignAmount: string;
  /** The trade's AT (automated contract). */
  atAddress: string;
  seller: string;
  /** Where the buyer received the QORT. */
  buyer: string;
}

export interface TradesOf {
  /** Newest first. */
  rows: Trade[];
  /** Always false now: every sale is read. */
  capped: boolean;
}

/** Every trade sold by the account with `publicKey` (Core filters by the AT's creator), newest first. */
export function getTradesAsSeller(
  publicKey: string,
  options: { force?: boolean } = {}
): Promise<TradesOf> {
  return fetchQuery(
    tradesKey(publicKey),
    async () => {
      const body = await getJson<unknown>(
        `/crosschain/trades?${query({ sellerPublicKey: publicKey, reverse: true })}`
      );
      const raw = Array.isArray(body) ? body : [];
      const rows = raw
        .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
        .filter(
          (row) =>
            typeof row.sellerAddress === 'string' && typeof row.buyerReceivingAddress === 'string'
        )
        .map((row) => ({
          // No time from Core: none, never 1 January 1970.
          timestamp: Number(row.tradeTimestamp) > 0 ? Number(row.tradeTimestamp) : null,
          qortAmount: String(row.qortAmount ?? '0'),
          foreignAmount: String(row.foreignAmount ?? row.btcAmount ?? '0'),
          atAddress: String(row.atAddress ?? ''),
          seller: row.sellerAddress as string,
          buyer: row.buyerReceivingAddress as string,
        }))
        // Dated ones newest first, then the ones with no time.
        .sort((a, b) => (b.timestamp ?? -1) - (a.timestamp ?? -1));
      return { rows, capped: false };
    },
    { ttlMs: 10 * 60_000, force: options.force }
  );
}
