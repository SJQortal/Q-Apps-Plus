/**
 * One source for a group's members and their public keys (docs/QORTAL.md →
 * Efficiency rules 1, 2 and 5):
 *
 * - members are paged through `/groups/members/<id>?limit=100&offset=N` until a
 *   short page comes back (never `limit=0`);
 * - the registered name and public key of an address are resolved once per
 *   address and kept for the session, so a member who sits in several groups
 *   costs one `/names/address` and one `GET_ACCOUNT_DATA`, not one per group;
 * - a group's member list is reused for 10 minutes; identical lookups already
 *   in flight share one promise;
 * - every member with a public key is included, named or not, because thread
 *   messages must be encrypted to every member of the group (data contract §7).
 *
 * Shared by the group thread list (member list), the thread screen (keys for a
 * reply) and the main composer (`getGroupPublicKeys`, same contract as
 * NewMessage's `fetchGroupPublicKeys`: groupId → publicKeys[]).
 */
import { getNameInfo } from './apiCalls';

export interface GroupMember {
  address: string;
  /** Registered name, or "" when the address has none. */
  name: string;
  /** Base58 public key, or "" when the account has not been seen on chain yet. */
  publicKey: string;
  isAdmin: boolean;
  joined?: number;
}

export interface GroupMembersResult {
  groupId: string;
  members: GroupMember[];
  /** When the member list was fetched (ms epoch). */
  fetchedAt: number;
}

/** Members keyed the way `NewThread` expects (`{[name]: {publicKey, address}}`). Nameless members are keyed by address. */
export type GroupMembersByName = Record<string, { publicKey: string; address: string; name: string }>;

export const GROUP_MEMBERS_PAGE_SIZE = 100;
export const GROUP_MEMBERS_MAX_AGE_MS = 10 * 60_000;
/** How many address lookups run at once. */
export const LOOKUP_CONCURRENCY = 6;

const groupCache = new Map<string, GroupMembersResult>();
const groupInFlight = new Map<string, Promise<GroupMembersResult>>();
const nameByAddress = new Map<string, string>();
const nameInFlight = new Map<string, Promise<string>>();
const publicKeyByAddress = new Map<string, string>();
const publicKeyInFlight = new Map<string, Promise<string>>();

let stats = { memberPages: 0, nameLookups: 0, keyLookups: 0, groupHits: 0, groupFetches: 0 };

const normalizeGroupId = (groupId: string | number | null | undefined): string =>
  String(groupId ?? '').trim();

const dedupe = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean)));

/** Name for an address, resolved once per session. */
export async function resolveNameForAddress(address: string): Promise<string> {
  const cached = nameByAddress.get(address);
  if (cached !== undefined) return cached;
  const running = nameInFlight.get(address);
  if (running) return running;
  const request = (async () => {
    stats.nameLookups += 1;
    const name = await getNameInfo(address);
    nameByAddress.set(address, name);
    return name;
  })();
  nameInFlight.set(address, request);
  try {
    return await request;
  } finally {
    nameInFlight.delete(address);
  }
}

/** Public key for an address, resolved once per session (`""` when unknown). */
export async function resolvePublicKeyForAddress(address: string): Promise<string> {
  const cached = publicKeyByAddress.get(address);
  if (cached) return cached;
  const running = publicKeyInFlight.get(address);
  if (running) return running;
  const request = (async () => {
    stats.keyLookups += 1;
    try {
      const account = await qortalRequest({ action: 'GET_ACCOUNT_DATA', address });
      const publicKey = typeof account?.publicKey === 'string' ? account.publicKey : '';
      // Only remember answers; an empty key may fill in once the account is on chain.
      if (publicKey) publicKeyByAddress.set(address, publicKey);
      return publicKey;
    } catch {
      return '';
    }
  })();
  publicKeyInFlight.set(address, request);
  try {
    return await request;
  } finally {
    publicKeyInFlight.delete(address);
  }
}

/** Seed the per-address caches from data the app already has (e.g. the signed-in user). */
export function rememberAccount(address: string, info: { name?: string; publicKey?: string }): void {
  if (!address) return;
  if (typeof info.name === 'string' && info.name) nameByAddress.set(address, info.name);
  if (typeof info.publicKey === 'string' && info.publicKey) publicKeyByAddress.set(address, info.publicKey);
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

interface RawMember {
  member?: string;
  isAdmin?: boolean;
  joined?: number;
}

/** Page the member addresses of a group: limit 100 per page, stop on a short page. */
export async function fetchGroupMemberAddresses(groupId: string, signal?: AbortSignal): Promise<RawMember[]> {
  const all: RawMember[] = [];
  const seen = new Set<string>();
  let offset = 0;
  // A hard ceiling so a misbehaving node can never keep us paging forever.
  for (let page = 0; page < 200; page += 1) {
    const params = new URLSearchParams({ limit: String(GROUP_MEMBERS_PAGE_SIZE), offset: String(offset) });
    stats.memberPages += 1;
    const response = await fetch(`/groups/members/${encodeURIComponent(groupId)}?${params.toString()}`, { signal });
    if (!response.ok) throw new Error(`Could not load group members (${response.status})`);
    const body = await response.json();
    const members: RawMember[] = Array.isArray(body?.members) ? body.members : Array.isArray(body) ? body : [];
    for (const raw of members) {
      const address = typeof raw?.member === 'string' ? raw.member.trim() : '';
      if (!address || seen.has(address)) continue;
      seen.add(address);
      all.push({ member: address, isAdmin: Boolean(raw?.isAdmin), joined: raw?.joined });
    }
    if (members.length < GROUP_MEMBERS_PAGE_SIZE) break;
    offset += members.length;
  }
  return all;
}

export interface GetGroupMembersOptions {
  /** Ignore a cached list and fetch again. */
  force?: boolean;
  /** Reuse a cached list younger than this (default 10 min). */
  maxAgeMs?: number;
  signal?: AbortSignal;
}

/** Members of a group with names and public keys, cached for the session. */
export async function getGroupMembers(
  groupIdInput: string | number,
  options: GetGroupMembersOptions = {}
): Promise<GroupMembersResult> {
  const groupId = normalizeGroupId(groupIdInput);
  if (!groupId) return { groupId: '', members: [], fetchedAt: Date.now() };
  const maxAge = options.maxAgeMs ?? GROUP_MEMBERS_MAX_AGE_MS;

  if (!options.force) {
    const hit = groupCache.get(groupId);
    if (hit && Date.now() - hit.fetchedAt < maxAge) {
      stats.groupHits += 1;
      return hit;
    }
  }
  const running = groupInFlight.get(groupId);
  if (running) return running;

  const request = (async () => {
    stats.groupFetches += 1;
    const raw = await fetchGroupMemberAddresses(groupId, options.signal);
    const members = await mapWithConcurrency(raw, LOOKUP_CONCURRENCY, async (item): Promise<GroupMember> => {
      const address = item.member as string;
      const [name, publicKey] = await Promise.all([
        resolveNameForAddress(address),
        resolvePublicKeyForAddress(address),
      ]);
      return { address, name, publicKey, isAdmin: Boolean(item.isAdmin), joined: item.joined };
    });
    const result: GroupMembersResult = { groupId, members, fetchedAt: Date.now() };
    groupCache.set(groupId, result);
    return result;
  })();

  groupInFlight.set(groupId, request);
  try {
    return await request;
  } finally {
    groupInFlight.delete(groupId);
  }
}

/** A cached member list without fetching (null when none or stale). */
export function peekGroupMembers(groupIdInput: string | number, maxAgeMs = GROUP_MEMBERS_MAX_AGE_MS): GroupMembersResult | null {
  const hit = groupCache.get(normalizeGroupId(groupIdInput));
  if (!hit || Date.now() - hit.fetchedAt >= maxAgeMs) return null;
  return hit;
}

/**
 * Public keys of every member of a group (deduped; members whose key is not
 * on chain yet are left out, as in NewMessage's `fetchGroupPublicKeys`).
 * Same contract as that function: `groupId → publicKeys[]`.
 */
export async function getGroupPublicKeys(groupId: string | number, options?: GetGroupMembersOptions): Promise<string[]> {
  const { members } = await getGroupMembers(groupId, options);
  return dedupe(members.map((member) => member.publicKey));
}

/**
 * The `members` map `NewThread` reads (`Object.keys(members).map(k => members[k].publicKey)`).
 * Named members are keyed by name; nameless members are keyed by address so
 * their keys are still part of the encryption, which the old map dropped.
 */
export function toMembersByName(members: GroupMember[]): GroupMembersByName {
  const map: GroupMembersByName = {};
  for (const member of members) {
    if (!member.publicKey) continue;
    const key = member.name || member.address;
    if (map[key]) continue;
    map[key] = { publicKey: member.publicKey, address: member.address, name: member.name };
  }
  return map;
}

/** Names of the members that have one (for display and `name=` filters). */
export function memberNames(members: GroupMember[]): string[] {
  return dedupe(members.map((member) => member.name));
}

export function invalidateGroupMembers(groupId?: string | number): void {
  if (groupId === undefined) {
    groupCache.clear();
    return;
  }
  groupCache.delete(normalizeGroupId(groupId));
}

export function groupMembersStats() {
  return { ...stats, cachedGroups: groupCache.size, cachedNames: nameByAddress.size, cachedKeys: publicKeyByAddress.size };
}

export function resetGroupMembersCache(): void {
  groupCache.clear();
  groupInFlight.clear();
  nameByAddress.clear();
  nameInFlight.clear();
  publicKeyByAddress.clear();
  publicKeyInFlight.clear();
  stats = { memberPages: 0, nameLookups: 0, keyLookups: 0, groupHits: 0, groupFetches: 0 };
}
