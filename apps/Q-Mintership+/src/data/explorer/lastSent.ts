/**
 * When an account last sent a transaction: its newest confirmed transaction
 * made with its own key (`GET /transactions/creator/{publicKey}`, newest
 * first, one row; Core orders them by the transaction's timestamp). Cheap:
 * Core reads it from an index on the creator, unlike a search by address.
 * Only an account with a public key has sent anything, so the Overview asks
 * only then. Kept 2 minutes under `xlastsent:<address>`.
 */
import { getJson, query, seg } from '../core';
import { fetchQuery } from '../query';
import type { TxRow } from '../types';

export interface LastSent {
  type: string;
  height: number;
  timestamp: number;
  signature: string;
}

export function lastSentKey(address: string): string {
  return `xlastsent:${address}`;
}

/** Its newest confirmed own transaction, or null when Core has none. */
export function getLastSent(
  address: string,
  publicKey: string,
  options: { force?: boolean } = {}
): Promise<LastSent | null> {
  return fetchQuery(
    lastSentKey(address),
    async () => {
      const rows = await getJson<TxRow[]>(
        `/transactions/creator/${seg(publicKey)}?${query({
          confirmationStatus: 'CONFIRMED',
          limit: 1,
          reverse: true,
        })}`
      );
      const row = Array.isArray(rows) ? rows[0] : undefined;
      if (!row || typeof row.blockHeight !== 'number') return null;
      return {
        type: String(row.type),
        height: row.blockHeight,
        timestamp: Number(row.timestamp),
        signature: String(row.signature),
      };
    },
    { ttlMs: 2 * 60_000, force: options.force }
  );
}
