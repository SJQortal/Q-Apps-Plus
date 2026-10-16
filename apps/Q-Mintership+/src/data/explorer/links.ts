/**
 * The transactions that link an account to other accounts directly: reward
 * shares (sponsored by, sponsored, minting with), minting levels moved
 * (TRANSFER_PRIVS), names bought or sold, and the genesis-era account flags
 * and levels. One heavy address search (`xlinks:<a>`), 100 rows a page,
 * newest first, until a short page and never more than 5 pages. When the
 * cap cuts it short, one more search for TRANSFER_PRIVS alone, so a level
 * move is never left out.
 *
 * A level move the account sent names its recipient only in the raw bytes
 * (Core's JSON leaves it out): each one is decoded once (`xprivs:<sig>`).
 */
import type { TxRow } from '../types';
import { getJson, query } from '../core';
import { heavyQuery } from './heavy';
import { getPrivsRecipient } from './account';

/** The types one search reads. */
export const LINK_TX_TYPES = [
  'REWARD_SHARE',
  'TRANSFER_PRIVS',
  'BUY_NAME',
  'ACCOUNT_FLAGS',
  'ACCOUNT_LEVEL',
] as const;

/** Rows a page, and pages at most. */
export const LINK_PAGE = 100;
export const LINK_PAGES = 5;

export interface AccountLinks {
  /** Newest first. */
  rows: TxRow[];
  /** True when 5 full pages were read and Core may have more (level moves are complete anyway). */
  truncated: boolean;
  /** The recipient of each level move this account sent (null when its bytes couldn't be read). */
  privs: Record<string, string | null>;
}

export const linksKey = (address: string) => `xlinks:${address}`;

function searchPath(address: string, types: readonly string[], offset: number): string {
  return `/transactions/search?${query({
    address,
    txType: types,
    confirmationStatus: 'CONFIRMED',
    limit: LINK_PAGE,
    offset,
    reverse: true,
  })}`;
}

async function readLinks(address: string): Promise<AccountLinks> {
  const rows: TxRow[] = [];
  let truncated = true;
  for (let page = 0; page < LINK_PAGES; page++) {
    const chunk = await getJson<TxRow[]>(searchPath(address, LINK_TX_TYPES, page * LINK_PAGE));
    const list = Array.isArray(chunk) ? chunk : [];
    rows.push(...list);
    if (list.length < LINK_PAGE) {
      truncated = false;
      break;
    }
  }
  if (truncated) {
    // Reward shares filled the pages: read the level moves on their own.
    const seen = new Set(rows.map((row) => row.signature));
    const privs = await getJson<TxRow[]>(searchPath(address, ['TRANSFER_PRIVS'], 0));
    for (const row of Array.isArray(privs) ? privs : [])
      if (!seen.has(row.signature)) rows.push(row);
    rows.sort((a, b) => (b.blockHeight ?? 0) - (a.blockHeight ?? 0) || b.timestamp - a.timestamp);
  }
  const privs: Record<string, string | null> = {};
  for (const row of rows) {
    if (row.type !== 'TRANSFER_PRIVS' || row.creatorAddress !== address) continue;
    privs[row.signature] = await getPrivsRecipient(row.signature).catch(() => null);
  }
  return { rows, truncated, privs };
}

/**
 * An account's links (`xlinks:<a>`), through the heavy-read limiter.
 * `scope` is the account whose page asked (default: this one), so leaving
 * that page drops the read if it hasn't started.
 */
export function getLinks(
  address: string,
  options: { force?: boolean; scope?: string } = {}
): Promise<AccountLinks> {
  return heavyQuery(options.scope ?? address, linksKey(address), () => readLinks(address), {
    ttlMs: 10 * 60_000,
    force: options.force,
  });
}
