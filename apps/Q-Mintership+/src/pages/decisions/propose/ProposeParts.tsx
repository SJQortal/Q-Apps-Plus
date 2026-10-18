/**
 * The parts of a + Propose page (ProposePage.tsx), as Propose nomination
 * draws its own: the person picked (avatar, name, level, blocks minted,
 * where they stand in MINTER, the full address with Copy, and the same check
 * the write runs before Hub opens), What happens next, the proposal's Hub
 * steps (ProposeSignDialog), and what the page says once it is proposed.
 */
import type { Ref } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Skeleton, Typography } from '@mui/material';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import { FeeNote } from '../../../components/common/FeeNote';
import { AddressText, PersonChip } from '../../../components/common/Person';
import { Card, Section } from '../../../components/common/Section';
import { AdminNoteReview } from '../../../components/decision/AdminNoteField';
import { adminNoteFollowUp } from '../../../components/decision/adminNoteStep';
import { withMarkedName } from '../../../components/common/markedText';
import { effectiveBlocksMinted } from '../../../data/accounts';
import { getMembership } from '../../../data/group';
import { useAccount } from '../../../hooks/useData';
import { useDisplayName } from '../../../hooks/useDisplayName';
import { useQuery } from '../../../hooks/useQuery';
import { KIND_LABEL } from '../../../rules/decision';
import { DECLINE_TITLE } from '../../../rules/decline';
import { personPath } from '../../../routes/paths';
import { formatRelative, plural } from '../../../utils/format';
import { readable } from '../../../utils/readable';
import type { AdminWriter } from '../../../writes/adminNotes';
import type { Signer } from '../../../writes/runner';
import { banLengthText, signingWindowText } from '../decisionUi';
import { decisionsKindPath } from '../decisionsViews';
import { ProposeSignDialog } from '../ProposeSignDialog';
import {
  PROPOSE_KINDS,
  STEP_DOWN_ELSEWHERE,
  type ProposeKind,
  type SubjectCheck,
} from '../proposeKinds';
import type { PickedAccount } from './AccountList';
import type { ProposeContext } from './proposeContext';
import { toProposal } from './proposeForm';
import { blocksMintedText } from './pickRows';
import { KIND_TAB, ONCE_IT_PASSES } from './proposePageWords';

/** The person picked, as Propose nomination shows its candidate, with the check and Change. */
export function PickedSummary({
  kind,
  person,
  check,
  me,
  recentInvite,
  onChange,
  onSwitch,
  cardRef,
}: {
  kind: ProposeKind;
  person: PickedAccount;
  check: SubjectCheck | 'checking' | null;
  me: string;
  /** Cancel an approved invite: when it was approved, if in the last 30 days. */
  recentInvite: number | null;
  onChange: () => void;
  /** A Minter Admin can't be removed or banned directly: Propose removing their admin role. */
  onSwitch: () => void;
  /** The card, which takes focus once someone is picked. */
  cardRef?: Ref<HTMLDivElement>;
}) {
  const account = useAccount(person.address);
  const membership = useQuery(`membership:${person.address}`, (force) =>
    getMembership(person.address, { force })
  );
  const role = membership.data
    ? membership.data.isAdmin
      ? 'Minter Admin'
      : membership.data.isMember
        ? 'In MINTER'
        : 'Not in MINTER'
    : null;
  const stepDown = kind === 'removeAdmin' && person.address === me;
  return (
    <Card
      ref={cardRef}
      tabIndex={-1}
      sx={(theme) => ({
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        outline: 'none',
        '&:focus-visible': { boxShadow: `0 0 0 2px ${theme.palette.primary.main}` },
      })}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <PersonChip
            address={person.address}
            name={person.name}
            size={48}
            secondary={
              account.data ? (
                `Level ${account.data.level} · ${blocksMintedText(effectiveBlocksMinted(account.data))}${role ? ` · ${role}` : ''}`
              ) : account.isError ? null : (
                <Skeleton variant="text" width={220} />
              )
            }
          />
          <AddressText address={person.address} full />
        </Box>
        <Button
          onClick={onChange}
          aria-label="Change: pick someone else"
          sx={{ minHeight: 44, flexShrink: 0 }}
        >
          Change
        </Button>
      </Box>
      {/* There from the start (empty while checking), so the check's answer is read out. */}
      <Box role="status">
        {stepDown ? (
          <StepDownElsewhere address={me} />
        ) : (
          <CheckResult check={check} kind={kind} onSwitch={onSwitch} />
        )}
      </Box>
      {recentInvite ? (
        <Alert severity="info" role="note">
          Approved {formatRelative(recentInvite)}: they may still press Join now.
        </Alert>
      ) : null}
    </Card>
  );
}

function CheckResult({
  check,
  kind,
  onSwitch,
}: {
  check: SubjectCheck | 'checking' | null;
  kind: ProposeKind;
  onSwitch: () => void;
}) {
  if (check === null || check === 'checking') {
    return (
      <Typography variant="body2" color="text.secondary">
        Checking this account on your node…
      </Typography>
    );
  }
  if (check.status === 'ok')
    return (
      <Typography
        variant="body2"
        sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, color: readable('success') }}
      >
        <CheckCircleOutlineOutlinedIcon aria-hidden sx={{ fontSize: 18, mt: '1px' }} />
        <span>Nothing stops this proposal.</span>
      </Typography>
    );
  if (check.status === 'blocked')
    return (
      <Alert severity="warning" role="note">
        {check.reason}
      </Alert>
    );
  return (
    <Alert severity="info" role="note">
      <Typography variant="body2">
        This is a Minter Admin. Core doesn’t let admins be{' '}
        {kind === 'ban' ? 'banned' : 'removed from MINTER'} directly: propose removing their admin
        role first. Once that is approved, you can propose this.
      </Typography>
      <Button variant="outlined" onClick={onSwitch} sx={{ mt: 1, minHeight: 44 }}>
        Propose removing their admin role
      </Button>
    </Alert>
  );
}

/** Yourself under Remove a Minter Admin: Step down is on your own Minter Profile, with what it would change. */
function StepDownElsewhere({ address }: { address: string }) {
  return (
    <Alert severity="info" role="note">
      <Typography variant="body2">That’s you. {STEP_DOWN_ELSEWHERE}</Typography>
      <Button
        component={RouterLink}
        to={personPath(address)}
        variant="outlined"
        sx={{ mt: 1, minHeight: 44 }}
      >
        Open your Minter Profile
      </Button>
    </Alert>
  );
}

/** As Propose nomination's: the Hub steps, the approvals and window, and the fees. */
export function WhatHappensNext({
  kind,
  ctx,
  withNote,
}: {
  kind: ProposeKind;
  ctx: ProposeContext | null;
  /** A note for the Minter Admins is written: one more Hub step. */
  withNote: boolean;
}) {
  const txType = PROPOSE_KINDS[kind].txType;
  const adminChange = kind === 'addAdmin' || kind === 'removeAdmin';
  return (
    <Section title="What happens next" id="next">
      <Card>
        <Box
          component="ol"
          sx={{ m: 0, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}
        >
          <li>
            <Typography variant="body2">
              <strong>You propose it.</strong> Hub step 1 puts the proposal on chain.
            </Typography>
          </li>
          <li>
            <Typography variant="body2">
              <strong>You approve it.</strong> Hub step 2: a proposal doesn’t count as its
              proposer’s approval.
            </Typography>
          </li>
          {withNote ? (
            <li>
              <Typography variant="body2">
                <strong>Your note follows.</strong> Hub step 3, encrypted to the Minter Admins: only
                they can read it.
              </Typography>
            </li>
          ) : null}
          <li>
            <Typography variant="body2">
              <strong>The other Minter Admins approve, reject, or let it run out.</strong>{' '}
              {ctx
                ? `It needs ${plural(ctx.needed, 'approval')} within ${signingWindowText(ctx.maximumBlockDelay, ctx.msPerBlock)}. `
                : ''}
              If as many reject it, or time runs out, it ends.
            </Typography>
          </li>
        </Box>
        <Typography variant="body2" sx={{ mt: 1.5 }}>
          {ONCE_IT_PASSES[kind]}
        </Typography>
        {adminChange ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Every waiting decision is measured against the admin seats, so this can move the target
            for all of them, including ones that already have approvals. Before Hub opens, you see
            what it would change.
          </Typography>
        ) : null}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          <FeeNote txType={txType} times={withNote ? 3 : 2} prefix="Fees in total" />. Nothing else
          is sent or spent.
        </Typography>
      </Card>
    </Section>
  );
}

/** The proposal, your approval and your note: the Hub steps, explained first. */
export function ProposeHubStep({
  open,
  kind,
  person,
  reason,
  banSeconds,
  note,
  writer,
  signer,
  ctx,
  onClose,
  returnFocus,
}: {
  open: boolean;
  kind: ProposeKind;
  person: PickedAccount;
  reason: string;
  banSeconds: number;
  /** The note for the Minter Admins ('' for none). */
  note: string;
  writer: AdminWriter | null;
  signer: Signer;
  ctx: ProposeContext;
  onClose: () => void;
  returnFocus?: () => HTMLElement | null;
}) {
  const who = useDisplayName(person.address, person.name);
  const followUp = adminNoteFollowUp(writer, note);
  return (
    <ProposeSignDialog
      open={open}
      proposal={toProposal(kind, person.address, reason, banSeconds)}
      who={who.label}
      signer={signer}
      facts={ctx}
      title={`${kind === 'decline' ? DECLINE_TITLE : KIND_LABEL[kind]}: ${who.label}`}
      lead={
        kind === 'decline'
          ? 'This proposes declining their join request: once it passes, their request is gone, and they can send a new one later.'
          : undefined
      }
      impact={ctx.projectImpact?.(kind, person.address) ?? null}
      labelOf={ctx.labelOf}
      details={
        kind === 'ban' || reason || followUp ? (
          <>
            {kind === 'ban' ? (
              <Typography>
                <b>Length:</b> {banLengthText(banSeconds)}
                {banSeconds ? ', counted from when it is proposed, not from approval' : ''}
              </Typography>
            ) : null}
            {reason ? (
              <Typography sx={{ overflowWrap: 'anywhere' }}>
                <b>Reason:</b> {reason}
              </Typography>
            ) : null}
            {followUp ? <AdminNoteReview text={note} /> : null}
          </>
        ) : null
      }
      followUp={followUp}
      onClose={onClose}
      onBack={onClose}
      returnFocus={returnFocus}
    />
  );
}

/** Once proposed: what happens now, its tab in Decisions, and Propose another. */
export function ProposedCard({
  kind,
  person,
  ctx,
  titleId,
  onAgain,
}: {
  kind: ProposeKind;
  person: PickedAccount;
  ctx: ProposeContext | null;
  titleId: string;
  onAgain: () => void;
}) {
  const who = useDisplayName(person.address, person.name);
  const title = `${kind === 'decline' ? DECLINE_TITLE : KIND_LABEL[kind]}: ${who.label}`;
  return (
    <Card sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography
        id={titleId}
        tabIndex={-1}
        component="h2"
        sx={{ fontSize: 18, fontWeight: 700, outline: 'none' }}
      >
        Proposed: {withMarkedName(title, who.label)}
      </Typography>
      <Typography variant="body2">
        It shows in Decisions once it is in a block, usually within a couple of minutes.
        {ctx
          ? ` It needs ${plural(ctx.needed, 'approval')} within ${signingWindowText(ctx.maximumBlockDelay, ctx.msPerBlock)}.`
          : ''}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <Button
          component={RouterLink}
          to={decisionsKindPath(KIND_TAB[kind])}
          variant="contained"
          sx={{ minHeight: 44 }}
        >
          Open Decisions
        </Button>
        <Button onClick={onAgain} sx={{ minHeight: 44 }}>
          Propose another
        </Button>
      </Box>
    </Card>
  );
}
