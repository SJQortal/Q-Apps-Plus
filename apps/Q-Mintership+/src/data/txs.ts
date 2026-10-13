/**
 * Transaction reads: what is waiting for MINTER's admins, the signatures on
 * it, and the group history of an address or a time window.
 *
 * - `/transactions/pending?txGroupId=694` lists every transaction waiting
 *   for MINTER's approval, unconfirmed ones included.
 * - GROUP_APPROVAL rows carry no groupId and always txGroupId 0, so they are
 *   read by block range and joined to the pending list on `pendingSignature`.
 * - Block ranges only work with confirmationStatus=CONFIRMED.
 * - Every search is paged at 100 and bounded.
 */
import { cancelInviteTarget, type CancelInviteTarget } from '../qortal/groupTxBytes';
import { MINTER_GROUP_ID } from './constants';
import { getJson, getPaged, getText, query, seg, type PagedResult } from './core';
import { mapLimit } from './qdn';
import { fetchQuery, removeQuery } from './query';
import type { GroupTxType, TxRow } from './types';

const G = MINTER_GROUP_ID;

export interface RangeOptions {
  force?: boolean;
  ttlMs?: number;
  /**
   * Who reads this range ("queue", "nominations", …). A window that ends at
   * the tip gets a new key every block; with a slot, the previous key's
   * entry is dropped once the new one loads, instead of staying in the store.
   */
  slot?: string;
}

/** The keys each slot has read, the newest last. */
const slotKeys = new Map<string, string[]>();

/** fetchQuery for a moving range: once `key` loads, drop the slot's older keys. */
function rangeQuery<T>(
  key: string,
  load: () => Promise<T>,
  options: { ttlMs: number; force?: boolean; slot?: string }
): Promise<T> {
  const { slot } = options;
  if (slot) {
    const keys = (slotKeys.get(slot) ?? []).filter((k) => k !== key);
    slotKeys.set(slot, [...keys, key]);
  }
  const result = fetchQuery(key, load, { ttlMs: options.ttlMs, force: options.force });
  if (slot) {
    void result.then(
      () => {
        const keys = slotKeys.get(slot) ?? [];
        // Only the newest key cleans up: an older read finishing late keeps what came after it.
        if (keys[keys.length - 1] !== key) return;
        slotKeys.set(slot, [...keys.slice(0, -1).filter((k) => !removeQuery(k)), key]);
      },
      () => {}
    );
  }
  return result;
}

/** Transactions waiting for MINTER's approval (`txGroupId=694`), confirmed or not. */
export function getPending(options: { force?: boolean } = {}): Promise<PagedResult<TxRow>> {
  return fetchQuery(
    'pending:694',
    () =>
      getPaged<TxRow>(
        (offset, limit) => `/transactions/pending?${query({ txGroupId: G, limit, offset })}`,
        { maxPages: 5 }
      ),
    { ttlMs: 60_000, force: options.force }
  );
}

/**
 * Every pending transaction, any txGroupId (one row chain-wide today). Used
 * for the unusual approval route check: groupId 694 with a txGroupId other
 * than 694 or 0 (shown to admins only).
 */
export function getPendingAllGroups(
  options: { force?: boolean } = {}
): Promise<PagedResult<TxRow>> {
  return fetchQuery(
    'pending:all',
    () =>
      getPaged<TxRow>((offset, limit) => `/transactions/pending?${query({ limit, offset })}`, {
        maxPages: 5,
      }),
    { ttlMs: 2 * 60_000, force: options.force }
  );
}

/**
 * Confirmed GROUP_APPROVALs in blocks [startBlock, endBlock]. Paged at 100,
 * at most 50 pages (5,000 rows; about 600 in 180 days today).
 */
export function getApprovalsInRange(
  startBlock: number,
  endBlock: number,
  options: RangeOptions = {}
): Promise<PagedResult<TxRow>> {
  const start = Math.max(1, Math.floor(startBlock));
  const blockLimit = Math.max(1, Math.floor(endBlock) - start + 1);
  return rangeQuery(
    `approvals:${start}:${blockLimit}`,
    () =>
      getPaged<TxRow>(
        (offset, limit) =>
          `/transactions/search?${query({
            txType: 'GROUP_APPROVAL',
            confirmationStatus: 'CONFIRMED',
            startBlock: start,
            blockLimit,
            limit,
            offset,
          })}`,
        { maxPages: 50 }
      ),
    { ttlMs: options.ttlMs ?? 60_000, force: options.force, slot: options.slot }
  );
}

/** GROUP_APPROVALs still in the mempool (for "confirming…"). */
export function getUnconfirmedApprovals(
  options: { force?: boolean } = {}
): Promise<PagedResult<TxRow>> {
  return fetchQuery(
    'unconfirmed:GROUP_APPROVAL',
    () =>
      getPaged<TxRow>(
        (offset, limit) =>
          `/transactions/unconfirmed?${query({ txType: 'GROUP_APPROVAL', limit, offset })}`,
        { maxPages: 5 }
      ),
    { ttlMs: 20_000, force: options.force }
  );
}

/** Unconfirmed transactions of the given types (any group). */
export function getUnconfirmedOfTypes(
  types: readonly GroupTxType[],
  options: { force?: boolean } = {}
): Promise<PagedResult<TxRow>> {
  const key = [...types].sort().join(',');
  return fetchQuery(
    `unconfirmed:${key}`,
    () =>
      getPaged<TxRow>(
        (offset, limit) => `/transactions/unconfirmed?${query({ txType: types, limit, offset })}`,
        { maxPages: 5 }
      ),
    { ttlMs: 20_000, force: options.force }
  );
}

/** An account's unconfirmed transactions (Core refuses a 26th). Never cached. */
export async function getUnconfirmedBy(publicKey: string, txType?: GroupTxType): Promise<TxRow[]> {
  const rows = await getJson<TxRow[]>(
    `/transactions/unconfirmed?${query({ creator: publicKey, txType, limit: 100 })}`
  );
  return Array.isArray(rows) ? rows : [];
}

/** `GET /transactions/signature/{sig}`; null when Core doesn't know it (yet). */
export async function getTransaction(
  signature: string,
  options: { force?: boolean } = {}
): Promise<TxRow | null> {
  return fetchQuery(
    `tx:${signature}`,
    async () => {
      try {
        return await getJson<TxRow>(`/transactions/signature/${seg(signature)}`);
      } catch {
        return null;
      }
    },
    { ttlMs: 15_000, force: options.force }
  );
}

/**
 * The group and invitee of a CANCEL_GROUP_INVITE, which Core's JSON leaves
 * out, from `GET /transactions/signature/{sig}/raw`. A transaction never
 * changes, so the answer is kept for the session.
 */
export function getCancelInviteTarget(signature: string): Promise<CancelInviteTarget> {
  return fetchQuery(
    `txraw:${signature}`,
    async () => cancelInviteTarget(await getText(`/transactions/signature/${seg(signature)}/raw`)),
    { ttlMs: Number.POSITIVE_INFINITY }
  );
}

/**
 * Rows with the group and invitee filled in for CANCEL_GROUP_INVITE rows
 * that lack them. A row whose bytes can't be read stays without a group, so
 * it is never taken for a MINTER group change.
 */
export async function withCancelInviteTargets(rows: TxRow[]): Promise<TxRow[]> {
  return mapLimit(rows, 4, async (tx) => {
    if (tx.type !== 'CANCEL_GROUP_INVITE' || typeof tx.groupId === 'number') return tx;
    try {
      const target = await getCancelInviteTarget(tx.signature);
      return { ...tx, groupId: target.groupId, invitee: target.invitee };
    } catch {
      return tx;
    }
  });
}

/** The group transaction types that make up an address's MINTER history. */
export const HISTORY_TYPES: readonly GroupTxType[] = [
  'JOIN_GROUP',
  'LEAVE_GROUP',
  'GROUP_INVITE',
  'CANCEL_GROUP_INVITE',
  'GROUP_KICK',
  'GROUP_BAN',
  'CANCEL_GROUP_BAN',
  'ADD_GROUP_ADMIN',
  'REMOVE_GROUP_ADMIN',
];

/**
 * An address's confirmed group transactions (as creator or as target),
 * newest first, reduced to MINTER. At most 5 pages (500 rows): enough for
 * anyone's own history; an admin's created invites for others are included
 * and filtered by the caller.
 */
export function getAddressHistory(
  address: string,
  options: { force?: boolean } = {}
): Promise<PagedResult<TxRow>> {
  return fetchQuery(
    `history:${address}`,
    async () => {
      const result = await getPaged<TxRow>(
        (offset, limit) =>
          `/transactions/search?${query({
            address,
            txType: HISTORY_TYPES,
            confirmationStatus: 'CONFIRMED',
            limit,
            offset,
            reverse: true,
          })}`,
        { maxPages: 5 }
      );
      return { ...result, rows: result.rows.filter(isMinterTx) };
    },
    { ttlMs: 2 * 60_000, force: options.force }
  );
}

/** True for a transaction about MINTER (target group, or MINTER's approval for rows without a groupId). */
export function isMinterTx(tx: TxRow): boolean {
  if (typeof tx.groupId === 'number') return tx.groupId === G;
  return tx.txGroupId === G;
}

/**
 * Confirmed MINTER decisions (txGroupId 694) of the given types in a block
 * window, newest first, reduced to MINTER group changes. At most 50 pages.
 */
export function getDecisionsInRange(
  types: readonly GroupTxType[],
  startBlock: number,
  endBlock: number,
  options: RangeOptions = {}
): Promise<PagedResult<TxRow>> {
  const start = Math.max(1, Math.floor(startBlock));
  const blockLimit = Math.max(1, Math.floor(endBlock) - start + 1);
  const key = [...types].sort().join(',');
  return rangeQuery(
    `decisions:${key}:${start}:${blockLimit}`,
    async () => {
      const result = await getPaged<TxRow>(
        (offset, limit) =>
          `/transactions/search?${query({
            txGroupId: G,
            txType: types,
            confirmationStatus: 'CONFIRMED',
            startBlock: start,
            blockLimit,
            limit,
            offset,
            reverse: true,
          })}`,
        { maxPages: 50 }
      );
      return { ...result, rows: result.rows.filter(isMinterTx) };
    },
    { ttlMs: options.ttlMs ?? 5 * 60_000, force: options.force, slot: options.slot }
  );
}

/** Confirmed group transactions of the given types in a block window, any txGroupId (JOIN/LEAVE use 0). */
export function getGroupTxsInRange(
  types: readonly GroupTxType[],
  startBlock: number,
  endBlock: number,
  options: RangeOptions = {}
): Promise<PagedResult<TxRow>> {
  const start = Math.max(1, Math.floor(startBlock));
  const blockLimit = Math.max(1, Math.floor(endBlock) - start + 1);
  const key = [...types].sort().join(',');
  return rangeQuery(
    `grouptxs:${key}:${start}:${blockLimit}`,
    async () => {
      const result = await getPaged<TxRow>(
        (offset, limit) =>
          `/transactions/search?${query({
            txType: types,
            confirmationStatus: 'CONFIRMED',
            startBlock: start,
            blockLimit,
            limit,
            offset,
            reverse: true,
          })}`,
        { maxPages: 50 }
      );
      return { ...result, rows: result.rows.filter(isMinterTx) };
    },
    { ttlMs: options.ttlMs ?? 5 * 60_000, force: options.force, slot: options.slot }
  );
}
