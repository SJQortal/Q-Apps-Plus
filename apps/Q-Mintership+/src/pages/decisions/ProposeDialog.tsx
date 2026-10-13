/**
 * Propose a kick, ban, admin change, lifted ban or cancelled invite: pick
 * the person (by name or address, or from the admins, bans in force or
 * stored approved invites: the unused ones with when each was approved,
 * then those of people already a member), see the same check
 * the write will run, then the proposal and the admin's own signature on it
 * as one explained step of two Hub confirmations. Kicking or banning a
 * Minter Admin is offered as "remove their admin role first", because Core
 * refuses it otherwise. An invite approved in the last 30 days says they
 * may still press Join now. An admin change says, before Hub opens, what it
 * would do to the target of every waiting decision.
 */
import { useEffect, useId, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { PersonChip } from '../../components/common/Person';
import { ResponsiveDialog } from '../../components/common/ResponsiveDialog';
import { CardSkeleton, ErrorState } from '../../components/common/states';
import { getBans, isBanActive } from '../../data/group';
import { loadStaleInviteDetails, loadStaleInvites, staleDetailsKey } from '../../data/staleInvites';
import type { GroupMemberRow } from '../../data/types';
import { useQuery } from '../../hooks/useQuery';
import { useDisplayName } from '../../hooks/useDisplayName';
import { ADMIN_CHANGE_TITLE, OWN_ADMIN_ROLE_LEAD } from '../../rules/adminChange';
import { KIND_LABEL } from '../../rules/decision';
import { displayName, formatDuration, formatRelative } from '../../utils/format';
import type { Proposal } from '../../writes/flows';
import type { Signer } from '../../writes/runner';
import {
  BAN_MAX_DAYS,
  REASON_MAX_BYTES,
  banLengthText,
  parseBanDays,
  reasonProblem,
  utf8Length,
} from './decisionUi';
import {
  PROPOSE_KINDS,
  checkSubject,
  resolvePerson,
  type ProposeKind,
  type SubjectCheck,
} from './proposeKinds';
import { ProposeSignDialog, type ProposalFacts } from './ProposeSignDialog';
import { isRecentInvite } from './staleRules';
import type { ShiftScenario } from '../../rules/targetShift';
import type { LabelOf } from './targetShiftUi';

export interface ProposeContext extends ProposalFacts {
  totalAdmins: number;
  /** Admins who can sign (the null owner left out). */
  signers: GroupMemberRow[];
  /** What an admin change about `subject` would do to the target (null for other kinds). */
  projectImpact?: (kind: ProposeKind, subject: string) => ShiftScenario | null;
  /** Decisions' labels by signature, for that impact. */
  labelOf?: LabelOf;
}

export interface ProposeDialogProps {
  kind: ProposeKind | null;
  signer: Signer | null;
  ctx: ProposeContext;
  /** Start with this person picked (e.g. after "remove their admin role first"). */
  preset?: { address: string; name?: string | null } | null;
  onClose: () => void;
  /** Switch to another kind for the same person. */
  onSwitch: (kind: ProposeKind, person: { address: string; name?: string | null }) => void;
}

type Person = { address: string; name?: string | null };

/**
 * Stored approved invites: the unused ones with when each was approved (the
 * same reads and cache as Clean up stale invites), then those of people
 * already in MINTER. Made only for "Cancel an approved invite".
 */
function useUnusedInvites(enabled: boolean) {
  const list = useQuery(enabled ? 'staleinvites:list' : null, (force) =>
    loadStaleInvites({ force })
  );
  const rows = list.data?.rows ?? [];
  const memberRows = list.data?.memberRows ?? [];
  const details = useQuery(enabled && rows.length ? staleDetailsKey(rows) : null, (force) =>
    loadStaleInviteDetails(rows, { force })
  );
  const detailOf = (invitee: string) => details.data?.find((d) => d.invitee === invitee);
  return { list, rows, memberRows, detailOf };
}

type UnusedInvites = ReturnType<typeof useUnusedInvites>;

export function ProposeDialog({
  kind,
  signer,
  ctx,
  preset,
  onClose,
  onSwitch,
}: ProposeDialogProps) {
  const open = Boolean(kind && signer);
  const [phase, setPhase] = useState<'form' | 'hub'>('form');
  const [input, setInput] = useState('');
  const [person, setPerson] = useState<Person | null>(null);
  const [resolving, setResolving] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [check, setCheck] = useState<SubjectCheck | 'checking' | null>(null);
  const [reason, setReason] = useState('');
  const [banMode, setBanMode] = useState<'permanent' | 'days'>('permanent');
  const [days, setDays] = useState('7');
  const [touched, setTouched] = useState(false);
  const [presetFor, setPresetFor] = useState<string | null>(null);
  const banLabelId = useId();
  const reasonRef = useRef<HTMLInputElement | null>(null);
  const daysRef = useRef<HTMLInputElement | null>(null);
  const invites = useUnusedInvites(open && kind === 'cancelInvite');

  // A new kind or preset person starts a fresh form (React's adjust-while-rendering pattern).
  const presetKey = `${kind ?? ''}:${preset?.address ?? ''}`;
  if (open && presetFor !== presetKey) {
    setPresetFor(presetKey);
    setPhase('form');
    setInput(preset ? (preset.name ?? preset.address) : '');
    setPerson(preset ?? null);
    setInputError(null);
    setCheck(null);
    setReason('');
    setBanMode('permanent');
    setDays('7');
    setTouched(false);
  }

  // Run the write's own check whenever the person changes (`signer` is stable per account).
  useEffect(() => {
    if (!kind || !signer || !person) return;
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

  const close = () => {
    onClose();
    setPresetFor(null);
  };

  if (!kind || !signer) return null;
  const info = PROPOSE_KINDS[kind];
  const needsReason = kind === 'kick' || kind === 'ban';
  const reasonError = needsReason ? reasonProblem(reason) : null;
  const ban = kind === 'ban' && banMode === 'days' ? parseBanDays(days) : { seconds: 0 };
  const banError = 'error' in ban ? ban.error : null;
  const personOk =
    person !== null && check !== null && check !== 'checking' && check.status === 'ok';
  const ready = personOk && !reasonError && !banError;
  // An invite approved in the last 30 days: they may still press Join now.
  const inviteDetail =
    kind === 'cancelInvite' && person ? invites.detailOf(person.address) : undefined;
  const recent = isRecentInvite(inviteDetail, Date.now()) ? inviteDetail?.approvedAt : null;
  // Removing yourself is stepping down, and is worded so.
  const stepDown = kind === 'removeAdmin' && person?.address === signer.address;

  // Review stays pressable while only the reason or length is missing, and says which.
  const review = () => {
    setTouched(true);
    if (ready) setPhase('hub');
    else if (reasonError) reasonRef.current?.focus();
    else if (banError) daysRef.current?.focus();
  };

  const find = async () => {
    setInputError(null);
    setResolving(true);
    try {
      const result = await resolvePerson(input);
      if ('error' in result) {
        setPerson(null);
        setCheck(null);
        setInputError(result.error);
      } else setPerson({ address: result.address, name: result.name });
    } catch {
      setInputError('Couldn’t look that up on your node. Try again in a moment.');
    } finally {
      setResolving(false);
    }
  };

  const approvalText = `about ${formatDuration(ctx.maximumBlockDelay * ctx.msPerBlock, { precise: true })}`;

  return (
    <>
      <ResponsiveDialog
        open={open && phase === 'form'}
        onClose={close}
        title={info.label}
        actions={
          <>
            <Button onClick={close}>Cancel</Button>
            <Button variant="contained" disabled={!personOk} onClick={review}>
              Review
            </Button>
          </>
        }
      >
        <Typography color="text.secondary">{info.description}</Typography>
        {kind === 'addAdmin' || kind === 'removeAdmin' ? (
          <Typography variant="body2" color="text.secondary">
            Every waiting decision is measured against the admin seats, so this can move the target
            for all of them, including ones that already have signatures. Review shows what it would
            change before Hub opens.
          </Typography>
        ) : null}

        {kind === 'removeAdmin' ? (
          <AdminPicker
            signers={ctx.signers}
            self={signer.address}
            value={person?.address ?? ''}
            onPick={(p) => setPerson(p)}
          />
        ) : kind === 'cancelBan' ? (
          <BanPicker value={person?.address ?? ''} onPick={(p) => setPerson(p)} />
        ) : kind === 'cancelInvite' ? (
          <InvitePicker
            invites={invites}
            admins={ctx.signers}
            value={person?.address ?? ''}
            onPick={(p) => setPerson(p)}
          />
        ) : (
          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              void find();
            }}
            sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}
          >
            <TextField
              label="Name or address"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setInputError(null);
              }}
              error={Boolean(inputError)}
              helperText={inputError ?? 'A registered name, or a Q… address.'}
              fullWidth
              autoComplete="off"
              slotProps={{ htmlInput: { autoCapitalize: 'none', spellCheck: false } }}
            />
            <Button
              type="submit"
              variant="outlined"
              disabled={resolving || !input.trim()}
              sx={{ minHeight: 56, flexShrink: 0 }}
            >
              {resolving ? 'Finding…' : 'Find'}
            </Button>
          </Box>
        )}

        {person ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              p: 1.5,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            <PersonChip address={person.address} name={person.name ?? undefined} size={40} />
            <CheckResult
              check={check}
              kind={kind}
              onSwitch={() => onSwitch('removeAdmin', person)}
            />
            {recent ? (
              <Alert severity="info" role="note">
                Approved {formatRelative(recent)}: they may still press Join now.
              </Alert>
            ) : null}
            {stepDown ? (
              <Alert severity="info" role="note">
                That’s you: this proposes that you step down as a Minter Admin. You stay a MINTER
                member, and the other Minter Admins still have to sign it.
              </Alert>
            ) : null}
          </Box>
        ) : null}

        {kind === 'ban' ? (
          <Box>
            <Typography sx={{ fontWeight: 600 }} id={banLabelId}>
              How long
            </Typography>
            <RadioGroup
              aria-labelledby={banLabelId}
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
          </Box>
        ) : null}

        {needsReason ? (
          <TextField
            label="Reason"
            required
            inputRef={reasonRef}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
            error={touched && Boolean(reasonError)}
            helperText={
              touched && reasonError
                ? reasonError
                : `The other Minter Admins and the account see it. ${utf8Length(reason.trim())} of ${REASON_MAX_BYTES} bytes.`
            }
            multiline
            minRows={2}
            fullWidth
          />
        ) : null}
      </ResponsiveDialog>

      {person ? (
        <ProposeHubStep
          open={open && phase === 'hub'}
          kind={kind}
          person={person}
          reason={reason.trim()}
          banSeconds={'seconds' in ban ? ban.seconds : 0}
          signer={signer}
          ctx={ctx}
          onClose={close}
          onBack={() => setPhase('form')}
        />
      ) : null}
    </>
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
      <Typography variant="body2" color="text.secondary" role="status">
        Checking this account on your node…
      </Typography>
    );
  }
  if (check.status === 'ok')
    return (
      <Alert severity="success" role="status">
        Nothing stops this proposal.
      </Alert>
    );
  if (check.status === 'blocked')
    return (
      <Alert severity="warning" role="status">
        {check.reason}
      </Alert>
    );
  return (
    <Alert severity="info" role="status">
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

function AdminPicker({
  signers,
  self,
  value,
  onPick,
}: {
  signers: GroupMemberRow[];
  self: string;
  value: string;
  onPick: (p: Person | null) => void;
}) {
  return (
    <TextField
      select
      label="Minter Admin"
      value={value}
      onChange={(e) => {
        const row = signers.find((s) => s.member === e.target.value);
        onPick(row ? { address: row.member, name: row.primaryName ?? null } : null);
      }}
      helperText="Pick yourself to step down. MINTER’s owner account isn’t listed: it can’t be removed."
      fullWidth
      slotProps={{ select: { native: true } }}
    >
      <option value="">Choose an admin…</option>
      {signers.map((s) => (
        <option key={s.member} value={s.member}>
          {displayName(s.primaryName, s.member)}
          {s.member === self ? ' (you)' : ''}
        </option>
      ))}
    </TextField>
  );
}

function BanPicker({ value, onPick }: { value: string; onPick: (p: Person | null) => void }) {
  const bans = useQuery('group:bans', (force) => getBans({ force }));
  if (bans.isLoading) return <CardSkeleton lines={1} />;
  const active = (bans.data ?? []).filter((b) => isBanActive(b));
  if (!active.length)
    return (
      <Alert severity="info" role="status">
        No bans are in force right now.
      </Alert>
    );
  return (
    <TextField
      select
      label="Banned account"
      value={value}
      onChange={(e) => onPick(e.target.value ? { address: e.target.value } : null)}
      fullWidth
      slotProps={{ select: { native: true } }}
    >
      <option value="">Choose an account…</option>
      {active.map((b) => (
        <BanOption key={b.offender} address={b.offender} banned={b.banned} reason={b.reason} />
      ))}
    </TextField>
  );
}

function BanOption({
  address,
  banned,
  reason,
}: {
  address: string;
  banned: number;
  reason?: string;
}) {
  const name = useDisplayName(address);
  return (
    <option value={address}>
      {name.label}, banned {formatRelative(banned)}
      {reason ? `: ${reason}` : ''}
    </option>
  );
}

/**
 * Unused approved invites, the oldest first once the dates are in, as under
 * Clean up stale invites; then the stored invites of people already in
 * MINTER, each marked "already a member".
 */
function InvitePicker({
  invites,
  admins,
  value,
  onPick,
}: {
  invites: UnusedInvites;
  admins: GroupMemberRow[];
  value: string;
  onPick: (p: Person | null) => void;
}) {
  const { list, detailOf } = invites;
  const approvedAt = (invitee: string) => detailOf(invitee)?.approvedAt ?? null;
  if (list.isLoading) return <CardSkeleton lines={1} />;
  if (list.isError && !list.data)
    return (
      <ErrorState
        compact
        title="Couldn’t load the approved invites."
        error={list.error}
        onRetry={list.refetch}
      />
    );
  const rows = [...invites.rows].sort(
    (a, b) => (approvedAt(a.invitee) ?? 0) - (approvedAt(b.invitee) ?? 0)
  );
  const memberRows = invites.memberRows;
  if (!rows.length && !memberRows.length)
    return (
      <Alert severity="info" role="status">
        There are no approved invites stored right now.
      </Alert>
    );
  const adminName = (address: string) =>
    displayName(admins.find((a) => a.member === address)?.primaryName, address);
  return (
    <TextField
      select
      label="Approved invite"
      value={value}
      onChange={(e) => onPick(e.target.value ? { address: e.target.value } : null)}
      helperText={
        memberRows.length
          ? 'Unused invites first, as under Clean up stale invites, then those of people already in MINTER.'
          : 'Approved invites nobody has used, as under Clean up stale invites.'
      }
      fullWidth
      slotProps={{ select: { native: true } }}
    >
      <option value="">Choose an account…</option>
      {rows.map((row) => (
        <InviteOption
          key={row.invitee}
          address={row.invitee}
          inviter={adminName(row.inviter)}
          approvedAt={approvedAt(row.invitee)}
        />
      ))}
      {memberRows.length ? (
        <optgroup label="Already in MINTER">
          {memberRows.map((row) => (
            <InviteOption
              key={row.invitee}
              address={row.invitee}
              inviter={adminName(row.inviter)}
              approvedAt={null}
              member
            />
          ))}
        </optgroup>
      ) : null}
    </TextField>
  );
}

function InviteOption({
  address,
  inviter,
  approvedAt,
  member = false,
}: {
  address: string;
  inviter: string;
  approvedAt: number | null;
  /** The invitee is in MINTER already. */
  member?: boolean;
}) {
  const name = useDisplayName(address);
  return (
    <option value={address}>
      {name.label}, invited by {inviter}
      {approvedAt ? `, approved ${formatRelative(approvedAt)}` : ''}
      {member ? ', already a member' : ''}
    </option>
  );
}

/** The proposal as the write takes it, from what the form holds. */
function toProposal(
  kind: ProposeKind,
  subject: string,
  reason: string,
  banSeconds: number
): Proposal {
  switch (kind) {
    case 'kick':
      return { kind, subject, reason };
    case 'ban':
      return { kind, subject, reason, banSeconds };
    default:
      return { kind, subject };
  }
}

function ProposeHubStep({
  open,
  kind,
  person,
  reason,
  banSeconds,
  signer,
  ctx,
  onClose,
  onBack,
}: {
  open: boolean;
  kind: ProposeKind;
  person: Person;
  reason: string;
  banSeconds: number;
  signer: Signer;
  ctx: ProposeContext;
  onClose: () => void;
  /** Back to the form, with the person, reason and length kept. */
  onBack: () => void;
}) {
  const who = useDisplayName(person.address, person.name);
  const stepDown = kind === 'removeAdmin' && person.address === signer.address;
  return (
    <ProposeSignDialog
      open={open}
      proposal={toProposal(kind, person.address, reason, banSeconds)}
      who={who.label}
      signer={signer}
      facts={ctx}
      title={stepDown ? ADMIN_CHANGE_TITLE.stepDown : `${KIND_LABEL[kind]}: ${who.label}`}
      lead={stepDown ? OWN_ADMIN_ROLE_LEAD.stepDown : undefined}
      impact={ctx.projectImpact?.(kind, person.address) ?? null}
      labelOf={ctx.labelOf}
      details={
        kind === 'ban' || reason ? (
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
          </>
        ) : null
      }
      onClose={onClose}
      onBack={onBack}
    />
  );
}
