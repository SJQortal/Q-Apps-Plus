/**
 * "Accept nomination" and "Join now": one JOIN_GROUP through Hub, explained
 * before Hub's own dialog opens (what it does, the fee, and what to do when
 * the balance can't cover it). The write itself is writes/flows → joinMinter.
 */
import { Alert } from '@mui/material';
import { formatQort } from '../../data/accounts';
import { HubStepDialog } from '../../components/common/HubStepDialog';
import { useFee } from '../../hooks/useFee';
import { joinMinter } from '../../writes/flows';
import type { Signer } from '../../writes/runner';
import { useBalance } from './homeData';
import { HeroText, Num } from './Hero';

export interface JoinDialogProps {
  open: boolean;
  onClose: () => void;
  /** 'accept': a join request before approval; 'join': the last step after it. */
  mode: 'accept' | 'join';
  signer: Signer;
  /** Signatures needed now, for the explanation. */
  needed: number | null;
  /** Who to ask for QORT when the balance is short (the nominator's name). */
  askWho?: string | null;
  onSent?: () => void;
}

export function JoinDialog({
  open,
  onClose,
  mode,
  signer,
  needed,
  askWho,
  onSent,
}: JoinDialogProps) {
  const fee = useFee('JOIN_GROUP');
  const balance = useBalance(open ? signer.address : null);
  const feeQort = fee.data?.qort ?? 0.01;
  const short = balance.data !== undefined && balance.data < feeQort;
  const accept = mode === 'accept';

  return (
    <HubStepDialog
      open={open}
      onClose={onClose}
      title={accept ? 'Accept your nomination' : 'Join MINTER'}
      intro={
        <>
          {accept ? (
            <HeroText>
              Accepting sends a join request to MINTER. It doesn&rsquo;t make you a member yet: once{' '}
              {needed ? <Num>{needed}</Num> : 'enough'} Minter Admins have signed your nomination,
              you&rsquo;re added at once, with nothing more to do.
            </HeroText>
          ) : (
            <HeroText>
              The Minter Admins approved you, so joining makes you a MINTER member as soon as the
              transaction is in a block, usually within a minute or two.
            </HeroText>
          )}
          {short ? (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              Your confirmed balance is <Num>{formatQort(balance.data ?? 0)}</Num>, and this needs{' '}
              <Num>{formatQort(feeQort)}</Num> for the fee. Ask{' '}
              {askWho ? askWho : 'someone you know on Qortal'} to send you a little QORT, then try
              again.
            </Alert>
          ) : null}
        </>
      }
      steps={[
        {
          action: 'JOIN_GROUP',
          title: accept ? 'Send your join request' : 'Join MINTER',
          feeTxType: 'JOIN_GROUP',
        },
      ]}
      run={async (report) => ({
        outcome: await joinMinter(signer, (stage) => report(0, stage)),
      })}
      successTitle={accept ? 'Accepted ✓' : 'Welcome to MINTER ✓'}
      successText={
        accept
          ? 'Your join request is on its way into a block. You join MINTER the moment enough Minter Admins have signed.'
          : 'It takes effect once the transaction is in a block, usually within a minute or two.'
      }
      onSuccess={() => onSent?.()}
    />
  );
}
