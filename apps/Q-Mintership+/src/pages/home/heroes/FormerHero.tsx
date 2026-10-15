/**
 * Former members (and accounts removed before they ever joined): when it
 * happened, who proposed it and why, that the level stays, and what it
 * takes to come back. After a kick or leaving: a new nomination, which
 * nominators often start themselves, and they can show they're ready to
 * mint again (MINTER's join request). During a ban: the Minter Admins
 * lifting it first. A ban that ended or was lifted says so, with its date,
 * not "removed from MINTER".
 */
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Button } from '@mui/material';
import { NOMINATOR_MIN_LEVEL } from '../../../data/constants';
import { personPath } from '../../../routes/paths';
import { banEnd, type MyStatus } from '../../../rules/status';
import { formatCount, formatDate, formatDateTime, formatRelative } from '../../../utils/format';
import { Hero, HeroText, Num, PersonLink } from '../Hero';
import { ReadyButton, ReadyDialog, ReadyDone, ReadyNext, ReadyUnknown, ShareButton } from './ready';
import { useReadyToMint, type ReadyToMint } from './useReadyToMint';

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

/** The way back after a kick or leaving: a new nomination, and showing they're ready. */
function ComeBack({ ready }: { ready: ReadyToMint }) {
  if (ready.ready) {
    return (
      <>
        <ReadyDone ready={ready} />
        <HeroText muted>
          {ready.confirming
            ? 'Your join request is on its way into a block. Then nominators and Minter Admins can see that you’d like to mint again.'
            : 'Your join request is open, so nominators and Minter Admins can see that you’d like to mint again.'}{' '}
          It can&rsquo;t be withdrawn: it stays open until you&rsquo;re approved, or Minter Admins
          remove it.
        </HeroText>
      </>
    );
  }
  return (
    <>
      <HeroText>
        A new nomination is possible. Nominators, minters at level {NOMINATOR_MIN_LEVEL} or above,
        look for people who&rsquo;d make good minters, and often reach out first. You can also show
        you&rsquo;re ready to mint: then an approved nomination makes you a member at once.
      </HeroText>
      <ReadyUnknown ready={ready} />
    </>
  );
}

/** Show you're ready (until it's done), share the name or address, and the history. */
function comeBackActions(ready: ReadyToMint, status: MyStatus, historyLink: ReactNode) {
  return (
    <>
      {ready.ready ? null : <ReadyButton ready={ready} />}
      <ShareButton status={status} />
      {historyLink}
    </>
  );
}

const NOMINATED_NEXT =
  'When someone nominates you, this page shows who did, and how the Minter Admins answer.';

export function FormerHero({ status, needed }: { status: MyStatus; needed: number | null }) {
  const ready = useReadyToMint(status);
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
          one of them proposes it, and it needs {needed ? <Num>{needed}</Num> : 'enough'} approvals
          like any decision. After that, a new nomination is possible.
        </HeroText>
        <LevelKept status={status} />
      </Hero>
    );
  }

  if (status.kind === 'formerLeft') {
    return (
      <>
        <Hero
          eyebrow="Former member"
          title={name ? `${name}, you left MINTER` : 'You left MINTER'}
          actions={comeBackActions(ready, status, historyLink)}
          next={ready.ready ? <ReadyNext needed={needed} /> : NOMINATED_NEXT}
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
          <ComeBack ready={ready} />
        </Hero>
        <ReadyDialog ready={ready} needed={needed} />
      </>
    );
  }

  // formerKicked: an approved kick, or a ban that has since ended or been lifted.
  const end = removal ? banEnd(removal) : null;
  const title = end
    ? end.how === 'lifted'
      ? 'Your ban from MINTER was lifted'
      : 'Your ban from MINTER has ended'
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
        actions={comeBackActions(ready, status, historyLink)}
        next={ready.ready ? <ReadyNext needed={needed} /> : NOMINATED_NEXT}
      >
        {removal ? (
          <HeroText>
            {end
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
            {end ? (
              end.at === null ? (
                ' That ban has ended.'
              ) : (
                <>
                  {' '}
                  {end.how === 'lifted' ? 'The Minter Admins lifted it' : 'The ban ended'}{' '}
                  <When at={end.at} />.
                </>
              )
            ) : null}
          </HeroText>
        ) : null}
        <Reason reason={removal?.reason} />
        <LevelKept status={status} />
        <ComeBack ready={ready} />
      </Hero>
      <ReadyDialog ready={ready} needed={needed} />
    </>
  );
}
