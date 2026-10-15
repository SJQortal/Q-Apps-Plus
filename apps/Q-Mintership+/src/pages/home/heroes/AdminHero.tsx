/**
 * Minter Admins: how many decisions wait for their signature, how long the
 * most urgent one has left, how many signatures decide each one right now
 * (and that it moved since Decisions last showed it, with a link there),
 * and Review decisions.
 */
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Button, Link } from '@mui/material';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import { heightToTime, type ChainNow } from '../../../data/chain';
import { ErrorState, HeroSkeleton } from '../../../components/common/states';
import { useDecisions, useNominations } from '../../../hooks/useData';
import { useDisplayName } from '../../../hooks/useDisplayName';
import { decisionPath } from '../../../routes/paths';
import { decisionTitle, type Decision } from '../../../rules/decision';
import type { MyStatus } from '../../../rules/status';
import { formatDuration, plural } from '../../../utils/format';
import { readable } from '../../../utils/readable';
import { readSeenTarget } from '../../decisions/seenTarget';
import { Hero, HeroText, Num } from '../Hero';
import {
  adminSummary,
  useSendingRejection,
  useSendingSignature,
  type NeededSignatures,
} from '../homeData';

function MostUrgent({ decision: d, now }: { decision: Decision; now: ChainNow }) {
  const subject = useDisplayName(d.subject ?? '', d.subject ? undefined : null);
  // Time left as the live countdowns measure it: the block's estimated time, minus now.
  const left = d.window
    ? Math.max(0, heightToTime(now, d.window.lastUsefulSignatureHeight) - Date.now())
    : null;
  return (
    <HeroText>
      The most urgent, &ldquo;{decisionTitle(d)}
      {d.subject ? `: ${subject.label}` : ''}&rdquo;,{' '}
      {left !== null ? (
        <>
          has <Num>{formatDuration(left, { precise: true })}</Num> left to approve.
        </>
      ) : (
        'is next in the queue.'
      )}
    </HeroText>
  );
}

export function NeededLine({ needed }: { needed: NeededSignatures }) {
  if (needed.needed === null) return null;
  return (
    <HeroText>
      Each decision needs <Num>{needed.needed}</Num> approvals right now
      {needed.percent !== null && needed.adminSeats !== null ? (
        <>
          {' '}
          ({needed.percent}% of {needed.adminSeats} admin seats)
        </>
      ) : null}
      .
    </HeroText>
  );
}

/**
 * "The target changed from 9 to 8 signatures since you last looked at
 * Decisions": the target this device last saw on Decisions against today's.
 * Only Decisions keeps that target (and says why it moved); Home only reads
 * it, so the line stays until Decisions is opened again. Nothing before
 * Decisions has been opened on this device.
 */
export function TargetChangedLine({ needed }: { needed: number | null }) {
  const [seen] = useState(() => readSeenTarget());
  if (!seen || needed === null || seen.needed === needed) return null;
  return (
    <HeroText>
      The target changed from <Num>{seen.needed}</Num> to <Num>{needed}</Num>{' '}
      {needed === 1 ? 'approval' : 'approvals'} since you last looked at Decisions.{' '}
      <Link
        component={RouterLink}
        to={decisionPath()}
        underline="always"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          minHeight: 44,
          fontWeight: 600,
          color: readable('primary'),
        }}
      >
        See what changed
      </Link>
    </HeroText>
  );
}

export function AdminHero({
  status,
  publicKey,
  needed,
}: {
  status: MyStatus;
  publicKey: string;
  needed: NeededSignatures;
}) {
  const decisions = useDecisions(true);
  const nominations = useNominations(true);
  const sending = useSendingSignature();
  const rejecting = useSendingRejection();

  if (!decisions.data) {
    if (decisions.isError) {
      return (
        <ErrorState
          title="Couldn't load the decisions waiting for you."
          error={decisions.error}
          onRetry={() => void decisions.refetch()}
        />
      );
    }
    return <HeroSkeleton />;
  }

  const summary = adminSummary(decisions.data, publicKey, sending, rejecting);
  const count = summary.waiting.length;
  const firstSignature = nominations.data?.open.filter((n) => n.state === 'waiting').length ?? 0;
  const name = status.name;
  const title = count
    ? `${name ? `${name}, ` : ''}${plural(count, 'decision')} ${count === 1 ? 'is' : 'are'} waiting for your answer`
    : name
      ? `You're up to date, ${name}`
      : "You're up to date";

  return (
    <Hero
      eyebrow={`Minter Admin · Level ${status.level}`}
      title={title}
      actions={
        <Button
          component={RouterLink}
          to={decisionPath()}
          variant="contained"
          startIcon={<FactCheckOutlinedIcon />}
        >
          Review decisions
        </Button>
      }
      next="Approve what you support. If you don't, reject it or let it run out. Changed your mind after approving? Reject it: only your latest answer counts."
    >
      {count ? (
        <MostUrgent decision={summary.waiting[0]} now={decisions.data.now} />
      ) : (
        <HeroText>Nothing is waiting for your answer right now.</HeroText>
      )}
      {firstSignature ? (
        <HeroText>
          <Num>{firstSignature}</Num> nomination{firstSignature === 1 ? ' is' : 's are'} waiting for
          a first approval.
        </HeroText>
      ) : null}
      <NeededLine needed={needed} />
      <TargetChangedLine needed={needed.needed} />
    </Hero>
  );
}
