/**
 * Not in MINTER yet, with or without a registered name: how minting and
 * nomination work, the fee and the account's balance, and the next step
 * (find a nominator; with a name, share it). Also covers an open join
 * request that no nomination backs yet.
 */
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Button } from '@mui/material';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined';
import { formatQort } from '../../../data/accounts';
import { NOMINATOR_MIN_LEVEL } from '../../../data/constants';
import { useBalance } from '../../../hooks/useData';
import { useFee } from '../../../hooks/useFee';
import { PATHS } from '../../../routes/paths';
import type { MyStatus } from '../../../rules/status';
import { openQortalLink } from '../../../utils/links';
import { FindNominatorDialog, NAMES_APP_LINK } from '../HelpDialogs';
import { CopyButton, Hero, HeroText, Num } from '../Hero';

export function NewcomerHero({ status, needed }: { status: MyStatus; needed: number | null }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const fee = useFee('JOIN_GROUP');
  const balance = useBalance(status.address);
  const feeQort = fee.data?.qort ?? 0.01;
  const name = status.name;

  return (
    <>
      <Hero
        eyebrow="Not in MINTER yet"
        title={name ? `Hi ${name}, you're not in MINTER yet` : "You're not in the MINTER group yet"}
        actions={
          name ? (
            <>
              <CopyButton text={name} label="Copy your name" variant="contained" />
              <CopyButton text={status.address} label="Copy your address" />
              <Button component={RouterLink} to={PATHS.nominations}>
                See open nominations
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="contained"
                startIcon={<PersonSearchOutlinedIcon />}
                onClick={() => setHelpOpen(true)}
              >
                Find a nominator
              </Button>
              <Button
                variant="outlined"
                endIcon={<OpenInNewOutlinedIcon />}
                onClick={() => void openQortalLink(NAMES_APP_LINK)}
              >
                Register a name (optional)
              </Button>
            </>
          )
        }
        next={
          status.hasJoinRequest
            ? 'When someone nominates you, this page shows it. Your join request is already in, so approval makes you a member at once.'
            : 'When someone nominates you, this page shows it with an Accept button.'
        }
      >
        <HeroText>
          MINTER members mint QORT: while their minting key is online, every block counts towards
          their level.
        </HeroText>
        {status.hasJoinRequest ? (
          <HeroText>
            You&rsquo;ve asked to join MINTER, and your join request is open. What moves it is a
            nomination by a member at level {NOMINATOR_MIN_LEVEL} or above; once{' '}
            {needed ? <Num>{needed}</Num> : 'enough'} Minter Admins sign it, you&rsquo;re in.
          </HeroText>
        ) : (
          <HeroText>
            To join, a MINTER member at level {NOMINATOR_MIN_LEVEL} or above nominates you. You
            accept, and Minter Admins sign: once {needed ? <Num>{needed}</Num> : 'enough'} have
            signed, you&rsquo;re in.
          </HeroText>
        )}
        {name ? (
          <HeroText>
            Ask a level {NOMINATOR_MIN_LEVEL}+ minter who knows you to nominate you: send them your
            name, <strong>{name}</strong>, or your address.
          </HeroText>
        ) : (
          <HeroText>
            A registered name helps people recognise you, but it isn&rsquo;t required: a nomination
            works with your address too.
          </HeroText>
        )}
        {status.hasJoinRequest ? null : (
          <HeroText muted>
            Accepting a nomination costs a <Num>{formatQort(feeQort)}</Num> fee
            {balance.data !== undefined ? (
              <>
                {' '}
                (you have <Num>{formatQort(balance.data)}</Num>
                {balance.data < feeQort ? ': ask someone you know to send you a little QORT' : ''})
              </>
            ) : null}
            .
          </HeroText>
        )}
      </Hero>
      <FindNominatorDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        address={status.address}
        name={name}
      />
    </>
  );
}
