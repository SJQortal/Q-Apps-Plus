/**
 * Sets of accounts: a sponsor's sponsees, and the checks run across them on
 * request.
 *
 * The sponsees come from the sponsor's own links (`xlinks:<sponsor>`,
 * rules/explorer/connections.ts sponseesOf); each is joined with MINTER
 * (the cached member list: in MINTER and since when; bans by the app's own
 * activeBanFor), who is minting now (`xonline`), and, per row on screen,
 * the account itself (level and penalty).
 *
 * The checks across a set run two accounts at a time, report progress, and
 * stop starting new reads when asked (a read already running finishes:
 * Core does the work either way, and its answer is cached for next time).
 */
import { activeBanFor } from '../group';
import type { BanRow, GroupMemberRow } from '../types';
import { getFirstSeen, type Funding, type OnlineShare } from './account';
import { getPayments, type PaymentPage } from './money';
import type { Sponsee } from '../../rules/explorer/connections';

/**
 * Run `worker` over `items`, `concurrency` at a time. Once `signal` is
 * aborted no new item starts; the promise settles when the running ones end.
 */
export async function runPool<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
  signal?: AbortSignal
): Promise<void> {
  let next = 0;
  const lane = async () => {
    while (next < items.length && !signal?.aborted) {
      const index = next++;
      await worker(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, lane));
}

// ---- the sponsees joined with MINTER and minting ------------------------------------

export interface SponseeRow extends Sponsee {
  /** Its row in MINTER's member list, when it is in MINTER now. */
  member: GroupMemberRow | null;
  /** In a reward share that is online now. */
  mintingNow: boolean;
  /** Banned from MINTER now (the app's activeBanFor). */
  banned: boolean;
}

export interface SetContext {
  /** MINTER's members (undefined while loading). */
  members?: readonly GroupMemberRow[];
  online?: readonly OnlineShare[];
  bans?: readonly BanRow[];
  now?: number;
}

export function joinSponsees(sponsees: readonly Sponsee[], context: SetContext): SponseeRow[] {
  const members = new Map((context.members ?? []).map((row) => [row.member, row]));
  const minting = new Set<string>();
  for (const share of context.online ?? []) {
    minting.add(share.minterAddress);
    minting.add(share.recipientAddress);
  }
  return sponsees.map((sponsee) => ({
    ...sponsee,
    member: members.get(sponsee.address) ?? null,
    mintingNow: minting.has(sponsee.address),
    banned: context.bans
      ? Boolean(activeBanFor([...context.bans], sponsee.address, context.now))
      : false,
  }));
}

// ---- checks across a set -------------------------------------------------------------

export interface SetProgress {
  done: number;
  total: number;
}

interface RunOptions {
  signal?: AbortSignal;
  onProgress?: (progress: SetProgress) => void;
  /** The page's account, for reads that go through the heavy-read limiter. */
  scope?: string;
}

/** What one account's check found: its answer, or that it couldn't be read. */
export type Checked<T> = { ok: true; value: T } | { ok: false };

async function across<T>(
  accounts: readonly string[],
  read: (address: string) => Promise<T>,
  options: RunOptions
): Promise<Map<string, Checked<T>>> {
  const results = new Map<string, Checked<T>>();
  let done = 0;
  options.onProgress?.({ done, total: accounts.length });
  await runPool(
    accounts,
    2,
    async (address) => {
      try {
        results.set(address, { ok: true, value: await read(address) });
      } catch {
        results.set(address, { ok: false });
      }
      done += 1;
      options.onProgress?.({ done, total: accounts.length });
    },
    options.signal
  );
  return results;
}

/** Where each account's first QORT came from (`xfirst:<a>`, cached per account). */
export function checkFirstFunding(
  accounts: readonly string[],
  options: RunOptions = {}
): Promise<Map<string, Checked<Funding | null>>> {
  return across(accounts, async (address) => (await getFirstSeen(address)).funding, options);
}

/** Each account's newest 100 QORT payments sent (`xpay:<a>:sent`, cached per account). */
export function checkPaymentsSent(
  accounts: readonly string[],
  options: RunOptions = {}
): Promise<Map<string, Checked<PaymentPage>>> {
  return across(
    accounts,
    (address) => getPayments(address, 'sent', { scope: options.scope }),
    options
  );
}
