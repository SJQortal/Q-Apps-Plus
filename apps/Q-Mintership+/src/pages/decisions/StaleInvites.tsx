/**
 * Clean up stale invites (Minter Admins): approved invites nobody used, with
 * who invited and when it was approved, "Propose cancelling" per row (the
 * proposal and the admin's own signature), and "Propose cancelling all" for
 * the older ones, one after another, each with the admin's own signature
 * too (two Hub confirmations each). Invites approved in the last 30 days are
 * marked recent and left out of "all": those people may still press Join
 * now. An invite whose cancellation is already waiting for signatures is
 * marked, and never offered again.
 */
import { useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { Alert, Box, Button, Typography } from '@mui/material';
import { BulkDialog } from './BulkDialog';
import { DoneChip } from '../../components/decision/DecisionParts';
import { signingWindowText } from './decisionUi';
import {
  CANCEL_AND_SIGN_STEPS,
  cancelAll,
  cancelAllSummary,
  isRecentInvite,
  unmatchedCancels,
  waitingCancelInvitees,
} from './staleRules';
import { ProposeSignDialog, type ProposalFacts } from './ProposeSignDialog';
import { PersonChip } from '../../components/common/Person';
import { Card } from '../../components/common/Section';
import { CardSkeleton, ErrorState } from '../../components/common/states';
import type { ChainNow } from '../../data/chain';
import { peekQuery } from '../../data/query';
import {
  loadStaleInviteDetails,
  loadStaleInvites,
  staleDetailsKey,
  type StaleInviteDetail,
} from '../../data/staleInvites';
import type { InviteRow } from '../../data/types';
import { useChangedSinceMount } from '../../hooks/useChangedSinceMount';
import { useDisplayName } from '../../hooks/useDisplayName';
import { useQuery } from '../../hooks/useQuery';
import type { Decision } from '../../rules/decision';
import { displayName, formatCount, formatDate, formatRelative, plural } from '../../utils/format';
import type { Proposal } from '../../writes/flows';
import { pendingWritesAtom, usePendingWrite, writeKeys } from '../../writes/optimistic';
import type { Signer } from '../../writes/runner';

export function StaleInvites({
  signer,
  facts,
  decisions,
  now,
  adminNames,
  expanded,
  onExpandedChange,
}: {
  signer: Signer;
  /** Signatures needed and the window, for the proposal's words. */
  facts: ProposalFacts;
  decisions: Decision[];
  now: ChainNow;
  adminNames: Map<string, string | null>;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}) {
  const list = useQuery('staleinvites:list', (force) => loadStaleInvites({ force }));
  const rows = list.data?.rows ?? [];
  const details = useQuery(expanded && rows.length ? staleDetailsKey(rows) : null, (force) =>
    loadStaleInviteDetails(rows, { force })
  );
  const [single, setSingle] = useState<InviteRow | null>(null);
  // Frozen when the dialog opens: rows proposed during the run must not leave its list.
  const [bulkRows, setBulkRows] = useState<InviteRow[] | null>(null);
  const writes = useAtomValue(pendingWritesAtom);
  const waitingFor = waitingCancelInvitees(decisions);
  const unmatched = unmatchedCancels(decisions);
  const nowMs = now.timestamp;

  const detailOf = (invitee: string) => details.data?.find((d) => d.invitee === invitee);
  const sorted = [...rows].sort(
    (a, b) => (detailOf(a.invitee)?.approvedAt ?? 0) - (detailOf(b.invitee)?.approvedAt ?? 0)
  );
  // Only once the dates are in, so a recent one never slips into "for all".
  const older = details.data
    ? sorted.filter(
        (r) =>
          !isRecentInvite(detailOf(r.invitee), nowMs) &&
          !waitingFor.has(r.invitee) &&
          !writes[writeKeys.propose('cancelInvite', r.invitee)]
      )
    : [];

  if (list.isLoading) return <CardSkeleton lines={2} />;
  if (list.isError && !list.data)
    return (
      <ErrorState
        compact
        title="Couldn’t load the approved invites."
        error={list.error}
        onRetry={list.refetch}
      />
    );

  return (
    <Card sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography sx={{ fontWeight: 700 }}>
        {rows.length ? `${plural(rows.length, 'approved invite')} never used` : 'No stale invites'}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {rows.length
          ? 'These people were approved but never pressed Join, so their invites stay listed until Minter Admins cancel them. A cancellation needs the same approvals as any decision.'
          : 'Every approved invite has been used.'}
        {list.data?.alreadyMembers
          ? ` Left out: ${plural(list.data.alreadyMembers, 'invite')} for people already in MINTER.`
          : ''}
      </Typography>
      {waitingFor.size ? (
        <Typography variant="body2" color="text.secondary">
          {waitingFor.size === 1
            ? '1 of them already has a cancellation waiting for approvals.'
            : `${waitingFor.size} of them already have a cancellation waiting for approvals.`}
        </Typography>
      ) : null}
      {unmatched ? (
        <Alert severity="info" role="note">
          {unmatched === 1
            ? '1 cancellation is waiting whose invitee your node couldn’t show.'
            : `${unmatched} cancellations are waiting whose invitee your node couldn’t show.`}{' '}
          Check the queue before proposing the same one again.
        </Alert>
      ) : null}

      {rows.length ? (
        <Button
          variant="outlined"
          onClick={() => onExpandedChange(!expanded)}
          aria-expanded={expanded}
          aria-controls="stale-invites-list"
          sx={{ minHeight: 44, alignSelf: 'flex-start' }}
        >
          {expanded ? 'Hide the list' : 'Show them'}
        </Button>
      ) : null}

      {expanded && rows.length ? (
        <Box id="stale-invites-list" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {details.isLoading ? <CardSkeleton lines={1} /> : null}
          {details.isError && !details.data ? (
            <ErrorState
              compact
              title="Couldn’t load when they were approved."
              error={details.error}
              onRetry={details.refetch}
            />
          ) : null}
          <Box
            component="ul"
            aria-label="Approved invites never used"
            sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}
          >
            {sorted.map((row) => (
              <StaleRow
                key={row.invitee}
                row={row}
                detail={detailOf(row.invitee)}
                now={now}
                inviterName={adminNames.get(row.inviter)}
                cancelWaiting={waitingFor.has(row.invitee)}
                onPropose={() => setSingle(row)}
              />
            ))}
          </Box>
          {older.length > 1 ? (
            <Button
              variant="outlined"
              onClick={() => setBulkRows(older)}
              sx={{ alignSelf: 'flex-start', minHeight: 44 }}
            >
              Propose cancelling all {older.length} older ones
            </Button>
          ) : null}
        </Box>
      ) : null}

      <SingleCancel row={single} signer={signer} facts={facts} onClose={() => setSingle(null)} />
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
    </Card>
  );
}

function inviteeLabel(row: InviteRow): string {
  return `Invite for ${displayName(peekQuery<string | null>(`name:${row.invitee}`), row.invitee)}`;
}

function StaleRow({
  row,
  detail,
  now,
  inviterName,
  cancelWaiting,
  onPropose,
}: {
  row: InviteRow;
  detail: StaleInviteDetail | undefined;
  now: ChainNow;
  inviterName: string | null | undefined;
  /** A cancellation of this invite is already waiting for signatures. */
  cancelWaiting: boolean;
  onPropose: () => void;
}) {
  const pending = usePendingWrite(writeKeys.propose('cancelInvite', row.invitee));
  // The chip pops in when it takes the button's place, not when the list opens with it.
  const pop = useChangedSinceMount(
    cancelWaiting ? 'waiting' : pending?.status === 'confirming' ? 'confirming' : null
  );
  const inviter = useDisplayName(row.inviter, inviterName);
  // The name the row shows (its avatar chip reads the same), not the bare address.
  const invitee = useDisplayName(row.invitee);
  const recent = isRecentInvite(detail, now.timestamp);
  const when = detail?.approvedAt
    ? `approved ${formatDate(detail.approvedAt)} (${formatRelative(detail.approvedAt, now.timestamp)}${
        detail.approvedHeight ? `, block ${formatCount(detail.approvedHeight)}` : ''
      })`
    : detail
      ? 'approval date not found in their history'
      : null;
  return (
    <Box
      component="li"
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1,
        p: 1.25,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
      }}
    >
      <Box sx={{ flex: '1 1 220px', minWidth: 0 }}>
        <PersonChip
          address={row.invitee}
          size={36}
          secondary={`Invited by ${inviter.label}${when ? `, ${when}` : ''}`}
        />
        {recent ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Approved recently: they may still press Join now.
          </Typography>
        ) : null}
      </Box>
      {cancelWaiting ? (
        <DoneChip label="Cancellation waiting for approvals" settled={false} pop={pop} />
      ) : pending?.status === 'confirming' ? (
        <DoneChip label="Proposed (confirming…)" settled={false} pop={pop} />
      ) : (
        <Button
          variant="outlined"
          onClick={onPropose}
          disabled={pending?.status === 'sending'}
          sx={{ minHeight: 44 }}
          aria-label={`Propose cancelling the invite for ${invitee.label}`}
        >
          Propose cancelling
        </Button>
      )}
    </Box>
  );
}

/** "Propose cancelling" on one row: the proposal and the admin's own signature on it. */
function SingleCancel({
  row,
  signer,
  facts,
  onClose,
}: {
  row: InviteRow | null;
  signer: Signer;
  facts: ProposalFacts;
  onClose: () => void;
}) {
  // The last row stays while the dialog closes, so its words don't change mid-way.
  const [last, setLast] = useState(row);
  if (row && row !== last) setLast(row);
  const shown = row ?? last;
  const who = useDisplayName(shown?.invitee ?? '', shown ? undefined : null);
  const proposal = useMemo<Proposal | null>(
    () => (shown ? { kind: 'cancelInvite', subject: shown.invitee } : null),
    [shown]
  );
  return (
    <ProposeSignDialog
      open={Boolean(row)}
      proposal={proposal}
      who={who.label}
      signer={signer}
      facts={facts}
      title={`Cancel the invite for ${who.label}`}
      lead="This proposes cancelling their approved invite."
      onClose={onClose}
    />
  );
}
