/**
 * Not in MINTER yet, with or without a registered name. Nominators look for
 * people who'd make good minters and often reach out first; the newcomer can
 * also show they're ready to mint (MINTER's join request, after a short
 * self-check), or share their name or address and look at open nominations.
 * Once a join request is open and no nomination backs it yet: "You've shown
 * you're ready to mint", and what happens next.
 */
import { Link as RouterLink } from 'react-router-dom';
import { Button } from '@mui/material';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { NAMES_APP_LINK } from '../../../components/ready/readyChecks';
import { formatQort } from '../../../data/accounts';
import { NOMINATOR_MIN_LEVEL } from '../../../data/constants';
import { useBalance } from '../../../hooks/useData';
import { useFee } from '../../../hooks/useFee';
import { decisionsViewPath } from '../../../routes/paths';
import type { MyStatus } from '../../../rules/status';
import { openQortalLink } from '../../../utils/links';
import { Hero, HeroText, Num } from '../Hero';
import { ReadyButton, ReadyDialog, ReadyNext, ReadyUnknown, ShareButton, Tick } from './ready';
import { useReadyToMint } from './useReadyToMint';

export function NewcomerHero({ status, needed }: { status: MyStatus; needed: number | null }) {
  const ready = useReadyToMint(status);
  const fee = useFee('JOIN_GROUP');
  const balance = useBalance(status.address);
  const feeQort = fee.data?.qort ?? 0.01;
  const name = status.name;
  const isReady = ready.ready;

  const title = isReady ? (
    <>
      {name ? `${name}, you've shown you're ready to mint` : "You've shown you're ready to mint"}
      <Tick />
    </>
  ) : name ? (
    `Hi ${name}, you're not in MINTER yet`
  ) : (
    "You're not in the MINTER group yet"
  );

  return (
    <>
      <Hero
        eyebrow={isReady ? 'Ready to mint' : 'Not in MINTER yet'}
        title={title}
        actions={
          <>
            {isReady ? null : <ReadyButton ready={ready} />}
            <ShareButton status={status} />
            <Button component={RouterLink} to={decisionsViewPath('nominations')}>
              See open nominations
            </Button>
            {name ? null : (
              <Button
                endIcon={<OpenInNewOutlinedIcon />}
                onClick={() => void openQortalLink(NAMES_APP_LINK)}
              >
                Register a name (optional)
              </Button>
            )}
          </>
        }
        next={
          isReady ? (
            <ReadyNext needed={needed} />
          ) : (
            'When someone nominates you, this page shows who did, and how the Minter Admins answer.'
          )
        }
      >
        {isReady ? (
          <>
            <HeroText>
              {ready.confirming
                ? 'Your join request is on its way into a block. Then nominators and Minter Admins can see that you’d like to mint.'
                : 'Your join request is open, so nominators and Minter Admins can see that you’d like to mint.'}
            </HeroText>
            <HeroText muted>
              It can&rsquo;t be withdrawn: it stays open until you&rsquo;re approved, or Minter
              Admins remove it. Meanwhile, keep your node online and synced.
            </HeroText>
          </>
        ) : (
          <>
            <HeroText>
              MINTER members mint QORT: while their minting key is online, every block counts
              towards their level.
            </HeroText>
            <HeroText>
              Nominators, minters at level {NOMINATOR_MIN_LEVEL} or above, look for people
              who&rsquo;d make good minters, and often reach out first. When one nominates you, you
              accept, and {needed ? <Num>{needed}</Num> : 'enough'} Minter Admins approve, you&rsquo;re
              in.
            </HeroText>
            <HeroText>
              You can also show you&rsquo;re ready to mint, so nominators and Minter Admins see that
              you&rsquo;d like to. It sends a join request, with a <Num>{formatQort(feeQort)}</Num>{' '}
              fee
              {balance.data !== undefined ? (
                <>
                  {' '}
                  (you have <Num>{formatQort(balance.data)}</Num>
                  {balance.data < feeQort
                    ? ': ask someone you know on Qortal to send you a little QORT'
                    : ''}
                  )
                </>
              ) : null}
              .
            </HeroText>
          </>
        )}
        {name ? (
          <HeroText>
            Nominators can find you by your name, <strong>{name}</strong>, or your address. If you
            know a minter at level {NOMINATOR_MIN_LEVEL} or above, share it with them.
          </HeroText>
        ) : (
          <HeroText>
            A registered name helps nominators recognise you. It isn&rsquo;t required: a nomination
            works with your address too.
          </HeroText>
        )}
        <ReadyUnknown ready={ready} />
      </Hero>
      <ReadyDialog ready={ready} needed={needed} />
    </>
  );
}
