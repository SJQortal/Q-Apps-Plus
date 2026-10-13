/**
 * The signed-in account's own admin-role action, on their Home and their
 * own person page: "Become a Minter Admin" for a MINTER member who isn't
 * one, "Step down as Minter Admin" for an admin. When such a proposal is
 * already waiting (from this app or any other), it says so and links to
 * the decision instead.
 *
 * Reads: MINTER's pending list (one GET, shared with the Decisions queue),
 * plus the group, admins and tip Home already has; for a step-down, the
 * Decisions queue an admin's Home already loads (what it would tip over).
 * The dialog and the write code load the first time it opens.
 */
import { lazy, Suspense, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import { DoneChip } from '../../components/decision/DecisionParts';
import { Card, Section } from '../../components/common/Section';
import { MINTER_GROUP_ID } from '../../data/constants';
import { getPending } from '../../data/txs';
import { useAdmins, useChainNow, useDecisions, useGroupInfo } from '../../hooks/useData';
import { useQuery } from '../../hooks/useQuery';
import { decisionPath } from '../../routes/paths';
import { ADMIN_CHANGE_TITLE, ownAdminRole, type OwnAdminRole } from '../../rules/adminChange';
import { decisionSubject } from '../../rules/decision';
import type { MyStatus } from '../../rules/status';
import { approvalsNeeded } from '../../rules/threshold';
import { plural } from '../../utils/format';
import { useSession } from '../../state/session';
import { usePendingWrite, writeKeys } from '../../writes/optimistic';
import type { AdminRoleDialogProps } from './AdminRoleDialog';

const AdminRoleDialog = lazy(() =>
  import('./AdminRoleDialog').then((m) => ({ default: m.AdminRoleDialog }))
);

/** The dialog, loaded the first time it opens and kept mounted after. */
function LazyAdminRoleDialog(props: AdminRoleDialogProps) {
  const [wanted, setWanted] = useState(props.open);
  if (props.open && !wanted) setWanted(true);
  if (!wanted) return null;
  return (
    <Suspense fallback={null}>
      <AdminRoleDialog {...props} />
    </Suspense>
  );
}

/** MINTER's pending list, the read (and key) the Decisions queue starts from. */
function usePendingAdminChange(address: string, mode: OwnAdminRole | null) {
  const pending = useQuery(mode ? 'pending:694' : null, (force) => getPending({ force }));
  const type = mode === 'become' ? 'ADD_GROUP_ADMIN' : 'REMOVE_GROUP_ADMIN';
  return (
    pending.data?.rows.find(
      (tx) =>
        tx.type === type &&
        decisionSubject(tx) === address &&
        (tx.groupId === undefined || tx.groupId === MINTER_GROUP_ID) &&
        (tx.approvalStatus === undefined || tx.approvalStatus === 'PENDING')
    ) ?? null
  );
}

/** What is waiting: their own proposal, or one another admin made about them. */
function waitingText(mode: OwnAdminRole, own: boolean): string {
  if (mode === 'become')
    return own
      ? 'Your proposal to become a Minter Admin is waiting for the Minter Admins’ signatures.'
      : 'A proposal to make you a Minter Admin is waiting for the Minter Admins’ signatures.';
  return own
    ? 'Your step-down is waiting for the Minter Admins’ signatures.'
    : 'A proposal to remove your Minter Admin role is waiting for the Minter Admins’ signatures.';
}

function aboutText(mode: OwnAdminRole, needed: number | null): string {
  if (mode === 'become')
    return `Minter Admins sign MINTER’s decisions. Any member can propose themselves; the Minter Admins decide${needed !== null ? `, with ${plural(needed, 'signature')}` : ''}.`;
  return `If you’d like to stop signing, you can step down and stay a MINTER member. Like any change to the Minter Admins, it needs ${needed !== null ? plural(needed, 'signature') : 'their signatures'}, yours included.`;
}

export interface AdminRoleActionProps {
  /** The signed-in account's own status. */
  status: MyStatus;
  /** 'section': a titled card (Home); 'inline': the button or the waiting note (a person page). */
  layout?: 'section' | 'inline';
}

export function AdminRoleAction({ status, layout = 'inline' }: AdminRoleActionProps) {
  const session = useSession();
  // Only ever about the signed-in account's own role.
  const signer = session.status === 'ready' && session.address === status.address ? session : null;
  const mode = ownAdminRole(status);
  const waiting = usePendingAdminChange(status.address, mode);
  const kind = mode === 'become' ? 'addAdmin' : 'removeAdmin';
  const sent = usePendingWrite(mode ? writeKeys.propose(kind, status.address) : null);
  const group = useGroupInfo();
  const admins = useAdmins();
  const chain = useChainNow();
  // Stepping down moves the target for every waiting decision: the dialog shows
  // what it would tip over (the queue an admin's Home already loads).
  const stepDown = mode === 'stepDown' && Boolean(signer);
  const queue = useDecisions(stepDown);
  const [open, setOpen] = useState(false);
  if (!mode || !signer) return null;

  const needed =
    group.data && admins.data
      ? approvalsNeeded(group.data.approvalThreshold, admins.data.adminCount)
      : null;
  // Not before the queue is in for a step-down: the dialog would open without it.
  const facts =
    group.data && chain.data && needed !== null && (!stepDown || queue.data)
      ? {
          needed,
          maximumBlockDelay: group.data.maximumBlockDelay,
          msPerBlock: chain.data.msPerBlock,
        }
      : null;

  const action = waiting ? (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
      <Typography variant="body2" role="status" sx={{ flex: '1 1 220px' }}>
        {waitingText(mode, waiting.creatorAddress === status.address)}
      </Typography>
      <Button
        component={RouterLink}
        to={decisionPath(waiting.signature)}
        variant="outlined"
        sx={{ minHeight: 44 }}
      >
        Open the decision
      </Button>
    </Box>
  ) : sent && sent.status !== 'failed' ? (
    <Box role="status">
      <DoneChip
        label={sent.status === 'sending' ? 'Sending…' : 'Proposed ✓ (confirming…)'}
        settled={false}
      />
    </Box>
  ) : (
    <Button
      variant="outlined"
      startIcon={mode === 'become' ? <AdminPanelSettingsOutlinedIcon /> : undefined}
      disabled={!facts}
      onClick={() => setOpen(true)}
      sx={{ minHeight: 44, alignSelf: 'flex-start' }}
    >
      {ADMIN_CHANGE_TITLE[mode]}
    </Button>
  );

  const dialog = facts ? (
    <LazyAdminRoleDialog
      open={open}
      mode={mode}
      signer={signer}
      name={status.name}
      facts={facts}
      queue={stepDown ? (queue.data ?? null) : null}
      onClose={() => setOpen(false)}
    />
  ) : null;

  if (layout === 'inline')
    return (
      <>
        {action}
        {dialog}
      </>
    );
  return (
    <Section
      title={mode === 'become' ? 'Minter Admins' : 'Your Minter Admin role'}
      id="home-admin-role"
    >
      <Card sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <Typography variant="body2" color="text.secondary">
          {aboutText(mode, needed)}
        </Typography>
        {action}
      </Card>
      {dialog}
    </Section>
  );
}
