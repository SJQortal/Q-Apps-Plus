/**
 * Whose first QORT payment came from this account (`xfunded:<a>`).
 *
 * One read of its first 100 QORT payments (`payments/between`, oldest
 * first); then, for each account it paid, that account's earliest QORT
 * payment received (`payments/between?recipientAddress=…&limit=1`): when
 * that one came from this account, it made their first QORT payment. 50
 * accounts are checked at first and 50 more per tap, 4 at a time. These are
 * light reads (a few ms each), not heavy address searches.
 */
import type { TxRow } from '../types';
import { getJson, query } from '../core';
import { fetchQuery, peekQuery, setQueryData } from '../query';
import { isAtAddress } from './account';
import { runPool } from './sets';

/** Accounts checked per tap. */
export const FUNDED_BATCH = 50;
const PAYMENTS = 100;

export interface Paid {
  address: string;
  /** This account's first payment to it. */
  height: number;
  timestamp: number;
  amount: string;
  signature: string;
}

/** An account's earliest QORT payment received. */
export interface FirstReceived {
  from: string | null;
  height: number;
  timestamp: number;
  amount: string;
  signature: string;
}

export interface Funded {
  /** How many of its first payments were read (at most 100). */
  payments: number;
  /** It sent more than the 100 read. */
  truncated: boolean;
  /** Each account it paid, in the order of its first payment to it (oldest first). */
  paid: Paid[];
  /** Payments to AT addresses, left out. */
  atLeftOut: number;
  /** Each checked account's earliest QORT payment received (null: Core had none). */
  checks: Record<string, FirstReceived | null>;
  /** How many of `paid` are checked (always the first ones). */
  checked: number;
}

export const fundedKey = (address: string) => `xfunded:${address}`;

function firstReceived(address: string): Promise<FirstReceived | null> {
  return getJson<TxRow[]>(
    `/transactions/payments/between?${query({
      recipientAddress: address,
      confirmationStatus: 'CONFIRMED',
      limit: 1,
    })}`
  ).then((rows) => {
    const row = Array.isArray(rows) ? rows[0] : undefined;
    if (!row || typeof row.blockHeight !== 'number') return null;
    return {
      from: typeof row.creatorAddress === 'string' ? row.creatorAddress : null,
      height: row.blockHeight,
      timestamp: row.timestamp,
      amount: String(row.amount ?? '0'),
      signature: row.signature,
    };
  });
}

/** Check the next `count` accounts not checked yet; returns the new value. */
async function checkNext(funded: Funded, count: number): Promise<Funded> {
  const batch = funded.paid.slice(funded.checked, funded.checked + count);
  const checks: Record<string, FirstReceived | null> = {};
  await runPool(batch, 4, async (paid) => {
    checks[paid.address] = await firstReceived(paid.address);
  });
  return {
    ...funded,
    checks: { ...funded.checks, ...checks },
    checked: funded.checked + batch.length,
  };
}

async function readFunded(address: string): Promise<Funded> {
  const rows = await getJson<TxRow[]>(
    `/transactions/payments/between?${query({
      senderAddress: address,
      confirmationStatus: 'CONFIRMED',
      limit: PAYMENTS,
    })}`
  );
  const list = (Array.isArray(rows) ? rows : []).filter(
    (row) => typeof row.blockHeight === 'number'
  );
  const paid = new Map<string, Paid>();
  let atLeftOut = 0;
  for (const row of list) {
    const to = typeof row.recipient === 'string' ? row.recipient : null;
    if (!to || to === address || paid.has(to)) continue;
    if (isAtAddress(to)) {
      atLeftOut += 1;
      continue;
    }
    paid.set(to, {
      address: to,
      height: row.blockHeight as number,
      timestamp: row.timestamp,
      amount: String(row.amount ?? '0'),
      signature: row.signature,
    });
  }
  return checkNext(
    {
      payments: list.length,
      truncated: list.length >= PAYMENTS,
      paid: [...paid.values()],
      atLeftOut,
      checks: {},
      checked: 0,
    },
    FUNDED_BATCH
  );
}

/** Its first 100 payments, and the first 50 accounts it paid checked. */
export function getFunded(address: string, options: { force?: boolean } = {}): Promise<Funded> {
  return fetchQuery(fundedKey(address), () => readFunded(address), {
    ttlMs: 30 * 60_000,
    force: options.force,
  });
}

/** "Check 50 more": the next accounts it paid. */
export async function checkMoreFunded(address: string): Promise<Funded | undefined> {
  const current = peekQuery<Funded>(fundedKey(address));
  if (!current || current.checked >= current.paid.length) return current;
  const next = await checkNext(current, FUNDED_BATCH);
  setQueryData(fundedKey(address), next);
  return next;
}

/** The accounts whose earliest QORT payment received came from `address`, among those checked. */
export function firstPaidBy(funded: Funded, address: string): Paid[] {
  return funded.paid
    .slice(0, funded.checked)
    .filter((paid) => funded.checks[paid.address]?.from === address);
}
