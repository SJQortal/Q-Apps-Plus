/**
 * Former members (and accounts removed before they ever joined): when it
 * happened, who proposed it and why, that the level stays, and what it
 * takes to come back: a new nomination, or for a ban, the Minter Admins
 * lifting it first.
 */
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Button } from '@mui/material';
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined';
import { NOMINATOR_MIN_LEVEL } from '../../../data/constants';
import { personPath } from '../../../routes/paths';
import type { MyStatus } from '../../../rules/status';
import { formatCount, formatDate, formatDateTime, formatRelative } from '../../../utils/format';
import { FindNominatorDialog } from '../HelpDialogs';
import { Hero, HeroText, Num, PersonLink } from '../Hero';

function When({ at }: { at: number }) {
  return (
    <>
      on <Num>{formatDate(at)}</Num> ({formatRelative(at)})
    </>
  );
}

function LevelKept({ status }: { status: MyStatus }) {
  if (status.level <= 0 && status.blocksMinted <= 0) return null;
  return (
    <HeroText>
      You keep your level: you&rsquo;re level <Num>{status.level}</Num> with{' '}
      <Num>{formatCount(status.blocksMinted)}</Num> blocks minted.
    </HeroText>
  );
}

function Reason({ reason }: { reason?: string }) {
  if (!reason?.trim()) return null;
  return <HeroText muted>Reason given: &ldquo;{reason.trim()}&rdquo;</HeroText>;
}

const nominateAgain = (
  <HeroText>
    A new nomination is possible: a MINTER member at level {NOMINATOR_MIN_LEVEL} or above, or a
    Minter Admin, can nominate you, and you accept as before.
  </HeroText>
);

export function FormerHero({ status, needed }: { status: MyStatus; needed: number | null }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const name = status.name;
  const removal = status.removal;
  const historyLink = (
    <Button component={RouterLink} to={personPath(status.address)}>
      See your MINTER history
    </Button>
  );

  if (status.kind === 'formerBanned') {
    const ban = status.activeBan;
    // When it took effect (its approval); Core's `banned` is when it was proposed.
    const at = (removal?.kind === 'ban' ? removal.at : null) ?? ban?.banned ?? null;
    const by = ban?.admin ?? removal?.by ?? null;
    return (
      <Hero
        eyebrow={status.wasMember ? 'Former member' : 'Not in MINTER'}
        title={
          name
            ? `${name}, your account is banned from MINTER`
            : 'Your account is banned from MINTER'
        }
        actions={historyLink}
        next="There's nothing to do here until the ban is lifted. After that, this page shows how to be nominated again."
      >
        <HeroText>
          {status.wasMember
            ? 'You were removed and banned'
            : 'The Minter Admins banned this account'}
          {at ? (
            <>
              {' '}
              <When at={at} />
            </>
          ) : null}
          {by ? (
            <>
              , proposed by <PersonLink address={by} />
            </>
          ) : null}
          .{' '}
          {ban?.expiry ? (
            <>
              The ban lasts until <Num>{formatDateTime(ban.expiry)}</Num>.
            </>
          ) : (
            "It's permanent."
          )}
        </HeroText>
        <Reason reason={ban?.reason ?? removal?.reason} />
        <HeroText>
          Before you can {status.wasMember ? 'rejoin' : 'join'}, Minter Admins must lift the ban:
          one of them proposes it, and it needs {needed ? <Num>{needed}</Num> : 'enough'} signatures
          like any decision. After that, a new nomination is possible.
        </HeroText>
        <LevelKept status={status} />
      </Hero>
    );
  }

  if (status.kind === 'formerLeft') {
    return (
      <Hero
        eyebrow="Former member"
        title={name ? `${name}, you left MINTER` : 'You left MINTER'}
        actions={historyLink}
        next="If someone nominates you, this page shows it with an Accept button."
      >
        <HeroText>
          You left MINTER
          {removal ? (
            <>
              {' '}
              <When at={removal.at} />
            </>
          ) : null}
          .
        </HeroText>
        <LevelKept status={status} />
        {nominateAgain}
      </Hero>
    );
  }

  // formerKicked: an approved kick, or a ban that has since ended.
  const endedBan = removal?.kind === 'ban';
  const title = endedBan
    ? 'Your ban from MINTER has ended'
    : status.wasMember
      ? name
        ? `${name}, you were removed from MINTER`
        : 'You were removed from MINTER'
      : "You were removed from MINTER's join list";
  return (
    <>
      <Hero
        eyebrow={status.wasMember ? 'Former member' : 'Not in MINTER'}
        title={title}
        actions={
          <>
            <Button
              variant="contained"
              startIcon={<PersonSearchOutlinedIcon />}
              onClick={() => setHelpOpen(true)}
            >
              See how to be nominated again
            </Button>
            {historyLink}
          </>
        }
        next="If someone nominates you, this page shows it with an Accept button."
      >
        {removal ? (
          <HeroText>
            {endedBan
              ? 'The Minter Admins banned this account'
              : status.wasMember
                ? 'The Minter Admins removed you'
                : 'The Minter Admins approved a removal for this account'}{' '}
            <When at={removal.at} />
            {removal.by ? (
              <>
                , proposed by <PersonLink address={removal.by} />
              </>
            ) : null}
            .
            {endedBan ? (
              removal.liftedAt ? (
                <>
                  {' '}
                  The Minter Admins lifted it <When at={removal.liftedAt} />.
                </>
              ) : removal.banSeconds ? (
                ' That ban has run out.'
              ) : (
                ' That ban has ended.'
              )
            ) : null}
          </HeroText>
        ) : null}
        <Reason reason={removal?.reason} />
        <LevelKept status={status} />
        {nominateAgain}
      </Hero>
      <FindNominatorDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        address={status.address}
        name={name}
        again
      />
    </>
  );
}
