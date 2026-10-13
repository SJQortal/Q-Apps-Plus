/**
 * After the fact: the target changed since this device last saw it (the
 * last visit, or the last refresh). Says from what to what, and why (the
 * approved admin changes since, from one bounded read), then which waiting
 * decisions now have enough signatures (or enough rejections) because of
 * it, the soonest to apply first. Minter Admins also read, for each, whether
 * a withdrawal can still count, and by which block. Stays until dismissed.
 */
import { Fragment, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Link, Typography } from '@mui/material';
import { PersonInline } from '../../components/common/Person';
import { formatQort } from '../../data/accounts';
import type { ChainNow } from '../../data/chain';
import { adminChangesKey, loadAdminChangesBetween } from '../../data/targetChanges';
import { useFee } from '../../hooks/useFee';
import { useQuery } from '../../hooks/useQuery';
import type { Decision } from '../../rules/decision';
import {
  effectsBetween,
  shiftDecisionsOf,
  type ApprovedAdminChange,
} from '../../rules/targetShift';
import { describeThreshold, type ApprovalThreshold } from '../../rules/threshold';
import { decisionPath } from '../../routes/paths';
import { formatBlock, plural } from '../../utils/format';
import { stillStoppable, whenApplied } from './decisionUi';
import type { TargetChange } from './seenTarget';
import {
  changeReason,
  reasonWords,
  seatChange,
  targetChangedTitle,
  withdrawAdvice,
  type LabelOf,
} from './targetShiftUi';

export interface TargetChangedBannerProps {
  change: TargetChange;
  decisions: Decision[];
  threshold: ApprovalThreshold;
  now: ChainNow;
  maximumBlockDelay: number;
  labelOf: LabelOf;
  /** Minter Admins also read what a withdrawal does. */
  isAdmin: boolean;
  onDismiss: () => void;
}

export function TargetChangedBanner({
  change: { from, to },
  decisions,
  threshold,
  now,
  maximumBlockDelay,
  labelOf,
  isAdmin,
  onDismiss,
}: TargetChangedBannerProps) {
  const fee = useFee('GROUP_APPROVAL');
  const read = from.height > 0 && to.height > from.height;
  const changes = useQuery(read ? adminChangesKey(from.height, to.height) : null, (force) =>
    loadAdminChangesBetween(from.height, to.height, maximumBlockDelay, { force })
  );
  const approved = changes.data?.complete ? changes.data.changes : null;
  const reason = changeReason(from.adminCount, to.adminCount, approved);

  const byId = new Map(decisions.map((d) => [d.signature, d]));
  const effects = effectsBetween(
    threshold,
    from.adminCount,
    to.adminCount,
    shiftDecisionsOf(decisions)
  );
  const soonest = (sig: string) => byId.get(sig)?.applyAtHeight ?? Number.MAX_SAFE_INTEGER;
  // Most at risk first: the soonest to apply.
  const applies = effects
    .filter((e) => e.effect === 'applies')
    .sort((a, b) => soonest(a.signature) - soonest(b.signature));
  const rejected = effects.filter((e) => e.effect === 'rejected');
  const flipped = applies.length + rejected.length > 0;
  const moved = from.needed !== to.needed;
  // A withdrawal sent now counts from two blocks on: only those Core applies
  // no sooner than that can still be stopped.
  const stoppable = applies
    .map((e) => byId.get(e.signature))
    .filter((d): d is Decision => Boolean(d && stillStoppable(d, now)));
  const appliesAfter = (d: Decision | undefined): string => {
    if (!d) return '';
    const when = `Applies ${whenApplied(d, now)}`;
    if (!isAdmin) return `${when}.`;
    if (stillStoppable(d, now))
      return `${when}; a withdrawal must be in ${formatBlock((d.applyAtHeight as number) - 1)} or earlier to count.`;
    return `${when}; a withdrawal now would arrive too late to count.`;
  };

  const because: ReactNode =
    reason.complete && approved ? (
      <>
        because {reasonWords(reason)} (<Names changes={approved} />)
      </>
    ) : (
      <>because {seatChange(from.adminCount, to.adminCount)}</>
    );

  return (
    <Alert
      severity={flipped ? 'warning' : 'info'}
      role="status"
      sx={{ '& .MuiAlert-message': { minWidth: 0, width: '100%' }, overflowWrap: 'anywhere' }}
    >
      <Typography sx={{ fontWeight: 700 }}>{targetChangedTitle(from.needed, to.needed)}</Typography>
      <Typography component="div" variant="body2" sx={{ mt: 0.5 }}>
        {moved ? 'It changed ' : 'They changed '}
        {because}. The target is {describeThreshold(threshold)}, recounted every block
        {moved ? '' : `: it stays at ${plural(to.needed, 'signature')}`}.
      </Typography>

      {applies.length ? (
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2">
            {applies.length === 1
              ? 'This decision now has enough signatures because of it, so Core applies it without a new signature:'
              : 'These decisions now have enough signatures because of it, so Core applies them without a new signature:'}
          </Typography>
          <DecisionLinks
            items={applies.map((e) => ({
              signature: e.signature,
              text: `${labelOf(e.signature)}, ${e.approvals} of ${to.needed}`,
              after: appliesAfter(byId.get(e.signature)),
            }))}
          />
        </Box>
      ) : null}
      {rejected.length ? (
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2">
            {rejected.length === 1
              ? 'This decision now has enough rejections, so it ends as rejected:'
              : 'These decisions now have enough rejections, so they end as rejected:'}
          </Typography>
          <DecisionLinks
            items={rejected.map((e) => ({
              signature: e.signature,
              text: `${labelOf(e.signature)}, ${plural(e.rejections, 'rejection')}`,
              after: `Ends ${whenApplied({ applyAtHeight: decidedAt(byId.get(e.signature), now) }, now)}.`,
            }))}
          />
        </Box>
      ) : null}
      {!flipped ? (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {to.needed > from.needed
            ? 'Each decision still collecting needs more signatures than before.'
            : 'No waiting decision has enough signatures because of it.'}
        </Typography>
      ) : null}
      {stoppable.length && isAdmin ? (
        <Typography variant="body2" sx={{ mt: 1 }}>
          {withdrawAdvice(
            formatQort(fee.data?.qort ?? 0.01),
            formatBlock(Math.min(...stoppable.map((d) => (d.applyAtHeight as number) - 1)))
          )}
        </Typography>
      ) : null}
      <Button onClick={onDismiss} sx={{ mt: 1, minHeight: 44, ml: -1 }}>
        Got it
      </Button>
    </Alert>
  );
}

/** The block Core can next decide it in (its earliest decision block at the soonest). */
function decidedAt(d: Decision | undefined, now: ChainNow): number | null {
  return d?.window ? Math.max(now.height + 1, d.window.earliestDecisionHeight) : null;
}

function Names({ changes }: { changes: ApprovedAdminChange[] }) {
  const added = changes.filter((c) => c.added);
  const removed = changes.filter((c) => !c.added);
  const list = (items: ApprovedAdminChange[]) =>
    items.map((c, i) => (
      <Fragment key={c.signature ?? `${c.address}:${c.height}`}>
        {i > 0 ? (i === items.length - 1 ? ' and ' : ', ') : ''}
        <PersonInline address={c.address} />
      </Fragment>
    ));
  if (added.length && removed.length)
    return (
      <>
        added: {list(added)}; removed: {list(removed)}
      </>
    );
  return <>{list(changes)}</>;
}

function DecisionLinks({
  items,
}: {
  items: Array<{ signature: string; text: string; after: string }>;
}) {
  return (
    <Box component="ul" sx={{ m: 0, pl: 2.5, typography: 'body2' }}>
      {items.map((item) => (
        <li key={item.signature}>
          <Link
            component={RouterLink}
            to={decisionPath(item.signature)}
            sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 44 }}
          >
            {item.text}
          </Link>
          {item.after ? (
            <Box component="span" sx={{ display: 'block', mt: -0.5 }}>
              {item.after}
            </Box>
          ) : null}
        </li>
      ))}
    </Box>
  );
}
