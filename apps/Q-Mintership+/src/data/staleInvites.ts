/**
 * Approved MINTER invites nobody used, for the Minter Admins' clean-up:
 * the stored invites (`/groups/invites/group/694`, 8 rows today) whose
 * invitee is not a member, and per row when it was approved.
 *
 * Reads: the stored invites plus the member list (both shared and cached);
 * the approval dates only when the list is opened, one history read per
 * invitee (and one block read for the date, kept for the session).
 */
import { getBlock } from './chain';
import { MINTER_GROUP_ID } from './constants';
import { getMembers, getMembership, getStoredInvites } from './group';
import { mapLimit } from './qdn';
import { fetchQuery } from './query';
import { getAddressHistory } from './txs';
import type { InviteRow, TxRow } from './types';

export interface StaleInviteList {
  /** Stored invites whose invitee is not in MINTER. */
  rows: InviteRow[];
  /** Stored invites left out because the invitee is a member already. */
  alreadyMembers: number;
}

export function loadStaleInvites(options: { force?: boolean } = {}): Promise<StaleInviteList> {
  return fetchQuery(
    'staleinvites:list',
    async () => {
      const [invites, members] = await Promise.all([
        getStoredInvites({ force: options.force }),
        getMembers(),
      ]);
      const memberSet = new Set(members.members.map((m) => m.member));
      let rows = invites.filter((row) => !memberSet.has(row.invitee));
      if (members.truncated) {
        // The member list stopped early: check the remaining rows one by one.
        const checked = await mapLimit(rows, 4, async (row) =>
          (await getMembership(row.invitee)).isMember ? null : row
        );
        rows = checked.filter((row): row is InviteRow => row !== null);
      }
      return { rows, alreadyMembers: invites.length - rows.length };
    },
    { ttlMs: 2 * 60_000, force: options.force }
  );
}

export interface StaleInviteDetail {
  invitee: string;
  /** The approved GROUP_INVITE behind the stored row, from the invitee's history. */
  invite: TxRow | null;
  /** The block it was approved in (its own block for invites from before group approval). */
  approvedHeight: number | null;
  approvedAt: number | null;
}

/** The invite a stored row comes from: the newest approved one, by its inviter when possible. */
export function findApprovedInvite(history: TxRow[], row: InviteRow): TxRow | null {
  const approved = history.filter(
    (tx) =>
      tx.type === 'GROUP_INVITE' &&
      tx.invitee === row.invitee &&
      (tx.groupId === undefined || tx.groupId === MINTER_GROUP_ID) &&
      (tx.approvalStatus === 'APPROVED' || tx.approvalStatus === 'NOT_REQUIRED')
  );
  const byInviter = approved.filter((tx) => tx.creatorAddress === row.inviter);
  const pool = byInviter.length ? byInviter : approved;
  let best: TxRow | null = null;
  for (const tx of pool) if (!best || tx.timestamp > best.timestamp) best = tx;
  return best;
}

function approvalHeightOf(tx: TxRow | null): number | null {
  if (!tx) return null;
  if (typeof tx.approvalHeight === 'number') return tx.approvalHeight;
  return typeof tx.blockHeight === 'number' ? tx.blockHeight : null;
}

/** When each stored invite was approved. A row whose history can't be read has nulls. */
export function loadStaleInviteDetails(
  rows: InviteRow[],
  options: { force?: boolean } = {}
): Promise<StaleInviteDetail[]> {
  return fetchQuery(
    staleDetailsKey(rows),
    () =>
      mapLimit(rows, 3, async (row): Promise<StaleInviteDetail> => {
        try {
          const history = await getAddressHistory(row.invitee, { force: options.force });
          const invite = findApprovedInvite(history.rows, row);
          const approvedHeight = approvalHeightOf(invite);
          const block = approvedHeight ? await getBlock(approvedHeight).catch(() => null) : null;
          return {
            invitee: row.invitee,
            invite,
            approvedHeight,
            approvedAt: block?.timestamp || null,
          };
        } catch {
          return { invitee: row.invitee, invite: null, approvedHeight: null, approvedAt: null };
        }
      }),
    { ttlMs: 10 * 60_000, force: options.force }
  );
}

/** The cache key of loadStaleInviteDetails for these rows. */
export function staleDetailsKey(rows: InviteRow[]): string {
  return `staleinvites:details:${rows
    .map((r) => r.invitee)
    .sort()
    .join(',')}`;
}
