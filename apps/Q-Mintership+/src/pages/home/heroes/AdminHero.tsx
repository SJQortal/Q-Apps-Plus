/**
 * Minter Admins: how many decisions wait for their signature, how long the
 * most urgent one has left, how many signatures decide each one right now
 * (and why that number moved, when it did), and Review decisions.
 */
import { Link as RouterLink } from 'react-router-dom';
import { Button } from '@mui/material';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import { heightToTime, type ChainNow } from '../../../data/chain';
import { ErrorState, HeroSkeleton } from '../../../components/common/states';
import { useDecisions, useNominations } from '../../../hooks/useData';
import { useDisplayName } from '../../../hooks/useDisplayName';
import { decisionPath } from '../../../routes/paths';
import { KIND_LABEL, type Decision } from '../../../rules/decision';
import type { MyStatus } from '../../../rules/status';
import { formatDuration, plural } from '../../../utils/format';
import { Hero, HeroText, Num } from '../Hero';
import { adminSummary, useSendingSignature, type NeededSignatures } from '../homeData';

function MostUrgent({ decision: d, now }: { decision: Decision; now: ChainNow }) {
  const subject = useDisplayName(d.subject ?? '', d.subject ? undefined : null);
  // Time left as the live countdowns measure it: the block's estimated time, minus now.
  const left = d.window
    ? Math.max(0, heightToTime(now, d.window.lastUsefulSignatureHeight) - Date.now())
    : null;
  return (
    <HeroText>
      The most urgent, &ldquo;{KIND_LABEL[d.kind]}
      {d.subject ? `: ${subject.label}` : ''}&rdquo;,{' '}
      {left !== null ? (
        <>
          has <Num>{formatDuration(left, { precise: true })}</Num> left to sign.
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
      Each decision needs <Num>{needed.needed}</Num> signatures right now
      {needed.percent !== null && needed.adminSeats !== null ? (
        <>
          {' '}
          ({needed.percent}% of {needed.adminSeats} admin seats)
        </>
      ) : null}
      .
      {needed.changedFrom !== null ? (
        <>
          {' '}
          That&rsquo;s {needed.needed > needed.changedFrom ? 'up' : 'down'} from{' '}
          <Num>{needed.changedFrom}</Num> on your last visit, because the number of Minter Admins
          changed.
        </>
      ) : null}
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

  const summary = adminSummary(decisions.data, publicKey, sending);
  const count = summary.waiting.length;
  const firstSignature = nominations.data?.open.filter((n) => n.state === 'waiting').length ?? 0;
  const name = status.name;
  const title = count
    ? `${name ? `${name}, ` : ''}${plural(count, 'decision')} ${count === 1 ? 'is' : 'are'} waiting for your signature`
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
      next="There's no reject button: if you don't support something, don't sign it and it runs out. A signature can't be withdrawn, because on chain that would count as a rejection."
    >
      {count ? (
        <MostUrgent decision={summary.waiting[0]} now={decisions.data.now} />
      ) : (
        <HeroText>Nothing is waiting for your signature right now.</HeroText>
      )}
      {firstSignature ? (
        <HeroText>
          <Num>{firstSignature}</Num> nomination{firstSignature === 1 ? ' is' : 's are'} waiting for
          a first signature.
        </HeroText>
      ) : null}
      <NeededLine needed={needed} />
    </Hero>
  );
}
