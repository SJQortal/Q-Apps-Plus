/**
 * The nominee's JOIN_GROUP, explained before Hub opens:
 *
 * - "Accept nomination" (before approval): the join request waits, and the
 *   approval then makes them a member at once, with nothing more to press.
 * - "Join now" (approved): the stored invite is used and they are in.
 *
 * One Hub confirmation and the JOIN_GROUP fee. With too little QORT, it says
 * so up front and how to get some (writes/flows.ts → joinMinter checks again).
 */
import { Alert, Box, Typography } from '@mui/material';
import { formatQort, getBalance } from '../../data/accounts';
import { useFee } from '../../hooks/useFee';
import { useQuery } from '../../hooks/useQuery';
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
  onSuccess?: () => void;
}

export function JoinDialog({ open, onClose, mode, signer, onSuccess }: JoinDialogProps) {
  const address = signer?.address ?? null;
  const fee = useFee('JOIN_GROUP');
  const balance = useQuery(open && address ? `balance:${address}` : null, (force) =>
    getBalance(address as string, { force })
  );
  const feeQort = fee.data?.qort ?? 0.01;
  const short = typeof balance.data === 'number' && balance.data < feeQort;

  return (
    <HubStepDialog
      open={open}
      onClose={onClose}
      title={mode === 'accept' ? 'Accept your nomination' : 'Join MINTER'}
      intro={
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {mode === 'accept' ? (
            <>
              <Typography>
                Accepting sends your request to join MINTER. It waits while the Minter Admins sign,
                and once enough of them have, you become a member straight away, with nothing more
                to press.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                If the nomination expires instead, your request stays, and a later approval still
                lets you in.
              </Typography>
            </>
          ) : (
            <Typography>
              You were approved. Joining uses that approval, so you are a member of MINTER as soon
              as this is in a block, usually within a couple of minutes.
            </Typography>
          )}
          {short ? (
            <Alert severity="warning" role="status">
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                You need {formatQort(feeQort)} for the fee first.
              </Typography>
              <Typography variant="body2">
                Your confirmed balance is {formatQort(balance.data ?? 0)}. Ask the person who
                nominated you, or any Qortal friend, to send you a little QORT to your address, then
                come back once it has confirmed (a block or two).
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
          title: mode === 'accept' ? 'Send your join request' : 'Join MINTER',
          feeTxType: 'JOIN_GROUP',
        },
      ]}
      run={async (report) => {
        if (!signer) return { outcome: { status: 'blocked', reason: 'Sign in to Hub first.' } };
        const outcome = await joinMinter(signer, (stage) => report(0, stage));
        return { outcome };
      }}
      successTitle={mode === 'accept' ? 'Nomination accepted' : 'Welcome to MINTER'}
      successText={
        <Typography variant="body2">
          {mode === 'accept'
            ? 'Your join request is on its way. Once it is in a block, the Minter Admins see that you accepted.'
            : 'Your join is on its way. Once it is in a block you are a member of MINTER.'}
        </Typography>
      }
      onSuccess={() => onSuccess?.()}
    />
  );
}
