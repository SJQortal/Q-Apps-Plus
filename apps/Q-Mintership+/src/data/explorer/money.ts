/**
 * QORT and assets that moved between an account and others.
 *
 * - QORT payments (PAYMENT) come from `/transactions/payments/between`,
 *   the fastest counterparty read Core has (a few ms, not a heavy search):
 *   `xpay:<a>:sent` and `xpay:<a>:recv`, newest first, each
 *   `{rows, nextOffset, done}`: every payment, 1,000 a read, up to 10,000
 *   each way (Simon, 2026-10-21: a payment from May 2025 was missing when
 *   only the newest 100 were read; 266 payments read in about 40 ms).
 *   "Check older" appends the next 1,000 past that.
 * - Asset transfers and multi-payments (TRANSFER_ASSET, MULTI_PAYMENT) need
 *   an address search, so they are heavy: `xassets:<a>`, 1,000 a read, up
 *   to 5,000.
 * - When the account's whole history is read (the All list of
 *   accountTx.ts, read to its end: Overview's "Read all of it", or an
 *   account with fewer than 100 transactions), both come from it instead,
 *   complete (data/explorer/fullHistory.ts).
 *
 * A node without `payments/between` (it answers 404 or 400) is told once
 * per session (`xcaps`); then payments come from a PAYMENT address search
 * through the heavy-read limiter instead, both directions sharing each page.
 */
import { CoreHttpError } from '../../qortal/client';
import type { TxRow } from '../types';
import { getJson, query } from '../core';
import { fetchQuery, peekQuery, setQueryData } from '../query';
import { heavy, heavyQuery } from './heavy';
import { KNOWN_EXCHANGES, exchangeFlow, type ExchangeFlow } from '../../rules/explorer/exchanges';
import { assetTransfersFrom, fullHistory, paymentsFrom } from './fullHistory';

export type PayDirection = 'sent' | 'recv';

export interface PaymentPage {
  /** Newest first, one row per transaction. */
  rows: TxRow[];
  /** Where the next read starts. */
  nextOffset: number;
  /** Core has no older ones. */
  done: boolean;
}

export interface AssetTransfers {
  /** TRANSFER_ASSET and MULTI_PAYMENT, newest first. */
  rows: TxRow[];
  /** The 100 newest only: there may be older ones. */
  truncated: boolean;
}

export interface PaymentCaps {
  /** The node answers `/transactions/payments/between`. */
  paymentsBetween: boolean;
}

/** Payments per read, and reads each way at first. */
export const PAY_PAGE = 1000;
export const PAY_FIRST_PAGES = 10;
/** Asset transfers per read, and reads at most. */
export const ASSETS_PAGE = 1000;
export const ASSETS_PAGES = 5;
export const payKey = (address: string, direction: PayDirection) => `xpay:${address}:${direction}`;
export const assetsKey = (address: string) => `xassets:${address}`;

/** Whether this node has `payments/between` (once per session). */
export function getPaymentCaps(address: string): Promise<PaymentCaps> {
  return fetchQuery(
    'xcaps',
    async () => {
      try {
        await getJson<unknown>(
          `/transactions/payments/between?${query({
            recipientAddress: address,
            confirmationStatus: 'CONFIRMED',
            limit: 1,
          })}`
        );
        return { paymentsBetween: true };
      } catch (error) {
        if (error instanceof CoreHttpError && (error.status === 404 || error.status === 400))
          return { paymentsBetween: false };
        throw error;
      }
    },
    { ttlMs: Number.POSITIVE_INFINITY }
  );
}

/** Payments read per exchange and way at most (pages of PAY_PAGE). */
const EXCHANGE_PAGES = 10;

/**
 * What an account paid each known exchange, and got from it
 * (`xexch:<a>`): `/transactions/payments/between` with the sender and the
 * recipient both given, a few ms each, so it is exact however busy the
 * account is (up to 10,000 payments a way, then `more`). Null on a node
 * without that endpoint: the Connections lists' payments say it then.
 */
export function getExchangePayments(address: string): Promise<ExchangeFlow[] | null> {
  return fetchQuery(
    `xexch:${address}`,
    async () => {
      const caps = await getPaymentCaps(address);
      if (!caps.paymentsBetween) return null;
      const read = async (from: string, to: string) => {
        const rows: TxRow[] = [];
        for (let page = 0; page < EXCHANGE_PAGES; page++) {
          const chunk = await getJson<TxRow[]>(
            `/transactions/payments/between?${query({
              senderAddress: from,
              recipientAddress: to,
              confirmationStatus: 'CONFIRMED',
              limit: PAY_PAGE,
              offset: page * PAY_PAGE,
              reverse: true,
            })}`
          );
          const list = Array.isArray(chunk) ? chunk : [];
          rows.push(...list);
          if (list.length < PAY_PAGE) return { rows, more: false };
        }
        return { rows, more: true };
      };
      const flows = await Promise.all(
        Object.keys(KNOWN_EXCHANGES)
          .filter((exchange) => exchange !== address)
          .flatMap((exchange) => [
            read(address, exchange).then((got) =>
              exchangeFlow(exchange, 'sent', got.rows, got.more)
            ),
            read(exchange, address).then((got) =>
              exchangeFlow(exchange, 'received', got.rows, got.more)
            ),
          ])
      );
      return flows.filter((flow): flow is ExchangeFlow => flow !== null);
    },
    { ttlMs: 10 * 60_000 }
  );
}

function between(address: string, direction: PayDirection, offset: number): string {
  return `/transactions/payments/between?${query({
    [direction === 'sent' ? 'senderAddress' : 'recipientAddress']: address,
    confirmationStatus: 'CONFIRMED',
    limit: PAY_PAGE,
    offset,
    reverse: true,
  })}`;
}

/** The fallback: one page of the account's PAYMENT rows, both directions (shared by both keys). */
function paymentSearch(address: string, offset: number): Promise<TxRow[]> {
  return fetchQuery(
    `xpay:${address}:search:${offset}`,
    async () => {
      const rows = await getJson<TxRow[]>(
        `/transactions/search?${query({
          address,
          txType: 'PAYMENT',
          confirmationStatus: 'CONFIRMED',
          limit: PAY_PAGE,
          offset,
          reverse: true,
        })}`
      );
      return Array.isArray(rows) ? rows : [];
    },
    { ttlMs: 10 * 60_000 }
  );
}

async function readPage(
  address: string,
  direction: PayDirection,
  offset: number,
  caps: PaymentCaps
): Promise<PaymentPage> {
  if (caps.paymentsBetween) {
    const rows = await getJson<TxRow[]>(between(address, direction, offset));
    const list = Array.isArray(rows) ? rows : [];
    return { rows: list, nextOffset: offset + list.length, done: list.length < PAY_PAGE };
  }
  const raw = await paymentSearch(address, offset);
  const rows = raw.filter((row) =>
    direction === 'sent'
      ? row.creatorAddress === address
      : row.recipient === address && row.creatorAddress !== address
  );
  return { rows, nextOffset: offset + raw.length, done: raw.length < PAY_PAGE };
}

/** Pages from offset 0 until Core has no more, or `PAY_FIRST_PAGES` were read. */
async function readFirstPages(
  address: string,
  direction: PayDirection,
  caps: PaymentCaps
): Promise<PaymentPage> {
  const rows: TxRow[] = [];
  const seen = new Set<string>();
  let page: PaymentPage = { rows: [], nextOffset: 0, done: false };
  for (let i = 0; i < PAY_FIRST_PAGES && !page.done; i++) {
    page = await readPage(address, direction, page.nextOffset, caps);
    for (const row of page.rows)
      if (!seen.has(row.signature)) {
        seen.add(row.signature);
        rows.push(row);
      }
  }
  return { rows, nextOffset: page.nextOffset, done: page.done };
}

/**
 * Every QORT payment an account sent (`sent`) or received (`recv`), up to
 * 10,000 each way; from its whole history when that is read. `scope` is
 * the page's account, for the heavy fallback.
 */
export async function getPayments(
  address: string,
  direction: PayDirection,
  options: { force?: boolean; scope?: string } = {}
): Promise<PaymentPage> {
  const full = fullHistory(address);
  if (full)
    return fetchQuery(
      payKey(address, direction),
      async () => paymentsFrom(full, address, direction),
      {
        ttlMs: 10 * 60_000,
        force: options.force,
      }
    );
  const caps = await getPaymentCaps(address);
  const load = async () => {
    // The whole history may have finished reading while this waited.
    const now = fullHistory(address);
    return now ? paymentsFrom(now, address, direction) : readFirstPages(address, direction, caps);
  };
  const fetchOptions = { ttlMs: 10 * 60_000, force: options.force };
  return caps.paymentsBetween
    ? fetchQuery(payKey(address, direction), load, fetchOptions)
    : heavyQuery(options.scope ?? address, payKey(address, direction), load, fetchOptions);
}

/**
 * "Check older": the next 1,000, appended to what is loaded (a transaction
 * already there is not added twice). Returns the new page, or what was
 * there when nothing older is left.
 */
export async function loadOlderPayments(
  address: string,
  direction: PayDirection,
  options: { scope?: string } = {}
): Promise<PaymentPage | undefined> {
  const key = payKey(address, direction);
  const current = peekQuery<PaymentPage>(key);
  if (!current || current.done) return current;
  const caps = await getPaymentCaps(address);
  const read = () => readPage(address, direction, current.nextOffset, caps);
  const next = caps.paymentsBetween ? await read() : await heavy(options.scope ?? address, read);
  const seen = new Set(current.rows.map((row) => row.signature));
  const merged: PaymentPage = {
    rows: [...current.rows, ...next.rows.filter((row) => !seen.has(row.signature))],
    nextOffset: next.nextOffset,
    done: next.done,
  };
  setQueryData(key, merged);
  return merged;
}

/**
 * The asset transfers and multi-payments the account took part in (heavy):
 * 1,000 a read, up to 5,000; from its whole history when that is read.
 */
export function getAssetTransfers(
  address: string,
  options: { force?: boolean; scope?: string } = {}
): Promise<AssetTransfers> {
  return heavyQuery(
    options.scope ?? address,
    assetsKey(address),
    async () => {
      const full = fullHistory(address);
      if (full) return { rows: assetTransfersFrom(full), truncated: false };
      const rows: TxRow[] = [];
      for (let page = 0; page < ASSETS_PAGES; page++) {
        const chunk = await getJson<TxRow[]>(
          `/transactions/search?${query({
            address,
            txType: ['TRANSFER_ASSET', 'MULTI_PAYMENT'],
            confirmationStatus: 'CONFIRMED',
            limit: ASSETS_PAGE,
            offset: page * ASSETS_PAGE,
            reverse: true,
          })}`
        );
        const list = Array.isArray(chunk) ? chunk : [];
        rows.push(...list);
        if (list.length < ASSETS_PAGE) return { rows, truncated: false };
      }
      return { rows, truncated: true };
    },
    { ttlMs: 10 * 60_000, force: options.force }
  );
}
