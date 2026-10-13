/**
 * Someone nominated this account: who (and who supports it), where it
 * stands (waiting for a first Minter Admin, or k of n with the time left
 * to sign, and any rejections), and Accept, which sends the join request so
 * approval makes the nominee a member at once. Once accepted: "You've
 * accepted ✓".
 */
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Typography } from '@mui/material';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import { formatQort } from '../../../data/accounts';
import type { Nomination } from '../../../data/nominations';
import { Countdown } from '../../../components/common/Countdown';
import { ProgressRing } from '../../../components/common/ProgressRing';
import { useBalance, useChainNow } from '../../../hooks/useData';
import { useFee } from '../../../hooks/useFee';
import { personPath } from '../../../routes/paths';
import type { MyStatus } from '../../../rules/status';
import { signerOf, useSession } from '../../../state/session';
import { formatDuration, formatRelative, plural } from '../../../utils/format';
import { usePendingWrite, writeKeys } from '../../../writes/optimistic';
import { Hero, HeroText, Num, PeopleList, PersonLink } from '../Hero';
import { LazyJoinDialog } from '../../../components/nomination/LazyJoinDialog';
import { readable } from '../../../utils/readable';
import { whenApplied } from '../../decisions/decisionUi';

export function NominatedHero({
  status,
  nomination: n,
  needed,
}: {
  status: MyStatus;
  nomination: Nomination;
  needed: number | null;
}) {
  const session = useSession();
  const signer = signerOf(session);
  const now = useChainNow();
  const fee = useFee('JOIN_GROUP');
  const balance = useBalance(status.address);
  const pending = usePendingWrite(writeKeys.join(status.address));
  const [dialogOpen, setDialogOpen] = useState(false);

  const nowMs = Date.now();
  const accepted = status.hasJoinRequest || n.hasJoinRequest || pending?.status === 'confirming';
  const confirming =
    !status.hasJoinRequest && !n.hasJoinRequest && pending?.status === 'confirming';
  const tally = n.decision?.tally ?? null;
  const window = n.decision?.window ?? null;
  const signing = n.state === 'signing';
  const met = Boolean(tally?.met) || n.decision?.phase === 'thresholdMet';
  // Enough rejections: Core ends it as rejected in its next decision block.
  const rejectedEnd = !met && n.decision?.phase === 'rejectedMet';
  const rejections = tally?.rejectionCount ?? 0;
  // When Core applies it: the next block, or later while it is just proposed.
  const when = n.decision && now.data ? whenApplied(n.decision, now.data) : 'in the next block';
  const needNow = tally?.needed ?? needed;
  const by = n.nomination?.publisher ?? null;
  const supporters = n.supporters.map((s) => s.publisher);
  const proposer = by ? null : (n.decision?.creatorAddress ?? null);
  const feeQort = fee.data?.qort ?? 0.01;
  const short = !accepted && balance.data !== undefined && balance.data < feeQort;
  const inFlight = tally ? tally.inFlight.filter((d) => d.approval).length : 0;
  const name = status.name;

  const title = met
    ? 'Enough Minter Admins have signed'
    : rejectedEnd
      ? 'Enough Minter Admins have rejected your nomination'
      : signing
        ? name
          ? `${name}, Minter Admins are signing your nomination`
          : 'Minter Admins are signing your nomination'
        : name
          ? `${name}, you've been nominated for MINTER`
          : "You've been nominated for MINTER";

  const next = rejectedEnd
    ? `It ends as rejected ${when}. You can be nominated again later.`
    : !accepted
      ? `Accept, then wait for the Minter Admins: ${needNow ? `at ${needNow} signatures` : 'once enough have signed'} you're in, with no further step.`
      : met
        ? `You're added to MINTER ${when}. Nothing more to do.`
        : signing
          ? `At ${needNow ? `${needNow} signatures` : 'enough signatures'} you're added to MINTER automatically: nothing more to do. If time runs out, you can be nominated again.`
          : `When a Minter Admin signs first, the clock starts; at ${needNow ? `${needNow} signatures` : 'enough signatures'} you're added automatically.`;

  return (
    <>
      <Hero
        eyebrow="You've been nominated"
        title={title}
        aside={
          tally && signing ? (
            <ProgressRing
              value={tally.approvalCount}
              target={tally.needed}
              pending={inFlight}
              size={64}
            />
          ) : undefined
        }
        actions={
          <>
            {accepted ? null : (
              <Button
                variant="contained"
                startIcon={<HowToRegOutlinedIcon />}
                disabled={!signer || pending?.status === 'sending'}
                onClick={() => setDialogOpen(true)}
              >
                Accept nomination
              </Button>
            )}
            <Button component={RouterLink} to={personPath(status.address)}>
              See your nomination
            </Button>
          </>
        }
        next={next}
      >
        {by ? (
          <HeroText>
            Nominated by <PersonLink address={by.address} name={by.name} />{' '}
            {formatRelative(n.publishedAt, nowMs)}
            {supporters.length ? (
              <>
                , also supported by <PeopleList people={supporters} />
              </>
            ) : null}
            .
          </HeroText>
        ) : proposer ? (
          <HeroText>
            Minter Admin <PersonLink address={proposer} /> proposed you on chain{' '}
            {formatRelative(n.publishedAt, nowMs)}.
          </HeroText>
        ) : null}

        {signing && tally ? (
          <HeroText>
            <Num>{tally.approvalCount}</Num> of <Num>{tally.needed}</Num> signatures so far
            {inFlight ? (
              <>
                , <Num>{inFlight}</Num> more confirming
              </>
            ) : null}
            .
            {met ? (
              accepted ? (
                ` That's enough: you're added to MINTER ${when}.`
              ) : (
                ` That's enough: once it's applied ${when}, press Join now to finish.`
              )
            ) : rejectedEnd ? null : (
              <>
                {' '}
                <Num>{Math.max(0, tally.needed - tally.projectedApprovalCount)}</Num> more needed
                before time runs out.
              </>
            )}
          </HeroText>
        ) : null}
        {signing && tally && rejections > 0 && !met ? (
          <HeroText muted>
            {rejectedEnd ? (
              <>
                <Num>{rejections}</Num> Minter Admins have rejected it, as many as the{' '}
                <Num>{tally.needed}</Num> that end it.
              </>
            ) : (
              <>
                <Num>{plural(rejections, 'Minter Admin')}</Num> {rejections === 1 ? 'has' : 'have'}{' '}
                rejected it so far. It ends as rejected only if <Num>{tally.needed}</Num> do, and
                signatures are counted first.
              </>
            )}
          </HeroText>
        ) : null}
        {signing && window && !met && !rejectedEnd && now.data ? (
          <Box>
            <Countdown
              now={now.data}
              height={window.lastUsefulSignatureHeight}
              suffix="left to sign"
              doneText="Signing time is over"
              blockLabel="Last block a signature counts in:"
              detailVisible
            />
          </Box>
        ) : null}
        {signing && !window ? (
          <HeroText muted>
            The first Minter Admin&rsquo;s signature is on its way into a block; the clock starts
            then.
          </HeroText>
        ) : null}
        {n.state === 'waiting' ? (
          <HeroText>
            It&rsquo;s waiting for a Minter Admin to sign first.
            {n.waitingEndsAt ? (
              <>
                {' '}
                It stays open for{' '}
                <Num>{formatDuration(n.waitingEndsAt - nowMs, { precise: true })}</Num> more; if no
                admin signs by then, it moves to History and you can be nominated again.
              </>
            ) : null}
          </HeroText>
        ) : null}

        {accepted ? (
          <Typography role="status" sx={{ fontWeight: 700, color: readable('success') }}>
            You&rsquo;ve accepted ✓{confirming ? ' (confirming…)' : ''}
          </Typography>
        ) : (
          <HeroText>
            Accept now so you join the moment you&rsquo;re approved. It sends a join request to
            MINTER, with a <Num>{formatQort(feeQort)}</Num> fee.
          </HeroText>
        )}
        {accepted && !met ? (
          <HeroText muted>
            Your join request is in, so you join MINTER the moment the last needed signature lands.
          </HeroText>
        ) : null}
        {short ? (
          <Alert severity="warning">
            Your confirmed balance is <Num>{formatQort(balance.data ?? 0)}</Num>. Ask{' '}
            {by ? by.name : 'someone you know on Qortal'} or a friend to send you a little QORT (
            {formatQort(feeQort)} covers the fee), then accept.
          </Alert>
        ) : null}
        {!accepted && pending?.status === 'failed' ? (
          <Alert severity="warning">
            {pending.message ??
              "Your join request hasn't shown up yet. Check again in a minute before trying again."}
          </Alert>
        ) : null}
      </Hero>
      {signer ? (
        <LazyJoinDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          mode="accept"
          signer={signer}
          needed={needNow}
          askWho={by?.name ?? null}
        />
      ) : null}
    </>
  );
}
