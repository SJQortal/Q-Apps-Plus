/**
 * Requested to join MINTER Group (Ready to mint until 2026-10-18; now
 * Decisions → Propose → Decline a join request, for Minter Admins): the
 * people who asked to join MINTER (a join request), less current members and
 * anyone banned now.
 *
 * - `/groups/joinrequests/694` is one unpaged list (92 rows today), without
 *   dates and in address order (Core: `ORDER BY joiner`).
 * - Sorted (readySort, the newest request first by default): when each
 *   person last asked to join comes from their MINTER history (the read their
 *   former-member mark already makes), level and blocks minted from their
 *   account, the name from their primary name; one read per person, six at a
 *   time, kept 10 minutes, and only the reads the chosen order needs
 *   (loadReadyOrder). Your node's order needs none.
 * - The join requests, members, admins and bans are the cached reads the
 *   nominations already make, so the list itself adds no GETs there.
 * - Each person's level, blocks minted, name and whether they were a member
 *   before are read only for the rows on screen, six reads at a time, and
 *   cached (loadReadyDetails).
 * - The search (matchReady) matches addresses directly and resolves a typed
 *   name to its owners (data/nameSearch.ts → findNameOwners): no row's name
 *   is read to search.
 */
import { formerMember, type FormerMember } from '../rules/status';
import { effectiveBlocksMinted, getAccount, getPrimaryName, isAddress } from './accounts';
import { getChainNow } from './chain';
import { MINTER_GROUP_ID } from './constants';
import { activeBanFor, getAdmins, getBans, getJoinRequests, getMembers } from './group';
import { mapLimit } from './qdn';
import { fetchQuery } from './query';
import { getAddressHistory } from './txs';
import type { BanRow, JoinRequestRow, TxRow } from './types';

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

/** Base58 characters, as in an address: a typed part of one is matched directly. */
const ADDRESS_PART_RE = /^[1-9A-HJ-NP-Za-km-z]{4,}$/;

/**
 * The list's search, in Core's order: a typed address matches that
 * person only; a part of an address (4 characters or more, as the short
 * address on each row shows) matches the addresses that contain it; a name
 * matches the owners found for it (`owners`, from findNameOwners) and the
 * names already read for rows on screen (`nameOf`). No row's name is read
 * to search.
 */
export function matchReady(
  people: string[],
  text: string,
  owners: ReadonlySet<string>,
  nameOf: (address: string) => string | null | undefined = () => null
): string[] {
  const q = text.trim().replace(/^@/, '');
  if (!q) return people;
  // A whole address (the guard is on a copy, so `q` stays a string below).
  const typed: unknown = q;
  if (isAddress(typed)) return people.filter((address) => address === typed);
  const part = ADDRESS_PART_RE.test(q);
  const lower = q.toLowerCase();
  return people.filter(
    (address) =>
      owners.has(address) ||
      (part && address.includes(q)) ||
      Boolean(nameOf(address)?.toLowerCase().includes(lower))
  );
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

/** The key when someone last asked to join is kept under. */
export const askedKey = (address: string) => `asked:${address}`;

/** When `address` last asked to join MINTER: their newest MINTER JOIN_GROUP (ms), from `rows`. */
export function lastAskedAt(address: string, rows: readonly TxRow[]): number | null {
  let newest: number | null = null;
  for (const tx of rows) {
    if (tx.type !== 'JOIN_GROUP' || tx.creatorAddress !== address) continue;
    if (Number(tx.groupId) !== MINTER_GROUP_ID || tx.approvalStatus === 'INVALID') continue;
    if (newest === null || tx.timestamp > newest) newest = tx.timestamp;
  }
  return newest;
}

/**
 * When someone on the list last asked to join, from their MINTER history
 * (the same cached search as their former-member mark), kept 10 minutes.
 */
export function getAskedAt(address: string): Promise<number | null> {
  return fetchQuery(
    askedKey(address),
    async () => lastAskedAt(address, (await getAddressHistory(address)).rows),
    { ttlMs: READY_ACCOUNT_TTL_MS }
  );
}

// ---- the order ----------------------------------------------------------------

export type ReadySort = 'newest' | 'oldest' | 'level' | 'blocks' | 'name' | 'node';

export const READY_SORTS: ReadonlyArray<{ key: ReadySort; label: string }> = [
  { key: 'newest', label: 'Newest request first' },
  { key: 'oldest', label: 'Oldest request first' },
  { key: 'level', label: 'Highest level' },
  { key: 'blocks', label: 'Most blocks minted' },
  { key: 'name', label: 'Name (A–Z)' },
  { key: 'node', label: 'Your node’s order' },
];

export const DEFAULT_READY_SORT: ReadySort = 'newest';

/** `?sort=` as an order; anything else is the default (newest request first). */
export function parseReadySort(value: string | null): ReadySort {
  return READY_SORTS.some((s) => s.key === value) ? (value as ReadySort) : DEFAULT_READY_SORT;
}

export interface ReadyFacts {
  askedAt?: number | null;
  level?: number | null;
  blocks?: number | null;
  name?: string | null;
}

/**
 * `people` in the chosen order. What isn't known (a read that failed, no
 * name, no join request found in a long history) goes last; at the same
 * level, more blocks minted comes first; other ties keep your node's order.
 * Pure.
 */
export function sortReady(
  people: readonly string[],
  sort: ReadySort,
  facts: (address: string) => ReadyFacts
): string[] {
  if (sort === 'node') return [...people];
  const value = (address: string): number | string | null => {
    const f = facts(address);
    if (sort === 'newest' || sort === 'oldest') return f.askedAt ?? null;
    if (sort === 'level') return f.level ?? null;
    if (sort === 'blocks') return f.blocks ?? null;
    return f.name ?? null;
  };
  const rows = people.map((address, index) => ({ address, index, value: value(address) }));
  rows.sort((a, b) => {
    if (a.value === null || b.value === null)
      return a.value === b.value ? a.index - b.index : a.value === null ? 1 : -1;
    let order: number;
    if (typeof a.value === 'string' && typeof b.value === 'string')
      order = a.value.localeCompare(b.value, undefined, { sensitivity: 'base', numeric: true });
    else order = (a.value as number) - (b.value as number);
    if (sort !== 'oldest' && sort !== 'name') order = -order;
    // The same level: more blocks minted first.
    if (!order && sort === 'level')
      order = (facts(b.address).blocks ?? -1) - (facts(a.address).blocks ?? -1);
    return order || a.index - b.index;
  });
  return rows.map((r) => r.address);
}

/** The key of an order: the sort and a fingerprint of the whole list it orders. */
export function readyOrderKey(people: readonly string[], sort: ReadySort): string {
  let hash = 5381;
  for (const address of people)
    for (let i = 0; i < address.length; i++) hash = ((hash * 33) ^ address.charCodeAt(i)) >>> 0;
  return `ready:order:${sort}:${people.length}:${hash.toString(36)}`;
}

/**
 * The list in the chosen order (key readyOrderKey): the one read per person
 * that order needs, six at a time, each kept 10 minutes and shared with the
 * rows (a row on screen then reads nothing again).
 */
export function loadReadyOrder(people: readonly string[], sort: ReadySort): Promise<string[]> {
  return fetchQuery(
    readyOrderKey(people, sort),
    async () => {
      if (sort === 'node') return [...people];
      const facts = new Map<string, ReadyFacts>();
      await mapLimit([...people], READY_READS_AT_ONCE, async (address) => {
        try {
          if (sort === 'newest' || sort === 'oldest')
            facts.set(address, { askedAt: await getAskedAt(address) });
          else if (sort === 'name') facts.set(address, { name: await getPrimaryName(address) });
          else {
            const account = await getAccount(address, { ttlMs: READY_ACCOUNT_TTL_MS });
            facts.set(address, { level: account.level, blocks: effectiveBlocksMinted(account) });
          }
        } catch {
          // Unknown: goes last.
        }
      });
      return sortReady(people, sort, (address) => facts.get(address) ?? {});
    },
    { ttlMs: READY_ACCOUNT_TTL_MS }
  );
}

/**
 * Read the account (`account:<a>`), primary name (`name:<a>`), former-member
 * mark (`former:<a>`) and when they asked to join (`asked:<a>`, from the same
 * history read as the mark) of the rows on screen into the read store, at
 * most six reads at a time. Cached ones cost nothing; a failed
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
    // One slot: when they asked comes from the history the mark has just read.
    () => getFormerMember(address).then(() => getAskedAt(address)),
  ]);
  await mapLimit(reads, READY_READS_AT_ONCE, async (read) => {
    if (options.signal?.aborted) return;
    await read().catch(() => undefined);
  });
}
