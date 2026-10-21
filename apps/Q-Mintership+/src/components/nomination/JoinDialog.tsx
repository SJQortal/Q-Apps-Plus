/**
 * The nominee's JOIN_GROUP, the same on Home and Nominations, explained
 * before Hub opens:
 *
 * - "Accept nomination" (before approval): the join request waits, and the
 *   approval then makes them a member at once, with nothing more to press.
 * - "Join now" (approved): the stored invite is used and they are in.
 *
 * One Hub confirmation and the JOIN_GROUP fee. With too little QORT, it says
 * so up front and how to get some (writes/flows.ts → joinMinter checks again).
 * Home loads it lazily (LazyJoinDialog), so the write code stays out of the
 * first screen everyone sees.
 */
import { Alert, Box, Typography } from '@mui/material';
import { READY_DONE } from '../../constants/words';
import { formatQort } from '../../data/accounts';
import { useBalance } from '../../hooks/useData';
import { useFee } from '../../hooks/useFee';
import { joinMinter } from '../../writes/flows';
import type { Signer } from '../../writes/runner';
import { HubStepDialog } from '../common/HubStepDialog';
import { AddressText } from '../common/Person';
import type { JoinMode } from './nomineeStep';

export interface JoinDialogProps {
  open: boolean;
  onClose: () => void;
  mode: JoinMode;
  signer: Signer | null;
  /** Signatures needed right now, for the explanation ("once 8 Minter Admins…"). */
  needed?: number | null;
  /** Who to ask for QORT when the balance is short (the nominator's name). */
  askWho?: string | null;
  /** Hub sent it. */
  onSuccess?: () => void;
}

export function JoinDialog({
  open,
  onClose,
  mode,
  signer,
  needed,
  askWho,
  onSuccess,
}: JoinDialogProps) {
  const address = signer?.address ?? null;
  const fee = useFee('JOIN_GROUP');
  const balance = useBalance(open ? address : null);
  const feeQort = fee.data?.qort ?? 0.01;
  const short = typeof balance.data === 'number' && balance.data < feeQort;
  const accept = mode === 'accept';

  return (
    <HubStepDialog
      open={open}
      onClose={onClose}
      title={accept ? 'Accept your nomination' : 'Join MINTER'}
      intro={
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {accept ? (
            <>
              <Typography>
                Accepting sends your request to join MINTER. It doesn&rsquo;t make you a member yet:
                once {needed ? needed : 'enough'} Minter Admins have approved your nomination,
                you&rsquo;re added at once, with nothing more to press.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                If the nomination expires instead, your request stays, and a later approval still
                lets you in.
              </Typography>
            </>
          ) : (
            <Typography>
              The Minter Admins approved you, so joining makes you a MINTER member as soon as this
              is in a block, usually within a minute or two.
            </Typography>
          )}
          {short ? (
            <Alert severity="warning" role="status">
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                You need {formatQort(feeQort)} for the fee first.
              </Typography>
              <Typography variant="body2">
                Your confirmed balance is {formatQort(balance.data ?? 0)}. Ask{' '}
                {askWho ?? 'the person who nominated you, or any Qortal friend,'} to send a little
                QORT to your address, then come back once it has confirmed (a block or two).
              </Typography>
              {address ? (
                <Box sx={{ mt: 0.5 }}>
                  <AddressText address={address} full />
                </Box>
              ) : null}
            </Alert>
          ) : null}
        </Box>
      }
      steps={[
        {
          action: 'JOIN_GROUP',
          title: accept ? 'Send your join request' : 'Join MINTER',
          feeTxType: 'JOIN_GROUP',
        },
      ]}
      run={async (report) => {
        if (!signer) return { outcome: { status: 'blocked', reason: 'Sign in to Hub first.' } };
        const outcome = await joinMinter(signer, (stage) => report(0, stage));
        return { outcome };
      }}
      successTitle={accept ? READY_DONE : 'Welcome to MINTER ✓'}
      successText={
        <Typography variant="body2">
          {accept
            ? 'Your join request is on its way into a block. You join MINTER the moment enough Minter Admins have approved.'
            : 'Your join is on its way into a block, usually within a minute or two. Then you are a member of MINTER.'}
        </Typography>
      }
      onSuccess={() => onSuccess?.()}
    />
  );
}
