/**
 * Group membership and admin checks (legacy QortalApi.js "QORTAL GROUP-RELATED
 * CALLS"). The MINTER group (694) and the admin groups decide what a user may
 * see and do, so these lists are read once and reused for a minute.
 */
import { coreJson, coreGet } from './client';
import { createTtlCache, dedupeInflight } from './cache';
import {
  ADMIN_GROUP_IDS,
  ADMIN_GROUP_NAMES,
  GROUP_INVITES_BY_ADDRESS_CACHE_TTL_MS,
  MINTER_GROUP_ID,
} from './constants';
import { getPublicKeyFromAddress } from './account';
import { trimString } from './util';

export interface GroupMembership {
  groupId: number;
  groupName: string;
  owner?: string;
  isAdmin?: boolean;
  [key: string]: unknown;
}

export interface GroupMember {
  member: string;
  joined?: number;
  isAdmin?: boolean;
}

export interface GroupInvite {
  groupId: number;
  inviter: string;
  invitee: string;
  expiry: number;
}

export interface GroupSummary {
  groupId: number;
  groupName: string;
  owner: string;
  description?: string;
  memberCount?: number;
  [key: string]: unknown;
}

export interface AdminFlags {
  /** Member of one of the forum admin groups. */
  isForumAdmin: boolean;
  /** Admin of the MINTER group. */
  isMinterAdmin: boolean;
  /** Either of the above: what the legacy `userState.isAdmin` meant. */
  isAdmin: boolean;
}

const GROUP_LIST_TTL_MS = 60_000;
const minterAdminsCache = createTtlCache<GroupMember[]>(GROUP_LIST_TTL_MS);
const minterMembersCache = createTtlCache<GroupMember[]>(GROUP_LIST_TTL_MS);
const userGroupsCache = createTtlCache<GroupMembership[]>(GROUP_LIST_TTL_MS);
const invitesCache = createTtlCache<GroupInvite[]>(GROUP_INVITES_BY_ADDRESS_CACHE_TTL_MS);
const inflight = new Map<string, Promise<unknown>>();

export function resetGroupCaches(): void {
  minterAdminsCache.clear();
  minterMembersCache.clear();
  userGroupsCache.clear();
  invitesCache.clear();
}

export function clearGroupInvitesByAddressCache(): void {
  invitesCache.clear();
}

/** `/groups/member/{address}`: the groups an address belongs to. Throws on failure. */
export async function getUserGroups(address: string, force = false): Promise<GroupMembership[]> {
  const key = trimString(address);
  if (!key) throw new Error('getUserGroups needs an address');
  if (!force) {
    const hit = userGroupsCache.get(key);
    if (hit) return hit;
  }
  return dedupeInflight(inflight as Map<string, Promise<GroupMembership[]>>, `groups:${key}`, async () => {
    const response = await coreGet(`/groups/member/${key}`);
    const data = (await response.json()) as GroupMembership[];
    const list = Array.isArray(data) ? data : [];
    userGroupsCache.set(key, list);
    return list;
  });
}

/** Admins of the MINTER group: `[{ member, isAdmin: true, joined }]`. Throws if the shape is wrong. */
export async function fetchMinterGroupAdmins(force = false): Promise<GroupMember[]> {
  if (!force) {
    const hit = minterAdminsCache.get('admins');
    if (hit) return hit;
  }
  return dedupeInflight(inflight as Map<string, Promise<GroupMember[]>>, 'minter-admins', async () => {
    const data = await coreJson<{ members?: GroupMember[] }>(
      `/groups/members/${MINTER_GROUP_ID}?onlyAdmins=true&limit=0&reverse=true`
    );
    if (!Array.isArray(data?.members)) {
      throw new Error("Expected 'members' to be an array but got a different structure");
    }
    minterAdminsCache.set('admins', data.members);
    return data.members;
  });
}

/** Every member of the MINTER group: `[{ member, joined }]`. Empty on failure. */
export async function fetchMinterGroupMembers(force = false): Promise<GroupMember[]> {
  if (!force) {
    const hit = minterMembersCache.get('members');
    if (hit) return hit;
  }
  return dedupeInflight(inflight as Map<string, Promise<GroupMember[]>>, 'minter-members', async () => {
    try {
      const data = await coreJson<{ members?: GroupMember[] }>(
        `/groups/members/${MINTER_GROUP_ID}?limit=0`
      );
      if (!Array.isArray(data?.members)) {
        throw new Error("Expected 'members' to be an array but got a different structure");
      }
      minterMembersCache.set('members', data.members);
      return data.members;
    } catch {
      return [];
    }
  });
}

/** Members of every admin group, deduplicated by address. Empty on failure. */
export async function fetchAllAdminGroupsMembers(): Promise<GroupMember[]> {
  try {
    const seen = new Set<string>();
    const result: GroupMember[] = [];
    for (const groupId of ADMIN_GROUP_IDS) {
      const response = await coreGet(`/groups/members/${groupId}?limit=0`);
      const data = (await response.json()) as { members?: GroupMember[] };
      if (!Array.isArray(data?.members)) continue;
      for (const member of data.members) {
        if (member?.member && !seen.has(member.member)) {
          result.push(member);
          seen.add(member.member);
        }
      }
    }
    return result;
  } catch {
    return [];
  }
}

/** `/groups?limit=…&reverse=true`. */
export async function fetchAllGroups(limit = 2000): Promise<GroupSummary[]> {
  const response = await coreGet(`/groups?limit=${limit}&reverse=true`);
  const data = (await response.json()) as GroupSummary[];
  return Array.isArray(data) ? data : [];
}

/**
 * Public keys of every admin (admin groups plus MINTER group admins), the
 * list a private board publish encrypts to. Empty on failure.
 */
export async function fetchAdminGroupsMembersPublicKeys(): Promise<string[]> {
  try {
    const members = [...(await fetchAllAdminGroupsMembers()), ...(await fetchMinterGroupAdmins())];
    const keys: string[] = [];
    for (const member of members) {
      const key = await getPublicKeyFromAddress(member.member);
      if (key) keys.push(key);
    }
    return keys;
  } catch {
    return [];
  }
}

/** `/groups/invites/{address}`: pending invites for an address. Throws on failure. */
export async function fetchGroupInvitesByAddress(address: string): Promise<GroupInvite[]> {
  const response = await coreGet(`/groups/invites/${encodeURIComponent(address)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch group invites: HTTP ${response.status}, ${await response.text()}`);
  }
  const invites = (await response.json()) as GroupInvite[];
  if (!Array.isArray(invites)) throw new Error('Group invites response is not an array as expected.');
  return invites;
}

/** Same, cached for 15 s (the legacy TTL). A failure is cached as [] and rethrown. */
export async function fetchGroupInvitesByAddressCached(
  address: string,
  force = false
): Promise<GroupInvite[]> {
  const key = trimString(address);
  if (!key) return [];
  if (!force) {
    const hit = invitesCache.get(key);
    if (hit) return hit;
  }
  try {
    const invites = await fetchGroupInvitesByAddress(key);
    invitesCache.set(key, invites);
    return invites;
  } catch (error) {
    invitesCache.set(key, []);
    throw error;
  }
}

/** The admin flags the legacy `verifyUserIsAdmin` / `verifyAddressIsAdmin` derived. */
export async function getAdminFlags(address: string): Promise<AdminFlags> {
  const key = trimString(address);
  if (!key) return { isForumAdmin: false, isMinterAdmin: false, isAdmin: false };
  const [groups, minterAdmins] = await Promise.all([getUserGroups(key), fetchMinterGroupAdmins()]);
  const isForumAdmin = groups.some((group) =>
    (ADMIN_GROUP_NAMES as readonly string[]).includes(group.groupName)
  );
  const isMinterAdmin = minterAdmins.some((admin) => admin.member === key && admin.isAdmin);
  return { isForumAdmin, isMinterAdmin, isAdmin: isForumAdmin || isMinterAdmin };
}

export async function verifyAddressIsAdmin(address: string): Promise<boolean> {
  return (await getAdminFlags(address)).isAdmin;
}
