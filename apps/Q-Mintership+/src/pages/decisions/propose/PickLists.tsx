/**
 * Each + Propose page's list to pick from (AccountList.tsx), with its own
 * rows and words (Simon, 2026-10-18: "when clicking lift a ban I would like
 * to have a list of the banned accounts at the bottom too. The same with
 * cancel approved invite and others"; and for removing a Minter Admin "nice
 * avatars, and also already crossed out then Minter Admins whose removal is
 * ongoing"):
 *
 * - MINTER's members (Remove a member, Ban an account, Make a Minter Admin;
 *   the shared member list, which carries names and join dates), sortable;
 *   Ban can look up anyone outside MINTER too (LookUpAnyone).
 * - The Minter Admins who can sign (Remove a Minter Admin).
 * - The bans in force (Lift a ban).
 * - The stored approved invites (Cancel an approved invite): the unused ones
 *   with who invited and when it was approved, then those of people already
 *   in MINTER, and "Propose cancelling all" for the older unused ones, which
 *   was Clean up stale invites at the bottom of Decisions.
 *
 * A row whose proposal already waits is crossed out, with a link to it; one
 * this device has just proposed says so. Nothing is written from here: a
 * pick fills the page's form, and its button opens Hub (the bulk
 * cancellation excepted, which explains itself first, as before).
 */
import { useCallback, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import { Alert, Box, Button, Link, Typography } from '@mui/material';
import { useMembers } from '../../../hooks/useData';
import { useDisplayName } from '../../../hooks/useDisplayName';
import { useQuery } from '../../../hooks/useQuery';
import { getBans } from '../../../data/group';
import { peekQuery } from '../../../data/query';
import {
  loadStaleInviteDetails,
  loadStaleInvites,
  staleDetailsKey,
  type StaleInviteDetail,
} from '../../../data/staleInvites';
import type { GroupMemberRow, InviteRow } from '../../../data/types';
import type { Decision } from '../../../rules/decision';
import { personPath } from '../../../routes/paths';
import {
  displayName,
  formatCount,
  formatDate,
  formatRelative,
  plural,
} from '../../../utils/format';
import { pendingWritesAtom } from '../../../writes/optimistic';
import type { Signer } from '../../../writes/runner';
import { CandidatePicker } from '../../nominations/CandidatePicker';
import { BulkDialog } from '../BulkDialog';
import { signingWindowText } from '../decisionUi';
import type { ProposalFacts } from '../ProposeSignDialog';
import {
  CANCEL_AND_SIGN_STEPS,
  cancelAll,
  cancelAllSummary,
  isRecentInvite,
  unmatchedCancels,
} from '../staleRules';
import { AccountList, type AccountRow, type PickedAccount } from './AccountList';
import {
  MEMBER_SORTS,
  bansInForce,
  invitesInOrder,
  justProposed,
  memberCandidates,
  parseMemberSort,
  sortMembers,
  type MemberSort,
} from './pickRows';
import type { WaitingKind, WaitingProposals } from './proposeContext';

type Pick = (person: PickedAccount) => void;

/** Whether this device has just proposed `kind` about each address (on its way into a block). */
function useJustProposed(kind: WaitingKind) {
  const writes = useAtomValue(pendingWritesAtom);
  return useCallback((address: string) => justProposed(writes, kind, address), [writes, kind]);
}

const MEMBER_WORDS = {
  kick: {
    intro: 'Everyone in MINTER but you. Pick who to propose removing.',
    pick: { label: 'Remove', name: (label: string) => `Remove ${label} from MINTER` },
    waiting: 'A removal is waiting for approvals',
  },
  ban: {
    intro: 'Everyone in MINTER but you. Someone outside MINTER can be looked up below the list.',
    pick: { label: 'Ban', name: (label: string) => `Ban ${label}` },
    waiting: 'A ban is waiting for approvals',
  },
  addAdmin: {
    intro: 'MINTER members who aren’t Minter Admins. Pick who to propose as one.',
    // The visible words are in the accessible name too (axe: label-content-name-mismatch).
    pick: { label: 'Make admin', name: (label: string) => `Make admin: ${label}` },
    waiting: 'Already proposed: waiting for approvals',
  },
} as const;

/** MINTER's members, for Remove a member, Ban an account and Make a Minter Admin. */
export function MemberPicks({
  kind,
  me,
  admins,
  waiting,
  onPick,
}: {
  kind: 'kick' | 'ban' | 'addAdmin';
  me: string;
  /** The Minter Admins: marked here (and left out of Make a Minter Admin). */
  admins: ReadonlySet<string>;
  waiting: WaitingProposals;
  onPick: Pick;
}) {
  const members = useMembers();
  const [sort, setSort] = useState<MemberSort>('name');
  const proposed = useJustProposed(kind);
  const waitingFor = waiting.get(kind);
  const words = MEMBER_WORDS[kind];
  const list = members.data;
  const rows = useMemo<AccountRow[] | undefined>(() => {
    if (!list) return undefined;
    return sortMembers(memberCandidates(kind, list.members, admins, me), sort).map((m) => ({
      address: m.member,
      name: m.primaryName ?? null,
      details: memberDetails(m, admins.has(m.member)),
      waiting: waitingFor?.get(m.member) ?? null,
      proposed: proposed(m.member),
    }));
  }, [list, kind, admins, me, sort, waitingFor, proposed]);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <AccountList
        id={`propose-${kind}-members`}
        title="MINTER members"
        intro={words.intro}
        rows={rows}
        error={members.isError ? members.error : undefined}
        onRetry={() => void members.refetch()}
        searchLabel="Search MINTER members, by name or address"
        sort={{
          value: sort,
          options: MEMBER_SORTS,
          onChange: (key) => setSort(parseMemberSort(key)),
        }}
        empty={{
          title: 'No one to list',
          description: 'There is no one else in MINTER right now.',
        }}
        pick={words.pick}
        waitingText={words.waiting}
        onPick={onPick}
      />
      {list?.truncated ? (
        <Typography variant="body2" color="text.secondary" role="note">
          The member list was too long to read in full, so someone may be missing here: search by
          their name or address instead.
        </Typography>
      ) : null}
      {kind === 'ban' ? <LookUpAnyone onPick={onPick} /> : null}
    </Box>
  );
}

function memberDetails(m: GroupMemberRow, admin: boolean): string | null {
  const since = m.joined ? `in MINTER since ${formatDate(m.joined)}` : null;
  if (admin) return since ? `Minter Admin · ${since}` : 'Minter Admin';
  return since ? `In MINTER since ${formatDate(m.joined as number)}` : null;
}

/** Ban an account: anyone, not only members, found by name (with suggestions) or address. */
function LookUpAnyone({ onPick }: { onPick: Pick }) {
  return (
    <Box
      component="section"
      aria-labelledby="propose-ban-anyone-title"
      sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
    >
      <Typography
        id="propose-ban-anyone-title"
        component="h3"
        sx={{ fontWeight: 700, fontSize: 16 }}
      >
        Someone outside MINTER
      </Typography>
      <Typography variant="body2" color="text.secondary">
        A ban can be for any account: type a registered name, or paste a Qortal address.
      </Typography>
      <CandidatePicker onPick={(p) => onPick({ address: p.address, name: p.name })} />
    </Box>
  );
}

/** The Minter Admins who can sign, for Remove a Minter Admin; you can only step down yourself. */
export function AdminPicks({
  signers,
  me,
  waiting,
  onPick,
}: {
  signers: readonly GroupMemberRow[];
  me: string;
  waiting: WaitingProposals;
  onPick: Pick;
}) {
  const proposed = useJustProposed('removeAdmin');
  const waitingFor = waiting.get('removeAdmin');
  const rows: AccountRow[] = sortMembers(signers, 'name').map((s) => ({
    address: s.member,
    name: s.primaryName ?? null,
    details: s.member === me ? 'You' : null,
    waiting: waitingFor?.get(s.member) ?? null,
    proposed: proposed(s.member),
    blocked:
      s.member === me ? (
        <Link
          component={RouterLink}
          to={personPath(me)}
          variant="body2"
          sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 44 }}
        >
          Step down on your Minter Profile
        </Link>
      ) : null,
  }));
  return (
    <AccountList
      id="propose-removeAdmin-admins"
      title="Minter Admins"
      intro="Pick whose admin role to propose removing; they stay in MINTER. MINTER’s owner account isn’t listed: it can’t be removed."
      rows={rows}
      searchLabel="Search the Minter Admins, by name or address"
      empty={{ title: 'No Minter Admins to list' }}
      pick={{ label: 'Remove', name: (label) => `Remove ${label} as Minter Admin` }}
      waitingText="A removal is waiting for approvals"
      onPick={onPick}
    />
  );
}

/** The bans in force, the newest first, for Lift a ban. */
export function BanPicks({ waiting, onPick }: { waiting: WaitingProposals; onPick: Pick }) {
  const bans = useQuery('group:bans', (force) => getBans({ force }));
  const proposed = useJustProposed('cancelBan');
  const waitingFor = waiting.get('cancelBan');
  const rows = bans.data
    ? bansInForce(bans.data).map<AccountRow>((b) => ({
        address: b.offender,
        details: (
          <>
            Banned {formatRelative(b.banned)}
            {b.expiry ? `, until ${formatDate(b.expiry)}` : ', permanently'}
            {b.reason ? (
              <Box component="span" sx={{ display: 'block', overflowWrap: 'anywhere' }}>
                Reason: “{b.reason}”
              </Box>
            ) : null}
          </>
        ),
        waiting: waitingFor?.get(b.offender) ?? null,
        proposed: proposed(b.offender),
      }))
    : undefined;
  return (
    <AccountList
      id="propose-cancelBan-bans"
      title="Bans in force"
      intro="Pick whose ban to propose lifting: once it is lifted, they can be nominated again."
      rows={rows}
      error={bans.isError ? bans.error : undefined}
      onRetry={() => void bans.refetch()}
      searchLabel="Search the bans in force, by name or address"
      empty={{ title: 'No bans are in force right now' }}
      pick={{ label: 'Lift', name: (label) => `Lift ${label}’s ban` }}
      waitingText="Lifting it is waiting for approvals"
      onPick={onPick}
      readNames
    />
  );
}

/**
 * The stored approved invites, for Cancel an approved invite: unused ones
 * first (with who invited and when it was approved; an invite approved in
 * the last 30 days is marked, as they may still press Join now), then those
 * of people already in MINTER; and "Propose cancelling all" for the older
 * unused ones, one after another, each with your approval (two Hub steps
 * each), as Clean up stale invites did.
 */
export function InvitePicks({
  signer,
  facts,
  decisions,
  adminNames,
  waiting,
  onPick,
}: {
  signer: Signer;
  facts: ProposalFacts;
  decisions: readonly Decision[];
  /** The Minter Admins' names, for who invited. */
  adminNames: ReadonlyMap<string, string | null>;
  waiting: WaitingProposals;
  onPick: Pick;
}) {
  const list = useQuery('staleinvites:list', (force) => loadStaleInvites({ force }));
  const unused = list.data?.rows;
  const details = useQuery(unused?.length ? staleDetailsKey(unused) : null, (force) =>
    loadStaleInviteDetails(unused ?? [], { force })
  );
  const proposed = useJustProposed('cancelInvite');
  const waitingFor = waiting.get('cancelInvite');
  // Frozen when the dialog opens: rows proposed during the run must not leave its list.
  const [bulkRows, setBulkRows] = useState<InviteRow[] | null>(null);
  const now = Date.now();
  const detailOf = (invitee: string) => details.data?.find((d) => d.invitee === invitee);
  const ordered = list.data ? invitesInOrder(list.data.rows, list.data.memberRows, detailOf) : null;
  const rows = ordered?.map<AccountRow>((row) => ({
    address: row.invitee,
    details: (
      <InviteDetails
        row={row}
        detail={row.member ? undefined : detailOf(row.invitee)}
        member={row.member}
        inviterName={adminNames.get(row.inviter)}
        now={now}
      />
    ),
    waiting: waitingFor?.get(row.invitee) ?? null,
    proposed: proposed(row.invitee),
  }));
  // Only once the dates are in, so a recent one never slips into "all".
  const older =
    details.data && unused
      ? [...unused]
          .sort(
            (a, b) =>
              (detailOf(a.invitee)?.approvedAt ?? 0) - (detailOf(b.invitee)?.approvedAt ?? 0)
          )
          .filter(
            (r) =>
              !isRecentInvite(detailOf(r.invitee), now) &&
              !waitingFor?.has(r.invitee) &&
              !proposed(r.invitee)
          )
      : [];
  const unmatched = unmatchedCancels([...decisions]);

  return (
    <>
      <AccountList
        id="propose-cancelInvite-invites"
        title="Approved invites"
        intro={
          <>
            Unused invites first, the oldest approval first: these people were approved but never
            pressed Join, so their invites stay listed until Minter Admins cancel them. Then the
            invites of people already in MINTER.
            {unmatched ? (
              <Box component="span" sx={{ display: 'block', mt: 1 }}>
                {unmatched === 1
                  ? '1 cancellation is waiting whose invitee your node couldn’t show.'
                  : `${unmatched} cancellations are waiting whose invitee your node couldn’t show.`}{' '}
                Check the queue before proposing the same one again.
              </Box>
            ) : null}
          </>
        }
        rows={rows}
        error={list.isError ? list.error : undefined}
        onRetry={() => void list.refetch()}
        searchLabel="Search the approved invites, by name or address"
        empty={{
          title: 'There are no approved invites stored right now',
          description: 'Every approved invite has been used.',
        }}
        pick={{ label: 'Cancel invite', name: (label) => `Cancel invite for ${label}` }}
        waitingText="A cancellation is waiting for approvals"
        onPick={onPick}
        readNames
        actions={
          <>
            {details.isError && !details.data ? (
              <Alert severity="info" role="note">
                Couldn’t read when they were approved just now, so the oldest can’t be told apart.{' '}
                <Button size="small" onClick={() => void details.refetch()} sx={{ minHeight: 44 }}>
                  Try again
                </Button>
              </Alert>
            ) : null}
            {older.length > 1 ? (
              <Button
                variant="outlined"
                onClick={() => setBulkRows(older)}
                sx={{ alignSelf: 'flex-start', minHeight: 44 }}
              >
                Propose cancelling all {older.length} older ones
              </Button>
            ) : null}
          </>
        }
      />
      <BulkDialog
        open={bulkRows !== null}
        onClose={() => setBulkRows(null)}
        title="Cancel stale invites"
        intro={
          <>
            <Typography>
              Proposes cancelling {plural(bulkRows?.length ?? 0, 'approved invite')} not approved in
              the last 30 days, one after another. Each happens only if {facts.needed} Minter Admins
              approve it within {signingWindowText(facts.maximumBlockDelay, facts.msPerBlock)}.
            </Typography>
            <Typography sx={{ mt: 1 }}>
              A proposal doesn’t count as your approval, so you approve each one straight after it,
              as for a single proposal.
            </Typography>
          </>
        }
        steps={CANCEL_AND_SIGN_STEPS}
        feeTxType="CANCEL_GROUP_INVITE"
        items={(bulkRows ?? []).map((row) => ({ key: row.invitee, label: inviteeLabel(row) }))}
        confirmLabel="Continue to Hub"
        sentLabel="Proposed and approved ✓"
        summarize={cancelAllSummary}
        run={(report) => cancelAll(signer, bulkRows ?? [], report)}
      />
    </>
  );
}

function inviteeLabel(row: InviteRow): string {
  return `Invite for ${displayName(peekQuery<string | null>(`name:${row.invitee}`), row.invitee)}`;
}

/** Who invited, and when it was approved (or that they are a member already). */
function InviteDetails({
  row,
  detail,
  member,
  inviterName,
  now,
}: {
  row: InviteRow;
  detail: StaleInviteDetail | undefined;
  member: boolean;
  inviterName: string | null | undefined;
  now: number;
}) {
  const inviter = useDisplayName(row.inviter, inviterName);
  const when = detail?.approvedAt
    ? `approved ${formatDate(detail.approvedAt)} (${formatRelative(detail.approvedAt, now)}${
        detail.approvedHeight ? `, block ${formatCount(detail.approvedHeight)}` : ''
      })`
    : detail
      ? 'approval date not found in their history'
      : null;
  return (
    <>
      Invited by {inviter.label}
      {member ? ' · already a member' : when ? `, ${when}` : ''}
      {!member && isRecentInvite(detail, now) ? (
        <Box component="span" sx={{ display: 'block' }}>
          Approved recently: they may still press Join now.
        </Box>
      ) : null}
    </>
  );
}
