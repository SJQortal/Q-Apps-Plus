/**
 * Who each + Propose page offers to pick from, and in what order, kept out
 * of the component files: MINTER's members as you type (Remove a member, Ban
 * an account, Make a Minter Admin), the Minter Admins by name, the bans in
 * force for Lift a ban, and the stored invites for Cancel an approved invite
 * (unused ones first, the oldest approval first, then those of people
 * already in MINTER).
 */
import { isBanActive } from '../../../data/group';
import { writeKeys, type PendingWrite } from '../../../writes/optimistic';
import type { StaleInviteDetail } from '../../../data/staleInvites';
import type { BanRow, GroupMemberRow, InviteRow } from '../../../data/types';
import { formatCount } from '../../../utils/format';

export type MemberSort = 'name' | 'newest' | 'oldest';

/** The members a page lists: everyone but you; Make a Minter Admin leaves the admins out. */
export function memberCandidates(
  kind: 'kick' | 'ban' | 'addAdmin',
  members: readonly GroupMemberRow[],
  admins: ReadonlySet<string>,
  me: string
): GroupMemberRow[] {
  const seen = new Set<string>();
  return members.filter((m) => {
    if (!m.member || seen.has(m.member) || m.member === me) return false;
    seen.add(m.member);
    return kind !== 'addAdmin' || !admins.has(m.member);
  });
}

/** Names A–Z (those without one after, by address), or by when they joined. */
export function sortMembers(rows: readonly GroupMemberRow[], sort: MemberSort): GroupMemberRow[] {
  const byName = (a: GroupMemberRow, b: GroupMemberRow) => {
    if (a.primaryName && b.primaryName)
      return a.primaryName.localeCompare(b.primaryName, undefined, { sensitivity: 'base' });
    if (a.primaryName) return -1;
    if (b.primaryName) return 1;
    return a.member.localeCompare(b.member);
  };
  const joined = (m: GroupMemberRow) => m.joined ?? 0;
  return [...rows].sort((a, b) =>
    sort === 'newest'
      ? joined(b) - joined(a) || byName(a, b)
      : sort === 'oldest'
        ? joined(a) - joined(b) || byName(a, b)
        : byName(a, b)
  );
}

/** The bans in force, the newest first, each account once. */
export function bansInForce(bans: readonly BanRow[], now = Date.now()): BanRow[] {
  const seen = new Set<string>();
  return [...bans]
    .filter((b) => isBanActive(b, now))
    .sort((a, b) => b.banned - a.banned)
    .filter((b) => (seen.has(b.offender) ? false : (seen.add(b.offender), true)));
}

/** The stored invites: unused ones, the oldest approval first once the dates are in; then members'. */
export function invitesInOrder(
  rows: readonly InviteRow[],
  memberRows: readonly InviteRow[],
  detailOf: (invitee: string) => StaleInviteDetail | undefined
): Array<InviteRow & { member: boolean }> {
  const approvedAt = (invitee: string) => detailOf(invitee)?.approvedAt ?? 0;
  return [
    ...[...rows]
      .sort((a, b) => approvedAt(a.invitee) - approvedAt(b.invitee))
      .map((row) => ({ ...row, member: false })),
    ...memberRows.map((row) => ({ ...row, member: true })),
  ];
}

/** This device has just proposed `kind` about `address`: on its way into a block (not failed). */
export function justProposed(
  writes: Readonly<Record<string, PendingWrite>>,
  kind: string,
  address: string
): boolean {
  const write = writes[writeKeys.propose(kind, address)];
  return Boolean(write && write.status !== 'failed');
}

/** "2,030,334 blocks minted", or "no blocks minted yet", as Requested to join MINTER Group says it. */
export function blocksMintedText(blocks: number): string {
  if (blocks <= 0) return 'no blocks minted yet';
  return `${formatCount(blocks)} ${blocks === 1 ? 'block' : 'blocks'} minted`;
}

/** Suggestions the members' dropdown shows at most. */
export const MEMBER_SUGGESTIONS = 8;

/**
 * The members whose name or address goes with what is typed, for the
 * dropdown of Remove a member, Ban an account and Make a Minter Admin (Simon,
 * 2026-10-18: no list of MINTER's 600+ members, "just the dropdown while
 * typing"): names that start with it first, then names that hold it, then
 * addresses that start with it; at most `limit`.
 */
export function memberSuggestions(
  members: readonly GroupMemberRow[],
  typed: string,
  limit = MEMBER_SUGGESTIONS
): GroupMemberRow[] {
  const q = typed.trim().replace(/^@/, '').toLowerCase();
  if (!q) return [];
  const name = (m: GroupMemberRow) => m.primaryName?.toLowerCase() ?? '';
  const starts = members.filter((m) => name(m).startsWith(q));
  const holds = members.filter((m) => !name(m).startsWith(q) && name(m).includes(q));
  const byAddress = members.filter(
    (m) => !name(m).includes(q) && m.member.toLowerCase().startsWith(q)
  );
  return [...sortMembers(starts, 'name'), ...sortMembers(holds, 'name'), ...byAddress].slice(
    0,
    limit
  );
}
