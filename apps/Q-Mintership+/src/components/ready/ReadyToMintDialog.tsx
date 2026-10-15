/**
 * "Show you're ready to mint": a newcomer tells nominators and Minter Admins
 * they'd like to mint. On chain it is MINTER's join request (JOIN_GROUP, the
 * same write as Accept), so an approved nomination makes them a member at
 * once. It can't be withdrawn, so a short self-check comes first:
 *
 * 1. The checklist: three boxes to tick, the fee against their confirmed
 *    balance (too low blocks it, with how to get a little QORT), and an
 *    optional registered name. The answers stay here: nothing is published
 *    or saved.
 * 2. The Hub step (HubStepDialog): what Hub will show, the fee, then
 *    writes/flows.ts → joinMinter, whose guard checks the chain again.
 *
 * Reusable: any screen can open it (Home does, through LazyReadyToMintDialog).
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Box, Button, Checkbox, FormControlLabel, Typography } from '@mui/material';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { formatQort } from '../../data/accounts';
import { NOMINATOR_MIN_LEVEL } from '../../data/constants';
import { useBalance } from '../../hooks/useData';
import { useFee } from '../../hooks/useFee';
import { openQortalLink } from '../../utils/links';
import { readable } from '../../utils/readable';
import { joinMinter } from '../../writes/flows';
import type { Signer } from '../../writes/runner';
import { HubStepDialog } from '../common/HubStepDialog';
import { AddressText } from '../common/Person';
import { RefreshIcon } from '../common/RefreshButton';
import { ResponsiveDialog } from '../common/ResponsiveDialog';
import {
  NAMES_APP_LINK,
  READY_CHECKS,
  READY_TITLE,
  missingChecks,
  readyHint,
  type ReadyCheck,
  type ReadyCheckId,
  type ReadyTicks,
} from './readyChecks';

export interface ReadyToMintDialogProps {
  open: boolean;
  onClose: () => void;
  /** Who is signed in; their name, if they have one, is shown as the optional extra. */
  signer: (Signer & { name?: string | null }) | null;
  /** Signatures needed right now, for the explanation. */
  needed?: number | null;
  /** Hub sent the join request. */
  onSuccess?: () => void;
}

/** The opener and the section around it, so focus comes back even when the button is gone. */
function useOpener(open: boolean) {
  const opener = useRef<{ element: HTMLElement | null; anchor: HTMLElement | null }>({
    element: null,
    anchor: null,
  });
  useLayoutEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || active === document.body) return;
    if (active.closest('[role="dialog"]')) return;
    opener.current = { element: active, anchor: active.closest<HTMLElement>('section, main') };
  }, [open]);
  return () => {
    const { element, anchor } = opener.current;
    if (element?.isConnected) return element;
    return anchor?.isConnected ? anchor : null;
  };
}

export function ReadyToMintDialog({
  open,
  onClose,
  signer,
  needed,
  onSuccess,
}: ReadyToMintDialogProps) {
  const address = signer?.address ?? null;
  const fee = useFee('JOIN_GROUP');
  const balance = useBalance(open ? address : null);
  const feeQort = fee.data?.qort ?? 0.01;
  const [phase, setPhase] = useState<'check' | 'hub'>('check');
  const [ticks, setTicks] = useState<ReadyTicks>({});
  const [attempted, setAttempted] = useState(false);
  const boxes = useRef<Partial<Record<ReadyCheckId, HTMLInputElement | null>>>({});
  const returnFocus = useOpener(open);

  // Each opening starts a fresh self-check (React's adjust-while-rendering pattern).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPhase('check');
      setTicks({});
      setAttempted(false);
    }
  }

  // The balance as it is now, not as Home last read it.
  const { refetch } = balance;
  useEffect(() => {
    if (open && address) void refetch();
  }, [open, address, refetch]);

  const known = typeof balance.data === 'number' ? balance.data : undefined;
  const short = known !== undefined && known < feeQort;
  const checkingBalance = Boolean(address) && known === undefined && !balance.isError;
  const missing = missingChecks(ticks);
  const hint = readyHint({ ticks, balance: known, feeQort, attempted, checking: checkingBalance });

  const next = () => {
    if (missing.length) {
      setAttempted(true);
      boxes.current[missing[0].id]?.focus();
      return;
    }
    setPhase('hub');
  };

  return (
    <>
      <ResponsiveDialog
        open={open && phase === 'check'}
        onClose={onClose}
        title={READY_TITLE}
        returnFocus={returnFocus}
        actions={
          <>
            <Button onClick={onClose}>Not now</Button>
            <Button variant="contained" onClick={next} disabled={short || checkingBalance}>
              Continue
            </Button>
          </>
        }
      >
        <Typography>
          Nominators, minters at level {NOMINATOR_MIN_LEVEL} or above, look for people who&rsquo;d
          make good minters. Showing you&rsquo;re ready sends MINTER a join request from your
          account: nominators and Minter Admins can see it, and when a nomination of you is approved
          {needed ? ` (${needed} approvals today)` : ''}, you&rsquo;re a member at once.
        </Typography>

        <Box component="fieldset" sx={{ border: 0, m: 0, p: 0, minWidth: 0 }}>
          <Box component="legend" sx={{ p: 0, mb: 0.5, typography: 'body1', fontWeight: 700 }}>
            A quick self-check
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
            Tick all {READY_CHECKS.length}. Your answers stay here: they aren&rsquo;t published or
            saved.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {READY_CHECKS.map((check) => (
              <CheckItem
                key={check.id}
                check={check}
                checked={Boolean(ticks[check.id])}
                showError={attempted && !ticks[check.id]}
                onChange={(value) => setTicks((t) => ({ ...t, [check.id]: value }))}
                inputRef={(el) => {
                  boxes.current[check.id] = el;
                }}
              />
            ))}
          </Box>
        </Box>

        <FeeCheck
          feeQort={feeQort}
          balance={known}
          failed={balance.isError && known === undefined}
          checking={balance.fetching}
          address={address}
          onRecheck={() => void refetch()}
        />

        <NameNote name={signer?.name ?? null} />

        <Typography
          variant="body2"
          role="status"
          sx={{ color: attempted && missing.length ? readable('error') : 'text.secondary' }}
        >
          {hint}
        </Typography>
      </ResponsiveDialog>

      <HubStepDialog
        open={open && phase === 'hub'}
        onClose={onClose}
        onBack={() => setPhase('check')}
        returnFocus={returnFocus}
        title={READY_TITLE}
        intro={
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography>
              Hub shows this as joining the group MINTER. MINTER is closed, so it doesn&rsquo;t make
              you a member yet: it sends your join request, which nominators and Minter Admins can
              see.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              When a nomination of you is approved, you&rsquo;re in at once, with nothing more to
              press. The request can&rsquo;t be withdrawn.
            </Typography>
          </Box>
        }
        steps={[{ action: 'JOIN_GROUP', title: 'Send your join request', feeTxType: 'JOIN_GROUP' }]}
        run={async (report) => {
          if (!signer) return { outcome: { status: 'blocked', reason: 'Sign in to Hub first.' } };
          return { outcome: await joinMinter(signer, (stage) => report(0, stage)) };
        }}
        successTitle="You've shown you're ready to mint ✓"
        successText={
          <Typography variant="body2">
            Your join request is on its way into a block. From then on, nominators and Minter Admins
            can see it.
          </Typography>
        }
        onSuccess={() => onSuccess?.()}
      />
    </>
  );
}

function CheckItem({
  check,
  checked,
  showError,
  onChange,
  inputRef,
}: {
  check: ReadyCheck;
  checked: boolean;
  showError: boolean;
  onChange: (value: boolean) => void;
  inputRef: (el: HTMLInputElement | null) => void;
}) {
  const whyId = useId();
  const errorId = useId();
  const describedBy =
    [check.why ? whyId : null, showError ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <Box
      sx={{
        border: 1,
        borderColor: showError ? 'error.main' : checked ? 'primary.main' : 'divider',
        borderRadius: 1,
        px: 1,
        py: 0.5,
        transition: 'border-color 150ms ease',
      }}
    >
      <FormControlLabel
        control={
          <Checkbox
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
            slotProps={{
              input: {
                // On the input, not the Checkbox: no asterisk, the legend says all are needed.
                required: true,
                ref: inputRef,
                'aria-describedby': describedBy,
                'aria-invalid': showError || undefined,
              },
            }}
            sx={{ width: 44, height: 44, flexShrink: 0 }}
          />
        }
        label={check.label}
        sx={{
          alignItems: 'flex-start',
          mx: 0,
          gap: 0.5,
          '& .MuiFormControlLabel-label': { pt: '10px', fontWeight: 600, overflowWrap: 'anywhere' },
        }}
      />
      {check.why ? (
        <Typography id={whyId} variant="body2" color="text.secondary" sx={{ pl: '48px', pb: 0.5 }}>
          {check.why}
        </Typography>
      ) : null}
      {showError ? (
        <Typography
          id={errorId}
          variant="body2"
          sx={{ pl: '48px', pb: 0.5, color: readable('error') }}
        >
          Tick this to continue.
        </Typography>
      ) : null}
    </Box>
  );
}

/** A small titled row: an icon, a bold title and a line or two under it. */
function Note({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
      <Box aria-hidden sx={{ pt: '2px', display: 'flex' }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Typography component="h3" sx={{ fontWeight: 700, fontSize: 16 }}>
          {title}
        </Typography>
        {children}
      </Box>
    </Box>
  );
}

function FeeCheck({
  feeQort,
  balance,
  failed,
  checking,
  address,
  onRecheck,
}: {
  feeQort: number;
  balance: number | undefined;
  failed: boolean;
  /** The balance is being read (a press of Check again, or the read on opening). */
  checking: boolean;
  address: string | null;
  onRecheck: () => void;
}) {
  // The balance when Check again was last pressed, to say what the new read found.
  const [pressedWith, setPressedWith] = useState<number | undefined | null>(null);
  const recheck = (
    // Stays enabled while it reads, so focus stays on it; a second press waits for the first.
    <Button
      variant="outlined"
      startIcon={<RefreshIcon busy={checking} />}
      onClick={() => {
        if (checking) return;
        setPressedWith(balance);
        onRecheck();
      }}
      sx={{ alignSelf: 'flex-start', minHeight: 44 }}
    >
      {checking ? 'Checking…' : 'Check again'}
    </Button>
  );
  if (balance !== undefined && balance < feeQort) {
    const pressed = pressedWith !== null;
    const result = !pressed
      ? ''
      : checking
        ? 'Checking your confirmed balance…'
        : balance === pressedWith
          ? `Checked just now: still ${formatQort(balance)} confirmed.`
          : `Checked just now: ${formatQort(balance)} confirmed.`;
    return (
      <Alert severity="warning" role="note">
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          You need {formatQort(feeQort)} for the fee first.
        </Typography>
        <Typography variant="body2">
          Your confirmed balance is {formatQort(balance)}. Ask someone you know on Qortal, or ask in
          Q-Chat, to send a little QORT to your address. Once it has confirmed (a block or two),
          check again.
        </Typography>
        {address ? (
          <Box sx={{ mt: 0.5 }}>
            <AddressText address={address} full />
          </Box>
        ) : null}
        <Box sx={{ mt: 0.5 }}>{recheck}</Box>
        {/* There from the start, so what a press found is spoken. */}
        <Typography variant="body2" role="status" sx={{ mt: result ? 0.5 : 0 }}>
          {result}
        </Typography>
      </Alert>
    );
  }
  return (
    <Note
      title="The fee"
      icon={
        balance !== undefined ? (
          <CheckCircleOutlineOutlinedIcon sx={{ color: 'success.main' }} />
        ) : (
          <InfoOutlinedIcon sx={{ color: 'text.secondary' }} />
        )
      }
    >
      <Typography variant="body2">
        {formatQort(feeQort)}, paid once.{' '}
        {balance !== undefined
          ? `Your confirmed balance is ${formatQort(balance)}, so that's covered.`
          : failed
            ? "Couldn't check your balance just now. It's checked again before Hub opens."
            : 'Checking your confirmed balance…'}
      </Typography>
      {failed ? recheck : null}
    </Note>
  );
}

function NameNote({ name }: { name: string | null }) {
  if (name) {
    return (
      <Note
        title="A registered name (optional)"
        icon={<CheckCircleOutlineOutlinedIcon sx={{ color: 'success.main' }} />}
      >
        <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
          Yours is <strong>{name}</strong>: it helps nominators recognise you.
        </Typography>
      </Note>
    );
  }
  return (
    <Note
      title="A registered name (optional)"
      icon={<InfoOutlinedIcon sx={{ color: 'text.secondary' }} />}
    >
      <Typography variant="body2">
        A name helps nominators recognise you. It isn&rsquo;t required: a nomination works with your
        address too.
      </Typography>
      <Button
        variant="outlined"
        endIcon={<OpenInNewOutlinedIcon />}
        onClick={() => void openQortalLink(NAMES_APP_LINK)}
        sx={{ alignSelf: 'flex-start', minHeight: 44 }}
      >
        Register a name
      </Button>
    </Note>
  );
}
