/**
 * Approved, but the invite isn't used yet: one step left. "Join now" sends
 * JOIN_GROUP (explained first), and a small celebration marks the moment.
 */
import { useState } from 'react';
import { Alert, Button } from '@mui/material';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import { formatQort } from '../../../data/accounts';
import { heightToTime } from '../../../data/chain';
import { CUMULATIVE_BLOCKS_BY_LEVEL } from '../../../data/constants';
import { useAddressHistory, useChainNow } from '../../../hooks/useData';
import { useFee } from '../../../hooks/useFee';
import type { MyStatus } from '../../../rules/status';
import { signerOf, useSession } from '../../../state/session';
import { formatCount, formatRelative } from '../../../utils/format';
import { usePendingWrite, writeKeys } from '../../../writes/optimistic';
import { Hero, HeroText, Num, PersonLink } from '../Hero';
import { LazyJoinDialog } from '../LazyJoinDialog';
import { approvedInviteHeight, useBalance } from '../homeData';

export function ApprovedHero({ status }: { status: MyStatus }) {
  const session = useSession();
  const signer = signerOf(session);
  const now = useChainNow();
  const history = useAddressHistory(status.address);
  const fee = useFee('JOIN_GROUP');
  const balance = useBalance(status.address);
  const pending = usePendingWrite(writeKeys.join(status.address));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  const joined = pending?.status === 'confirming';
  const feeQort = fee.data?.qort ?? 0.01;
  const short = !joined && balance.data !== undefined && balance.data < feeQort;
  const height = history.data ? approvedInviteHeight(history.data.rows, status.address) : null;
  const approvedAt = height !== null && now.data ? heightToTime(now.data, height) : null;
  const inviter = status.storedInvite?.inviter ?? null;
  const name = status.name;

  return (
    <>
      <Hero
        eyebrow="Approved"
        title={
          joined
            ? `Welcome to MINTER${name ? `, ${name}` : ''}!`
            : 'You were approved, one step left'
        }
        celebrate={celebrate}
        actions={
          joined ? undefined : (
            <Button
              variant="contained"
              startIcon={<HowToRegOutlinedIcon />}
              disabled={!signer || pending?.status === 'sending'}
              onClick={() => setDialogOpen(true)}
            >
              Join now
            </Button>
          )
        }
        next={
          <>
            Once you&rsquo;re in, keep your node online: level 1 comes at{' '}
            <Num>{formatCount(CUMULATIVE_BLOCKS_BY_LEVEL[0])}</Num> blocks minted, and every level
            after it the same way.
          </>
        }
      >
        {joined ? (
          <HeroText>
            Your join is on its way into a block, usually within a minute or two. Then you&rsquo;re
            a MINTER member and your node can start minting.
          </HeroText>
        ) : (
          <>
            <HeroText>
              Good news{name ? `, ${name}` : ''}: the Minter Admins approved you
              {approvedAt !== null ? ` ${formatRelative(approvedAt)}` : ''}
              {inviter ? (
                <>
                  , on an invite from <PersonLink address={inviter} />
                </>
              ) : null}
              .
            </HeroText>
            <HeroText>
              Press Join now to become a member. It takes effect in the next block, with a{' '}
              <Num>{formatQort(feeQort)}</Num> fee.
            </HeroText>
          </>
        )}
        {short ? (
          <Alert severity="warning">
            Your confirmed balance is <Num>{formatQort(balance.data ?? 0)}</Num>, and joining needs{' '}
            <Num>{formatQort(feeQort)}</Num>. Ask someone you know on Qortal to send you a little
            QORT, then join.
          </Alert>
        ) : null}
        {pending?.status === 'failed' ? (
          <Alert severity="warning">
            {pending.message ??
              "Your join hasn't shown up yet. Check again in a minute before trying again."}
          </Alert>
        ) : null}
      </Hero>
      {signer ? (
        <LazyJoinDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          mode="join"
          signer={signer}
          needed={null}
          onSent={() => setCelebrate(true)}
        />
      ) : null}
    </>
  );
}
