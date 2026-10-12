/**
 * MINTER (group 694): settings, admins, members, join requests, stored
 * invites and bans. Every list is bounded and cached.
 *
 * - Admins come from `onlyAdmins=true`: the paged member list's `isAdmin`
 *   flag is wrong after the first page.
 * - The admin count Core reports includes the null owner; it is the
 *   denominator of the approval threshold.
 * - `/groups/invites/*` lists approved invites that were never used, old
 *   ones included.
 */
import { isApprovalThreshold } from '../rules/threshold';
import { MINTER_GROUP_ID, NULL_OWNER } from './constants';
import { getJson, getPaged, query, seg } from './core';
import { fetchQuery } from './query';
import type {
  BanRow,
  GroupInfo,
  GroupMemberRow,
  GroupMembersPage,
  InviteRow,
  JoinRequestRow,
  MembershipRow,
} from './types';

const G = MINTER_GROUP_ID;

export interface AdminList {
  /** Core's admin count (null owner included): the threshold's denominator. */
  adminCount: number;
  memberCount: number;
  /** Every admin row, null owner included. */
  admins: GroupMemberRow[];
  /** Admins who can actually sign (null owner left out). */
  signers: GroupMemberRow[];
}

export interface MemberList {
  memberCount: number;
  members: GroupMemberRow[];
  truncated: boolean;
}

export interface Membership {
  isMember: boolean;
  isAdmin: boolean;
}

/** `GET /groups/694`. */
export function getGroupInfo(options: { force?: boolean } = {}): Promise<GroupInfo> {
  return fetchQuery(
    'group:info',
    async () => {
      const info = await getJson<GroupInfo>(`/groups/${G}`);
      if (!isApprovalThreshold(info.approvalThreshold)) {
        throw new Error(`Unknown approval threshold ${String(info.approvalThreshold)}`);
      }
      return info;
    },
    { ttlMs: 5 * 60_000, force: options.force }
  );
}

/** `GET /groups/members/694?onlyAdmins=true`, paged (one page today: 20 admins). */
export function getAdmins(options: { force?: boolean } = {}): Promise<AdminList> {
  return fetchQuery(
    'group:admins',
    async () => {
      let adminCount = 0;
      let memberCount = 0;
      const { rows } = await getPaged<GroupMemberRow>(
        (offset, limit) => `/groups/members/${G}?${query({ onlyAdmins: true, limit, offset })}`,
        {
          maxPages: 5,
          pick: (body) => {
            const page = body as GroupMembersPage;
            adminCount = Number(page?.adminCount ?? adminCount);
            memberCount = Number(page?.memberCount ?? memberCount);
            return Array.isArray(page?.members) ? page.members : [];
          },
        }
      );
      const admins = rows.map((row) => ({ ...row, isAdmin: true }));
      return {
        adminCount: adminCount || admins.length,
        memberCount,
        admins,
        signers: admins.filter((row) => row.member !== NULL_OWNER),
      };
    },
    { ttlMs: 2 * 60_000, force: options.force }
  );
}

/**
 * Every member, 100 a page (7 pages today), with `primaryName` and `joined`.
 * Only for the views that need the whole group (Activity, name lookups).
 */
export function getMembers(options: { force?: boolean } = {}): Promise<MemberList> {
  return fetchQuery(
    'group:members',
    async () => {
      let memberCount = 0;
      const { rows, truncated } = await getPaged<GroupMemberRow>(
        (offset, limit) => `/groups/members/${G}?${query({ limit, offset })}`,
        {
          maxPages: 30,
          pick: (body) => {
            const page = body as GroupMembersPage;
            memberCount = Number(page?.memberCount ?? memberCount);
            // `isAdmin` here is unreliable after page one; keep only what is right.
            return Array.isArray(page?.members)
              ? page.members.map((row) => ({
                  member: row.member,
                  joined: row.joined,
                  primaryName: row.primaryName,
                }))
              : [];
          },
        }
      );
      return { memberCount: memberCount || rows.length, members: rows, truncated };
    },
    { ttlMs: 10 * 60_000, force: options.force }
  );
}

/** `GET /groups/member/{address}` reduced to MINTER. */
export function getMembership(
  address: string,
  options: { force?: boolean } = {}
): Promise<Membership> {
  return fetchQuery(
    `membership:${address}`,
    async () => {
      const rows = await getJson<MembershipRow[]>(`/groups/member/${seg(address)}`);
      const row = Array.isArray(rows) ? rows.find((r) => Number(r.groupId) === G) : undefined;
      return { isMember: Boolean(row), isAdmin: Boolean(row?.isAdmin) };
    },
    { ttlMs: 60_000, force: options.force }
  );
}

/** `GET /groups/joinrequests/694` (Core does not page it; 91 rows today). */
export function getJoinRequests(options: { force?: boolean } = {}): Promise<JoinRequestRow[]> {
  return fetchQuery(
    'group:joinrequests',
    async () => {
      const rows = await getJson<JoinRequestRow[]>(`/groups/joinrequests/${G}`);
      return Array.isArray(rows) ? rows.filter((r) => Number(r.groupId) === G) : [];
    },
    { ttlMs: 2 * 60_000, force: options.force }
  );
}

/** `GET /groups/joinrequests/address/{a}` reduced to MINTER. */
export function getJoinRequestFor(
  address: string,
  options: { force?: boolean } = {}
): Promise<JoinRequestRow | null> {
  return fetchQuery(
    `joinrequest:${address}`,
    async () => {
      const rows = await getJson<JoinRequestRow[]>(`/groups/joinrequests/address/${seg(address)}`);
      return (Array.isArray(rows) ? rows : []).find((r) => Number(r.groupId) === G) ?? null;
    },
    { ttlMs: 60_000, force: options.force }
  );
}

/** `GET /groups/invites/group/694`: approved invites never used (old ones included). */
export function getStoredInvites(options: { force?: boolean } = {}): Promise<InviteRow[]> {
  return fetchQuery(
    'group:invites',
    async () => {
      const rows = await getJson<InviteRow[]>(`/groups/invites/group/${G}`);
      return Array.isArray(rows) ? rows.filter((r) => Number(r.groupId) === G) : [];
    },
    { ttlMs: 2 * 60_000, force: options.force }
  );
}

/** `GET /groups/invites/{a}` reduced to MINTER. */
export function getStoredInviteFor(
  address: string,
  options: { force?: boolean } = {}
): Promise<InviteRow | null> {
  return fetchQuery(
    `invite:${address}`,
    async () => {
      const rows = await getJson<InviteRow[]>(`/groups/invites/${seg(address)}`);
      return (Array.isArray(rows) ? rows : []).find((r) => Number(r.groupId) === G) ?? null;
    },
    { ttlMs: 60_000, force: options.force }
  );
}

/** `GET /groups/bans/694` (36 rows today). */
export function getBans(options: { force?: boolean } = {}): Promise<BanRow[]> {
  return fetchQuery(
    'group:bans',
    async () => {
      const rows = await getJson<BanRow[]>(`/groups/bans/${G}`);
      return Array.isArray(rows) ? rows.filter((r) => Number(r.groupId) === G) : [];
    },
    { ttlMs: 5 * 60_000, force: options.force }
  );
}

/** A ban is in force when it has no expiry or the expiry is still ahead. */
export function isBanActive(ban: BanRow, now = Date.now()): boolean {
  return !ban.expiry || ban.expiry > now;
}

export function activeBanFor(bans: BanRow[], address: string, now = Date.now()): BanRow | null {
  return bans.find((ban) => ban.offender === address && isBanActive(ban, now)) ?? null;
}
