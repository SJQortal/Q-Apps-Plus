/**
 * Ready to mint: the people who asked to join MINTER (a join request), less
 * current members and anyone banned now. Nominators find candidates here.
 *
 * - `/groups/joinrequests/694` is one unpaged list (91 rows today) without
 *   dates, so Core's order is kept: nothing is sorted by a value that would
 *   need every row's account.
 * - The join requests, members, admins and bans are the cached reads the
 *   nominations already make, so the list itself adds no GETs there.
 * - Each person's level, blocks minted, name and whether they were a member
 *   before are read only for the rows on screen, six reads at a time, and
 *   cached (loadReadyDetails).
 */
import { formerMember, type FormerMember } from '../rules/status';
import { getAccount, getPrimaryName } from './accounts';
import { getChainNow } from './chain';
import { MINTER_GROUP_ID } from './constants';
import { activeBanFor, getAdmins, getBans, getJoinRequests, getMembers } from './group';
import { mapLimit } from './qdn';
import { fetchQuery } from './query';
import { getAddressHistory } from './txs';
import type { BanRow, JoinRequestRow } from './types';

export const READY_KEY = 'ready:list';
/** Rows shown per page ("Show more" adds the next page). */
export const READY_PAGE = 20;
/** Reads in flight at once for the rows on screen. */
export const READY_READS_AT_ONCE = 6;
/** Levels change over weeks: an account read for this list is kept 10 minutes. */
export const READY_ACCOUNT_TTL_MS = 10 * 60_000;

export interface ReadyToMint {
  /** Addresses in Core's order, each once. */
  people: string[];
  /** The member list stopped before its end, so a member could show here. */
  truncated: boolean;
}

export interface ReadyInput {
  joinRequests: JoinRequestRow[];
  /** Members and admins: already in MINTER. */
  inGroup: Set<string>;
  bans: BanRow[];
  now: number;
}

/** Join requests to MINTER less members and anyone banned now: Core's order, each address once. */
export function pickReadyToMint(input: ReadyInput): string[] {
  const seen = new Set<string>();
  const people: string[] = [];
  for (const row of input.joinRequests) {
    const address = row.joiner;
    if (Number(row.groupId) !== MINTER_GROUP_ID || !address || seen.has(address)) continue;
    seen.add(address);
    if (input.inGroup.has(address)) continue;
    if (activeBanFor(input.bans, address, input.now)) continue;
    people.push(address);
  }
  return people;
}

/**
 * The list (key `ready:list`). Its reads are not forced: the nominations
 * refresh them at their own pace, and `force` only works the list out again
 * from what is cached.
 */
export function loadReadyToMint(options: { force?: boolean } = {}): Promise<ReadyToMint> {
  return fetchQuery(
    READY_KEY,
    async () => {
      const [joinRequests, members, admins, bans] = await Promise.all([
        getJoinRequests(),
        getMembers(),
        getAdmins(),
        getBans(),
      ]);
      const inGroup = new Set([
        ...members.members.map((m) => m.member),
        ...admins.admins.map((a) => a.member),
      ]);
      return {
        people: pickReadyToMint({ joinRequests, inGroup, bans, now: Date.now() }),
        truncated: members.truncated,
      };
    },
    { ttlMs: 60_000, force: options.force }
  );
}

/** The key a row's former-member mark is kept under. */
export const formerKey = (address: string) => `former:${address}`;

/**
 * Whether someone on the list was a MINTER member before (kicked, banned
 * once, or left), from their MINTER history: one history search per row,
 * kept 10 minutes like the account. The tip it is dated by is the cached one
 * the nominations already read.
 */
export function getFormerMember(address: string): Promise<FormerMember | null> {
  return fetchQuery(
    formerKey(address),
    async () => {
      const [history, now] = await Promise.all([getAddressHistory(address), getChainNow()]);
      return formerMember(
        address,
        history.rows,
        { height: now.height, timestamp: now.timestamp },
        now.msPerBlock
      );
    },
    { ttlMs: READY_ACCOUNT_TTL_MS }
  );
}

/**
 * Read the account (`account:<a>`), primary name (`name:<a>`) and
 * former-member mark (`former:<a>`) of the rows on screen into the read
 * store, at most six reads at a time. Cached ones cost nothing; a failed
 * read leaves its key in error for the row to say so (or, for the mark, to
 * show none). Once `signal` aborts, no new read starts.
 */
export async function loadReadyDetails(
  addresses: string[],
  options: { signal?: AbortSignal } = {}
): Promise<void> {
  const reads = addresses.flatMap((address) => [
    () => getAccount(address, { ttlMs: READY_ACCOUNT_TTL_MS }),
    () => getPrimaryName(address),
    () => getFormerMember(address),
  ]);
  await mapLimit(reads, READY_READS_AT_ONCE, async (read) => {
    if (options.signal?.aborted) return;
    await read().catch(() => undefined);
  });
}
