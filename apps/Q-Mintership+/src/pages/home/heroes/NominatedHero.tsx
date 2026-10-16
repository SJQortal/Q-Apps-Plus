/**
 * Someone nominated this account: who (and who supports it), where it
 * stands (waiting for a first Minter Admin, or k of n with the time left
 * to sign, how many Minter Admins have said no so far, in gentle words,
 * and how many are considering it),
 * and Accept, which sends the join request so approval makes the nominee a
 * member at once. With a join request open, however it was sent:
 * "You're ready ✓: when the admins approve, you're in at once."
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
import { nominationPath } from '../../../routes/paths';
import type { MyStatus } from '../../../rules/status';
import { signerOf, useSession } from '../../../state/session';
import { formatDuration, formatRelative, plural } from '../../../utils/format';
import { usePendingWrite, writeKeys } from '../../../writes/optimistic';
import { Hero, HeroText, Num, PeopleList, PersonLink } from '../Hero';
import { LazyJoinDialog } from '../../../components/nomination/LazyJoinDialog';
import { readable } from '../../../utils/readable';
import { useConsideringFor } from '../../../hooks/useConsidering';
import { consideringCountText } from '../../../rules/considering';
import { READY_DONE, READY_DONE_NEXT } from '../../../constants/words';
import { whenApplied } from '../../decisions/decisionUi';
import { MarkedName } from '../../../components/common/MarkedName';

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
  const considering = useConsideringFor(
    {
      pendingSignature: n.decision?.signature ?? null,
      nomineeAddress: n.nominee,
      since: n.publishedAt,
    },
    tally,
    { enabled: n.state === 'waiting' || n.state === 'signing' }
  ).people.length;
  // When Core applies it: the next block, or later while it is just proposed.
  const when = n.decision && now.data ? whenApplied(n.decision, now.data) : 'in the next block';
  const needNow = tally?.needed ?? needed;
  const by = n.nomination?.publisher ?? null;
  const supporters = n.supporters.map((s) => s.publisher);
  const proposer = by ? null : (n.decision?.creatorAddress ?? null);
  const feeQort = fee.data?.qort ?? 0.01;
  // Nothing to accept once enough Minter Admins have rejected it.
  const short = !accepted && !rejectedEnd && balance.data !== undefined && balance.data < feeQort;
  const inFlight = tally ? tally.inFlight.filter((d) => d.approval).length : 0;
  const name = status.name;

  const title = met
    ? 'Enough Minter Admins have approved'
    : rejectedEnd
      ? "Your nomination won't go through this time"
      : signing
        ? name
          ? `${name}, your nomination is collecting approvals`
          : 'Your nomination is collecting approvals'
        : name
          ? `${name}, you've been nominated for MINTER`
          : "You've been nominated for MINTER";

  const next = rejectedEnd
    ? `It closes ${when}. Your account and your level stay as they are, and you can be nominated again later.`
    : !accepted
      ? `Accept, then wait for the Minter Admins: ${needNow ? `at ${needNow} approvals` : 'once enough have approved'} you're in, with no further step.`
      : met
        ? `You're added to MINTER ${when}. Nothing more to do.`
        : signing
          ? `At ${needNow ? `${needNow} approvals` : 'enough approvals'} you're added to MINTER automatically: nothing more to do. If time runs out, you can be nominated again.`
          : `When a Minter Admin approves first, the clock starts; at ${needNow ? `${needNow} approvals` : 'enough approvals'} you're added automatically.`;

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
            {accepted || rejectedEnd ? null : (
              <Button
                variant="contained"
                startIcon={<HowToRegOutlinedIcon />}
                disabled={!signer || pending?.status === 'sending'}
                onClick={() => setDialogOpen(true)}
              >
                Accept nomination
              </Button>
            )}
            <Button component={RouterLink} to={nominationPath(status.address)}>
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
            <Num>{tally.approvalCount}</Num> of <Num>{tally.needed}</Num> approvals so far
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
        {/* The nominee's own words for rejections: the same numbers, said gently. */}
        {signing && tally && rejections > 0 && !met ? (
          <HeroText muted>
            {rejectedEnd ? (
              <>
                <Num>{rejections}</Num> Minter Admins have said no, as many as it takes to end it.
              </>
            ) : (
              <>
                <Num>{plural(rejections, 'Minter Admin')}</Num> {rejections === 1 ? 'has' : 'have'}{' '}
                said no so far; it needs <Num>{tally.needed}</Num> to end it, and approvals are
                counted first.
              </>
            )}
          </HeroText>
        ) : null}
        {considering > 0 && !met && !rejectedEnd ? (
          <HeroText>
            {consideringCountText(considering)}: they&rsquo;ve looked at it and haven&rsquo;t
            decided yet.
          </HeroText>
        ) : null}
        {signing && window && !met && !rejectedEnd && now.data ? (
          <Box>
            <Countdown
              now={now.data}
              height={window.lastUsefulSignatureHeight}
              suffix="left to approve"
              doneText="Time to approve is over"
              blockLabel="Last block an approval counts in:"
              detailVisible
            />
          </Box>
        ) : null}
        {signing && !window ? (
          <HeroText muted>
            The first Minter Admin&rsquo;s approval is on its way into a block; the clock starts
            then.
          </HeroText>
        ) : null}
        {n.state === 'waiting' ? (
          <HeroText>
            It&rsquo;s waiting for a Minter Admin to approve first.
            {n.waitingEndsAt ? (
              <>
                {' '}
                It stays open for{' '}
                <Num>{formatDuration(n.waitingEndsAt - nowMs, { precise: true })}</Num> more; if no
                admin approves by then, it moves to History and you can be nominated again.
              </>
            ) : null}
          </HeroText>
        ) : null}

        {accepted ? (
          <Typography role="status" sx={{ fontWeight: 700, color: readable('success') }}>
            {READY_DONE}
            {confirming ? ' (confirming…)' : ''}
            {met || rejectedEnd ? '' : `: ${READY_DONE_NEXT}`}
          </Typography>
        ) : rejectedEnd ? null : (
          <HeroText>
            Accept now so you join the moment you&rsquo;re approved. It sends a join request to
            MINTER, with a <Num>{formatQort(feeQort)}</Num> fee.
          </HeroText>
        )}
        {short ? (
          <Alert severity="warning">
            Your confirmed balance is <Num>{formatQort(balance.data ?? 0)}</Num>. Ask{' '}
            {by ? <MarkedName name={by.name} /> : 'someone you know on Qortal'} or a friend to send
            you a little QORT ({formatQort(feeQort)} covers the fee), then accept.
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
