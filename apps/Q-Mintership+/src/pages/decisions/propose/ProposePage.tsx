/**
 * + Propose → Remove a member, Decline a join request, Ban an account, Make a
 * Minter Admin, Remove a Minter Admin, Lift a ban, Cancel an approved
 * invite: a page each, in the style of Propose nomination (Simon,
 * 2026-10-18: "Make all of these "+ Propose" windows in the style of the
 * "+ Propose" Nomination as they are all different on mobile view"), at
 * `/propose/<kind>` (routes/paths.ts → proposePath; `?who=<address>` starts
 * with someone, as Propose removing their admin role does), Minter Admins
 * only:
 *
 * 1. Who: the kind's list to pick from (PickLists.tsx; Requested to join
 *    MINTER Group for a decline), or for MINTER's members a dropdown while
 *    typing (MemberSearch.tsx), then the person picked, with their level,
 *    blocks minted and place in MINTER and the same check the write runs
 *    before Hub opens (proposeKinds.ts → checkSubject); Change goes back.
 * 2. Why (a removal, a ban, a decline): the reason everyone sees; How long
 *    (a ban).
 * 3. For the Minter Admins (optional): a note encrypted to them, one more
 *    Hub step once the proposal is in.
 * 4. What happens next: the Hub steps and their fees, the approvals needed
 *    and the window.
 * 5. The submit bar, as Propose nomination's: what's missing, or the button
 *    that opens the proposal's Hub steps (ProposeSignDialog: the proposal,
 *    the proposer's own approval, and the note); an admin change first says
 *    what it would do to every waiting decision's target.
 *
 * Once proposed, the page says what happens now, with its tab in Decisions
 * and Propose another. Reads: the Decisions queue, the member list and the
 * nominations Decisions shares; the list's own reads (PickLists.tsx); the
 * person's account and membership; the check, fresh, once someone is picked.
 */
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Link as RouterLink,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  Box,
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { Card, Section } from '../../../components/common/Section';
import { EmptyState, ErrorState, HeroSkeleton } from '../../../components/common/states';
import { AdminNoteField } from '../../../components/decision/AdminNoteField';
import { BOTTOM_NAV_HEIGHT } from '../../../components/layout/BottomNav';
import { PageBody } from '../../../components/layout/PageBody';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useBottomNavShown } from '../../../components/layout/useBottomNav';
import { isAddress } from '../../../data/accounts';
import { normaliseNoteText } from '../../../data/adminNoteRecords';
import { getStoredInvites } from '../../../data/group';
import { loadStaleInviteDetails, staleDetailsKey } from '../../../data/staleInvites';
import { headerFill } from '../../../hub-theme';
import { useDecisions, useMembers, useMyStatus, useNominations } from '../../../hooks/useData';
import { useDisplayName } from '../../../hooks/useDisplayName';
import { BOTTOM_BAR_VAR, usePublishOverlay } from '../../../hooks/useOverlayPadding';
import { usePhoneLayout } from '../../../hooks/usePhoneLayout';
import { useQuery } from '../../../hooks/useQuery';
import { appParam } from '../../../routes/hubLocation';
import { PATHS, proposeKindOf, proposePath } from '../../../routes/paths';
import { signIn, useSession } from '../../../state/session';
import { focusElement } from '../../../utils/focus';
import { formatDuration } from '../../../utils/format';
import { useLandscapeFrame } from '../../../utils/hubFrame';
import { usePendingWrite, writeKeys } from '../../../writes/optimistic';
import type { Signer } from '../../../writes/runner';
import {
  BAN_MAX_DAYS,
  REASON_MAX_BYTES,
  banLengthText,
  parseBanDays,
  reasonProblem,
  utf8Length,
} from '../decisionUi';
import { decisionsViewPath } from '../decisionsViews';
import { JoinRequestPicker } from '../JoinRequestPicker';
import {
  PROPOSE_KINDS,
  checkSubject,
  proposalKindOf,
  type ProposeKind,
  type SubjectCheck,
} from '../proposeKinds';
import { isRecentInvite } from '../staleRules';
import type { PickedAccount } from './AccountList';
import { MemberSearch } from './MemberSearch';
import { AdminPicks, BanPicks, InvitePicks } from './PickLists';
import { PickedSummary, ProposeHubStep, ProposedCard, WhatHappensNext } from './ProposeParts';
import { useProposeContext } from './proposeContext';
import { PICK_FIRST, PROPOSE_SUBTITLE, SUBMIT_LABEL } from './proposePageWords';
import { APP_NAME } from '../../../constants/plus';

export default function ProposePage() {
  const { kind: slug } = useParams();
  const kind = proposeKindOf(slug);
  const session = useSession();
  const { status, isError, error, refetch } = useMyStatus();
  if (!kind) return <Navigate to={PATHS.decisions} replace />;
  const info = PROPOSE_KINDS[kind];

  let body: ReactNode;
  if (session.status === 'outside') {
    body = (
      <EmptyState
        title={`Open ${APP_NAME} in Qortal Hub or GO`}
        description="A proposal is signed in Hub, so it needs Hub."
      />
    );
  } else if (session.status === 'signedOut' || session.status === 'error') {
    body = (
      <EmptyState
        title="Sign in to propose"
        description="Minter Admins propose these, and approve them."
        actionLabel="Sign in"
        onAction={() => void signIn()}
      />
    );
  } else if (!status && isError) {
    body = (
      <ErrorState
        title="Couldn’t check your account."
        error={error}
        onRetry={() => void refetch()}
      />
    );
  } else if (!status || session.status !== 'ready') {
    body = <HeroSkeleton />;
  } else if (!status.isAdmin) {
    body = <NotAdmin />;
  } else {
    body = (
      <ProposeForm
        // Another kind (Propose removing their admin role) starts a fresh form.
        key={kind}
        kind={kind}
        me={session.address}
        publicKey={session.publicKey}
        myName={status.name ?? session.name ?? null}
      />
    );
  }

  return (
    <>
      <PageHeader
        title={info.label}
        subtitle={PROPOSE_SUBTITLE[kind]}
        back={decisionsViewPath('decisions')}
      />
      <PageBody $form>{body}</PageBody>
    </>
  );
}

function NotAdmin() {
  return (
    <Card sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography component="h2" sx={{ fontSize: 18, fontWeight: 700 }}>
        Only Minter Admins propose this
      </Typography>
      <Typography>
        Minter Admins propose changes to MINTER, and approve or reject them. Everyone can follow
        them in Decisions.
      </Typography>
      <Box>
        <Button
          component={RouterLink}
          to={decisionsViewPath('decisions')}
          variant="outlined"
          sx={{ minHeight: 44 }}
        >
          Open Decisions
        </Button>
      </Box>
    </Card>
  );
}

function ProposeForm({
  kind,
  me,
  publicKey,
  myName,
}: {
  kind: ProposeKind;
  me: string;
  publicKey: string;
  myName: string | null;
}) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const who = appParam(params, 'who');
  const [person, setPerson] = useState<PickedAccount | null>(() =>
    who && isAddress(who) ? { address: who } : null
  );
  // Follow ?who= when another screen links here while this one is open.
  const [seenWho, setSeenWho] = useState(who);
  if (who !== seenWho) {
    setSeenWho(who);
    if (who && isAddress(who) && who !== person?.address) setPerson({ address: who });
  }
  const [check, setCheck] = useState<SubjectCheck | 'checking' | null>(null);
  const [reason, setReason] = useState('');
  const [banMode, setBanMode] = useState<'permanent' | 'days'>('permanent');
  const [days, setDays] = useState('7');
  const [note, setNote] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [proposed, setProposed] = useState<PickedAccount | null>(null);
  const openedAt = useRef(0);
  const doneTitleId = useId();
  const whoId = useId();
  const reasonRef = useRef<HTMLInputElement | null>(null);
  const daysRef = useRef<HTMLInputElement | null>(null);
  const submitRef = useRef<HTMLButtonElement | null>(null);
  // Picking someone replaces the list with their card, and Change the other way round:
  // focus follows, so it never falls to the page.
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const focusNext = useRef<'summary' | 'list' | 'done' | null>(null);
  useEffect(() => {
    const next = focusNext.current;
    focusNext.current = null;
    if (next === 'summary' && summaryRef.current) focusElement(summaryRef.current);
    else if (next === 'list')
      document.getElementById(whoId)?.querySelector<HTMLElement>('input, button')?.focus();
    else if (next === 'done') document.getElementById(doneTitleId)?.focus();
  }, [person, proposed, whoId, doneTitleId]);

  const signer: Signer = useMemo(() => ({ address: me, publicKey }), [me, publicKey]);
  const queue = useDecisions();
  // The queue gives the approvals needed and who already has a proposal waiting.
  const queueFailed = !queue.data && queue.isError;
  const members = useMembers();
  const nominations = useNominations();
  const { ctx, waiting } = useProposeContext(
    queue.data,
    members.data,
    nominations.data?.all,
    // An admin change lists the decisions it would tip over: their names are read.
    kind === 'addAdmin' || kind === 'removeAdmin'
  );
  const adminList = queue.data?.admins.admins;
  const admins = useMemo(() => new Set((adminList ?? []).map((a) => a.member)), [adminList]);
  const adminNames = useMemo(
    () => new Map((adminList ?? []).map((a) => [a.member, a.primaryName ?? null])),
    [adminList]
  );
  // A person from a link comes without a name: looked up (cached) to show it.
  const shownName = useDisplayName(person?.address ?? me, person ? person.name : null).label;
  const pending = usePendingWrite(
    person ? writeKeys.propose(proposalKindOf(kind), person.address) : null
  );

  // An invite approved in the last 30 days: they may still press Join now.
  const invites = useQuery(kind === 'cancelInvite' && person ? 'group:invites' : null, (force) =>
    getStoredInvites({ force })
  );
  const inviteRow = invites.data?.filter((r) => r.invitee === person?.address) ?? [];
  const inviteDetail = useQuery(inviteRow.length ? staleDetailsKey(inviteRow) : null, (force) =>
    loadStaleInviteDetails(inviteRow, { force })
  );
  const detail = inviteDetail.data?.[0];
  const recentInvite =
    detail && isRecentInvite(detail, Date.now()) ? (detail.approvedAt ?? null) : null;

  // The write's own check whenever the person changes (`signer` is stable per account).
  useEffect(() => {
    if (!person) return;
    // Yourself under Remove a Minter Admin: nothing to check, it points to your own page.
    if (kind === 'removeAdmin' && person.address === signer.address) return;
    let live = true;
    setCheck('checking');
    checkSubject(kind, signer, person.address)
      .then((result) => live && setCheck(result))
      .catch(
        () =>
          live &&
          setCheck({
            status: 'blocked',
            reason: 'Couldn’t check this account on your node. Try again in a moment.',
          })
      );
    return () => {
      live = false;
    };
  }, [kind, signer, person]);

  const choose = (next: PickedAccount | null) => {
    setPerson(next);
    setCheck(null);
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        if (next) out.set('who', next.address);
        else out.delete('who');
        return out;
      },
      { replace: true }
    );
  };

  const needsReason = kind === 'kick' || kind === 'ban' || kind === 'decline';
  const reasonError = needsReason ? reasonProblem(reason) : null;
  const ban = kind === 'ban' && banMode === 'days' ? parseBanDays(days) : { seconds: 0 };
  const banError = 'error' in ban ? ban.error : null;
  const stepDown = kind === 'removeAdmin' && person?.address === me;
  const writer = myName ? { ...signer, name: myName } : null;
  // A note for the Minter Admins goes as one more Hub step (adminNoteFollowUp).
  const withNote = Boolean(writer && normaliseNoteText(note));
  const checked = check !== null && check !== 'checking' ? check : null;

  let hint: string;
  if (!person) hint = PICK_FIRST[kind];
  else if (stepDown) hint = 'That’s you: step down on your own Minter Profile instead.';
  else if (!checked) hint = `Checking ${shownName}…`;
  else if (checked.status === 'admin') hint = 'Propose removing their admin role first.';
  else if (checked.status === 'blocked') hint = 'This can’t be proposed now: see why above.';
  else if (reasonError) hint = reasonError;
  else if (banError) hint = banError;
  else if (!ctx) hint = queueFailed ? 'Couldn’t read the decisions.' : 'Reading the decisions…';
  else hint = 'Ready to propose.';
  const ready = Boolean(
    person && !stepDown && checked?.status === 'ok' && !reasonError && !banError && ctx
  );

  const submit = () => {
    setAttempted(true);
    if (ready) {
      openedAt.current = Date.now();
      setDialogOpen(true);
      return;
    }
    if (!person) document.getElementById(whoId)?.querySelector<HTMLElement>('input')?.focus();
    else if (checked?.status !== 'ok' || stepDown) {
      if (summaryRef.current) focusElement(summaryRef.current);
    } else if (reasonError) reasonRef.current?.focus();
    else if (banError) daysRef.current?.focus();
  };

  const restart = () => {
    focusNext.current = 'list';
    setProposed(null);
    setReason('');
    setBanMode('permanent');
    setDays('7');
    setNote('');
    setAttempted(false);
    choose(null);
  };

  const phone = usePhoneLayout();
  const landscape = useLandscapeFrame();
  const navShown = useBottomNavShown();
  // The sticky submit bar's height is kept clear for focus (not in landscape, where it isn't sticky).
  const [submitBar, setSubmitBar] = useState<HTMLElement | null>(null);
  usePublishOverlay(submitBar, BOTTOM_BAR_VAR, { enabled: !landscape && !proposed });

  if (proposed) {
    return (
      <ProposedCard
        kind={kind}
        person={proposed}
        ctx={ctx}
        titleId={doneTitleId}
        onAgain={restart}
      />
    );
  }

  const pick = (next: PickedAccount) => {
    focusNext.current = 'summary';
    choose(next);
  };
  let list: ReactNode;
  switch (kind) {
    case 'decline':
      list = <JoinRequestPicker me={me} onPick={pick} />;
      break;
    case 'kick':
    case 'ban':
    case 'addAdmin':
      // MINTER has 600+ members: a dropdown while typing, not a list (Simon, 2026-10-18).
      list = <MemberSearch kind={kind} me={me} admins={admins} waiting={waiting} onPick={pick} />;
      break;
    case 'removeAdmin':
      list = <AdminPicks signers={ctx?.signers ?? []} me={me} waiting={waiting} onPick={pick} />;
      break;
    case 'cancelBan':
      list = <BanPicks waiting={waiting} onPick={pick} />;
      break;
    case 'cancelInvite':
      list = ctx ? (
        <InvitePicks
          signer={signer}
          facts={ctx}
          decisions={queue.data?.decisions ?? []}
          adminNames={adminNames}
          waiting={waiting}
          onPick={pick}
        />
      ) : queueFailed ? null : (
        <HeroSkeleton />
      );
      break;
  }

  const approvalText = ctx
    ? `about ${formatDuration(ctx.maximumBlockDelay * ctx.msPerBlock, { precise: true })}`
    : 'the approval window';
  const label = SUBMIT_LABEL[kind];

  return (
    <>
      <Section title="Who" id="who">
        <Box id={whoId} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
          {person ? (
            <PickedSummary
              kind={kind}
              person={person}
              check={check}
              me={me}
              recentInvite={recentInvite}
              onChange={() => {
                focusNext.current = 'list';
                // Leaving the reason for the list isn't a missing reason.
                setAttempted(false);
                choose(null);
              }}
              onSwitch={() => navigate(proposePath('removeAdmin', person.address))}
              cardRef={summaryRef}
            />
          ) : (
            list
          )}
        </Box>
      </Section>

      {person && !stepDown && needsReason ? (
        <Section title="Why" id="why">
          <TextField
            label="Reason"
            required
            inputRef={reasonRef}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            error={attempted && Boolean(reasonError)}
            helperText={
              attempted && reasonError
                ? reasonError
                : `${kind === 'decline' ? 'Shown to everyone, the account included.' : 'The other Minter Admins and the account see it.'} ${utf8Length(reason.trim())} of ${REASON_MAX_BYTES} bytes.`
            }
            multiline
            minRows={2}
            fullWidth
          />
        </Section>
      ) : null}

      {person && kind === 'ban' ? (
        <Section title="How long" id="how-long">
          <Card>
            <RadioGroup
              aria-label="How long the ban lasts"
              value={banMode}
              onChange={(e) => setBanMode(e.target.value as 'permanent' | 'days')}
            >
              <FormControlLabel
                value="permanent"
                control={<Radio />}
                label="Permanent (until Minter Admins lift it)"
                sx={{ minHeight: 44 }}
              />
              <FormControlLabel
                value="days"
                control={<Radio />}
                label={`A number of days (up to ${BAN_MAX_DAYS})`}
                sx={{ minHeight: 44 }}
              />
            </RadioGroup>
            {banMode === 'days' ? (
              <TextField
                label="Days"
                required
                inputRef={daysRef}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                error={Boolean(banError)}
                helperText={
                  banError ??
                  `${banLengthText('seconds' in ban ? ban.seconds : 0)}, counted from when it is proposed, not from approval (which can take up to ${approvalText}).`
                }
                slotProps={{ htmlInput: { inputMode: 'numeric', pattern: '[0-9]*' } }}
                sx={{ mt: 1, maxWidth: 200 }}
              />
            ) : null}
          </Card>
        </Section>
      ) : null}

      {person && !stepDown ? (
        <Section title="For the Minter Admins (optional)" id="admin-note">
          <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
            Anything only the Minter Admins should read: it is encrypted to them, and shows under
            your reason for them alone.
          </Typography>
          <AdminNoteField
            value={note}
            onChange={setNote}
            name={myName}
            admins={ctx?.signers.length ?? 0}
          />
        </Section>
      ) : null}

      {queueFailed ? (
        <ErrorState
          title="Couldn’t read the decisions on your node."
          error={queue.error}
          onRetry={() => void queue.refetch()}
        />
      ) : null}
      <WhatHappensNext kind={kind} ctx={ctx} withNote={withNote} />

      <Box
        ref={setSubmitBar}
        sx={{
          position: landscape ? 'static' : 'sticky',
          bottom: navShown ? `calc(${BOTTOM_NAV_HEIGHT}px + var(--qp-safe-bottom))` : 0,
          zIndex: 2,
          mx: { xs: -1.5, sm: -2 },
          px: { xs: 1.5, sm: 2 },
          py: { xs: 1, sm: 1.5 },
          bgcolor: (theme) => headerFill(theme),
          backdropFilter: 'blur(12px)',
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
          <Typography
            variant="body2"
            role="status"
            color={attempted && !ready ? 'error' : 'text.secondary'}
          >
            {/* Changes on a failed press, so it is announced, not only recoloured. */}
            {attempted && !ready ? `Can’t propose yet: ${hint}` : hint}
          </Typography>
        </Box>
        <Button
          ref={submitRef}
          variant="contained"
          size="large"
          onClick={submit}
          disabled={Boolean(person && !checked && !stepDown)}
          sx={{ minHeight: 48, flexShrink: 0, maxWidth: '60%' }}
        >
          <Box
            component="span"
            sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {person && !phone ? label.named(shownName) : label.short}
          </Box>
        </Button>
      </Box>

      {person && ctx ? (
        <ProposeHubStep
          open={dialogOpen}
          kind={kind}
          person={person}
          reason={needsReason ? reason.trim() : ''}
          banSeconds={'seconds' in ban ? ban.seconds : 0}
          note={writer ? note : ''}
          writer={writer}
          signer={signer}
          ctx={ctx}
          onClose={() => {
            setDialogOpen(false);
            // Proposed (and on its way into a block): the page says what happens now.
            if (pending && pending.status !== 'failed' && pending.at >= openedAt.current) {
              focusNext.current = 'done';
              setProposed(person);
            }
          }}
          returnFocus={() => document.getElementById(doneTitleId) ?? submitRef.current}
        />
      ) : null}
    </>
  );
}
