/**
 * Clean up stale invites (Minter Admins): approved invites nobody used, with
 * who invited and when it was approved, "Propose cancelling" per row, and
 * "Propose for all" one Hub confirmation after another. Invites approved in
 * the last 30 days are marked recent and left out of "for all": those
 * people may still press Join.
 *
 * Core's answers leave the invitee out of pending cancellations, so the
 * screen says how many are already waiting instead of matching them.
 */
import { useState } from 'react';
import { useAtomValue } from 'jotai';
import { Alert, Box, Button, Typography } from '@mui/material';
import { BulkDialog } from './BulkDialog';
import { DoneChip } from '../../components/decision/DecisionParts';
import { cancelAll, isRecentInvite, waitingCancels } from './staleRules';
import { HubStepDialog } from '../../components/common/HubStepDialog';
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
import { useDisplayName } from '../../hooks/useDisplayName';
import { useQuery } from '../../hooks/useQuery';
import type { Decision } from '../../rules/decision';
import { displayName, formatCount, formatDate, formatRelative, plural } from '../../utils/format';
import { proposeCancelInvite } from '../../writes/flows';
import { pendingWritesAtom, usePendingWrite, writeKeys } from '../../writes/optimistic';
import type { Signer } from '../../writes/runner';

export function StaleInvites({
  signer,
  decisions,
  now,
  adminNames,
  expanded,
  onExpandedChange,
}: {
  signer: Signer;
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
  const cancels = waitingCancels(decisions);
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
          ? 'These people were approved but never pressed Join, so their invites stay listed until Minter Admins cancel them. A cancellation goes through the same signatures as any decision.'
          : 'Every approved invite has been used.'}
        {list.data?.alreadyMembers
          ? ` Left out: ${plural(list.data.alreadyMembers, 'invite')} for people already in MINTER.`
          : ''}
      </Typography>
      {cancels ? (
        <Alert severity="info" role="note">
          {cancels === 1
            ? '1 cancellation is already waiting for signatures.'
            : `${cancels} cancellations are already waiting for signatures.`}{' '}
          Core’s answers don’t say whom they are for, so check the queue before proposing the same
          one again.
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

      <SingleCancel row={single} signer={signer} onClose={() => setSingle(null)} />
      <BulkDialog
        open={bulkRows !== null}
        onClose={() => setBulkRows(null)}
        title="Cancel stale invites"
        intro={
          <Typography>
            Proposes cancelling {plural(bulkRows?.length ?? 0, 'approved invite')} not approved in
            the last 30 days, one after another. Each happens only if enough Minter Admins sign it.
          </Typography>
        }
        action="CANCEL_GROUP_INVITE"
        feeTxType="CANCEL_GROUP_INVITE"
        items={(bulkRows ?? []).map((row) => ({ key: row.invitee, label: inviteeLabel(row) }))}
        confirmLabel="Continue to Hub"
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
  onPropose,
}: {
  row: InviteRow;
  detail: StaleInviteDetail | undefined;
  now: ChainNow;
  inviterName: string | null | undefined;
  onPropose: () => void;
}) {
  const pending = usePendingWrite(writeKeys.propose('cancelInvite', row.invitee));
  const inviter = useDisplayName(row.inviter, inviterName);
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
            Approved recently: they may still press Join.
          </Typography>
        ) : null}
      </Box>
      {pending?.status === 'confirming' ? (
        <DoneChip label="Proposed (confirming…)" settled={false} />
      ) : (
        <Button
          variant="outlined"
          onClick={onPropose}
          disabled={pending?.status === 'sending'}
          sx={{ minHeight: 44 }}
          aria-label={`Propose cancelling the invite for ${displayName(null, row.invitee)}`}
        >
          Propose cancelling
        </Button>
      )}
    </Box>
  );
}

function SingleCancel({
  row,
  signer,
  onClose,
}: {
  row: InviteRow | null;
  signer: Signer;
  onClose: () => void;
}) {
  const who = useDisplayName(row?.invitee ?? '', row ? undefined : null);
  return (
    <HubStepDialog
      open={Boolean(row)}
      onClose={onClose}
      title={`Cancel the invite for ${who.label}`}
      intro={
        <Typography>
          This proposes cancelling their approved invite. It happens only if enough Minter Admins
          sign it. Your proposal doesn’t count as your signature: sign it in the queue too.
        </Typography>
      }
      steps={[
        {
          action: 'CANCEL_GROUP_INVITE',
          title: 'Propose it',
          detail: row ? (
            <Typography variant="body2">
              Hub shows the account {row.invitee.slice(0, 6)}… and the group MINTER.
            </Typography>
          ) : null,
          feeTxType: 'CANCEL_GROUP_INVITE',
        },
      ]}
      run={async (report) => {
        if (!row) return { outcome: { status: 'blocked', reason: 'Nothing to cancel.' } };
        return {
          outcome: await proposeCancelInvite(signer, row.invitee, (stage) => report(0, stage)),
        };
      }}
      successTitle="Proposed"
      successText={
        <Typography variant="body2">
          It shows in the queue once it is in a block, usually within a couple of minutes.
        </Typography>
      }
    />
  );
}
