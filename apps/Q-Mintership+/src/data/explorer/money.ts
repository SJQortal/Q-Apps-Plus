/**
 * QORT and assets that moved between an account and others.
 *
 * - QORT payments (PAYMENT) come from `/transactions/payments/between`,
 *   the fastest counterparty read Core has (a few ms, not a heavy search):
 *   `xpay:<a>:sent` and `xpay:<a>:recv`, 100 a read, newest first, each
 *   `{rows, nextOffset, done}`. "Check older" appends the next 100.
 * - Asset transfers and multi-payments (TRANSFER_ASSET, MULTI_PAYMENT) need
 *   an address search, so they are heavy: `xassets:<a>`, the newest 100.
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

export const PAY_PAGE = 100;
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

/**
 * The newest 100 QORT payments an account sent (`sent`) or received
 * (`recv`). `scope` is the page's account, for the heavy fallback.
 */
export async function getPayments(
  address: string,
  direction: PayDirection,
  options: { force?: boolean; scope?: string } = {}
): Promise<PaymentPage> {
  const caps = await getPaymentCaps(address);
  const load = () => readPage(address, direction, 0, caps);
  const fetchOptions = { ttlMs: 10 * 60_000, force: options.force };
  return caps.paymentsBetween
    ? fetchQuery(payKey(address, direction), load, fetchOptions)
    : heavyQuery(options.scope ?? address, payKey(address, direction), load, fetchOptions);
}

/**
 * "Check older": the next 100, appended to what is loaded (a transaction
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

/** The newest 100 asset transfers and multi-payments the account took part in (heavy). */
export function getAssetTransfers(
  address: string,
  options: { force?: boolean; scope?: string } = {}
): Promise<AssetTransfers> {
  return heavyQuery(
    options.scope ?? address,
    assetsKey(address),
    async () => {
      const rows = await getJson<TxRow[]>(
        `/transactions/search?${query({
          address,
          txType: ['TRANSFER_ASSET', 'MULTI_PAYMENT'],
          confirmationStatus: 'CONFIRMED',
          limit: PAY_PAGE,
          reverse: true,
        })}`
      );
      const list = Array.isArray(rows) ? rows : [];
      return { rows: list, truncated: list.length >= PAY_PAGE };
    },
    { ttlMs: 10 * 60_000, force: options.force }
  );
}
