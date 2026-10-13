/**
 * "Show you're ready to mint" on Home, shared by the newcomer's and the
 * former member's heroes: the button, the dialog (loaded on first use), the
 * line that says it's done, and what happens next. On chain it is MINTER's
 * join request, so "ready" means one is open, or Hub just sent one and it
 * is confirming.
 */
import { Alert, Box, Button, Typography } from '@mui/material';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import { LazyReadyToMintDialog } from '../../../components/ready/LazyReadyToMintDialog';
import { READY_TITLE } from '../../../components/ready/readyChecks';
import { NOMINATOR_MIN_LEVEL } from '../../../data/constants';
import type { MyStatus } from '../../../rules/status';
import { readable } from '../../../utils/readable';
import { CopyButton, Num } from '../Hero';
import type { ReadyToMint } from './useReadyToMint';

/** The primary action while there's no join request. */
export function ReadyButton({ ready }: { ready: ReadyToMint }) {
  return (
    <Button
      variant="contained"
      startIcon={<HowToRegOutlinedIcon />}
      disabled={!ready.signer || ready.sending}
      onClick={() => ready.setDialogOpen(true)}
    >
      {ready.sending ? 'Sending…' : READY_TITLE}
    </Button>
  );
}

/**
 * The dialog. Keep it mounted whatever the hero shows: it stays open on
 * its result while Home switches to "You've shown you're ready to mint".
 */
export function ReadyDialog({ ready, needed }: { ready: ReadyToMint; needed: number | null }) {
  if (!ready.signer) return null;
  return (
    <LazyReadyToMintDialog
      open={ready.dialogOpen}
      onClose={() => ready.setDialogOpen(false)}
      signer={ready.signer}
      needed={needed}
    />
  );
}

/** "✓" after a headline: seen, not read out (the words say it). */
export function Tick() {
  return (
    <Box component="span" aria-hidden sx={{ color: readable('success') }}>
      {' ✓'}
    </Box>
  );
}

/** The done line for heroes that keep their own headline (former members). */
export function ReadyDone({ ready }: { ready: ReadyToMint }) {
  return (
    <Typography role="status" sx={{ fontWeight: 700, color: readable('success') }}>
      You&rsquo;ve shown you&rsquo;re ready to mint ✓{ready.confirming ? ' (confirming…)' : ''}
    </Typography>
  );
}

/** What happens after showing it, for "What's next". */
export function ReadyNext({ needed }: { needed: number | null }) {
  return (
    <>
      A nominator, a minter at level {NOMINATOR_MIN_LEVEL} or above, may nominate you. Then Minter
      Admins sign: once {needed ? <Num>{needed}</Num> : 'enough'} have signed, you&rsquo;re in at
      once, with nothing more to press.
    </>
  );
}

/** A send whose outcome isn't known yet. */
export function ReadyUnknown({ ready }: { ready: ReadyToMint }) {
  return ready.unknown ? <Alert severity="warning">{ready.unknown}</Alert> : null;
}

/** Copy the name (or the address, without one) to share with a nominator. */
export function ShareButton({ status }: { status: MyStatus }) {
  return status.name ? (
    <CopyButton text={status.name} label="Copy your name" />
  ) : (
    <CopyButton text={status.address} label="Copy your address" />
  );
}
