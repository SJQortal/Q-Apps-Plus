/**
 * One nomination, as everyone sees it: the nominee, who nominated and who
 * supports (with their notes), the reason and links, and where it stands
 * (waiting for a Minter Admin, k of n signatures with the countdown and any
 * rejections, how many Minter Admins are considering it, approved, or how
 * it ended). Screens add their own buttons through `actions`, and its
 * public comments with `comments`.
 */
import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import { READY_LABEL } from '../../constants/words';
import type { ChainNow } from '../../data/chain';
import type { Nomination } from '../../data/nominations';
import { nominationCommentTarget } from '../../data/commentThread';
import type { NominationState } from '../../rules/nomination';
import { useDisplayName } from '../../hooks/useDisplayName';
import { formatDuration, formatRelative, plural } from '../../utils/format';
import { whenApplied } from '../../pages/decisions/decisionUi';
import { useConsideringFor } from '../../hooks/useConsidering';
import { ConsideringCount } from '../decision/Considering';
import { nominationPath } from '../../routes/paths';
import { Countdown } from '../common/Countdown';
import { CopyLinkButton } from '../common/CopyLinkButton';
import { QortalLinks } from '../common/QortalLinks';
import { PersonChip, PersonInline } from '../common/Person';
import { ProgressRing } from '../common/ProgressRing';
import { Card, NominationStateChip } from '../common/Section';
import { CommentsSection } from '../comments/CommentsSection';
import { readable } from '../../utils/readable';

export interface NominationCardProps {
  nomination: Nomination;
  now: ChainNow;
  actions?: ReactNode;
  /** Shorter: the reason is clamped and supporters' notes are hidden. */
  compact?: boolean;
  /** Leave out the nominee line (on the nominee's own page). */
  hideNominee?: boolean;
  /** When a decided nomination ended (ms), for "Expired 3 days ago". */
  endedAt?: number | null;
  /** A "Copy link" to the nomination's own page (default; its page has one in the header). */
  copyLink?: boolean;
  /** Its public comments behind a "Comments (n)" toggle; 'open' starts open. */
  comments?: boolean | 'open';
  /** The nominee's own view (their Home, their own page): rejections said gently. */
  forNominee?: boolean;
}

const ENDED_TEXT: Partial<Record<NominationState, string>> = {
  joined: 'Joined MINTER',
  expired: 'Expired',
  rejected: 'Rejected',
  lapsed: 'Closed with no Minter Admin signature',
};

export function NominationCard({
  nomination: n,
  now,
  actions,
  compact,
  hideNominee,
  endedAt,
  copyLink = true,
  comments,
  forNominee,
}: NominationCardProps) {
  const tally = n.decision?.tally ?? null;
  const window = n.decision?.window ?? null;
  const by = n.nomination?.publisher;
  const supporters = n.supporters.map((s) => s.publisher);
  const notes = compact
    ? []
    : n.supporters.flatMap((s) =>
        'note' in s.record && s.record.note ? [{ who: s.publisher, note: s.record.note }] : []
      );
  const ended = ENDED_TEXT[n.state];
  // No name in the record or the member list (a chain-only nomination): look it up.
  const nominee = useDisplayName(n.nominee, n.nomineeName ?? undefined);
  // Read only while it is open: the shared Considering read, filtered for this nomination.
  const considering = useConsideringFor(
    {
      pendingSignature: n.decision?.signature ?? null,
      nomineeAddress: n.nominee,
      since: n.publishedAt,
    },
    tally,
    { enabled: n.state === 'waiting' || n.state === 'signing' }
  );
  return (
    <Card
      as="article"
      aria-label={`Nomination of ${nominee.label}`}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {hideNominee ? null : <PersonChip address={n.nominee} name={nominee.name} size={40} />}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <NominationStateChip state={n.state} />
            {n.hasJoinRequest && (n.state === 'waiting' || n.state === 'signing') ? (
              <Typography
                variant="body2"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  color: readable('success'),
                }}
              >
                <CheckCircleOutlineOutlinedIcon aria-hidden sx={{ fontSize: 18 }} />
                {READY_LABEL}
              </Typography>
            ) : null}
          </Box>
        </Box>
        {tally && n.state === 'signing' ? (
          <ProgressRing
            value={tally.approvalCount}
            target={tally.needed}
            pending={tally.inFlight.filter((d) => d.approval).length}
          />
        ) : null}
      </Box>

      {by ? (
        <Typography component="div" variant="body2" color="text.secondary">
          Nominated by <PersonInline address={by.address} name={by.name} />{' '}
          {formatRelative(n.publishedAt, now.timestamp)}
          {supporters.length ? (
            <>
              , also supported by{' '}
              {supporters.map((p, i) => (
                <span key={p.address}>
                  {i > 0 ? (i === supporters.length - 1 ? ' and ' : ', ') : ''}
                  <PersonInline address={p.address} name={p.name} />
                </span>
              ))}
            </>
          ) : null}
          .
        </Typography>
      ) : n.decision?.creatorAddress ? (
        <Typography component="div" variant="body2" color="text.secondary">
          Proposed on chain by Minter Admin <PersonInline address={n.decision.creatorAddress} />{' '}
          {formatRelative(n.publishedAt, now.timestamp)}.
        </Typography>
      ) : null}

      {n.nomination?.record.reason ? (
        <Typography
          sx={{
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            ...(compact
              ? {
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }
              : {}),
          }}
        >
          {n.nomination.record.reason}
        </Typography>
      ) : null}

      {n.nomination ? <QortalLinks links={n.nomination.record.links} /> : null}

      {notes.length ? (
        <Box
          component="ul"
          aria-label="Supporters' notes"
          sx={{ m: 0, p: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 1 }}
        >
          {notes.map(({ who, note }) => (
            <Box
              component="li"
              key={who.address}
              sx={{ pl: 1.5, borderLeft: 2, borderColor: 'divider', minWidth: 0 }}
            >
              <Typography
                variant="body2"
                sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontStyle: 'italic' }}
              >
                “{note}”
              </Typography>
              <Typography component="div" variant="body2" color="text.secondary">
                <PersonInline address={who.address} name={who.name} />
              </Typography>
            </Box>
          ))}
        </Box>
      ) : null}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
        {/* No "left to sign" once the count has decided it (as on the hero and decision cards). */}
        {n.state === 'signing' &&
        window &&
        n.decision?.phase !== 'rejectedMet' &&
        n.decision?.phase !== 'thresholdMet' ? (
          <Countdown
            now={now}
            height={window.lastUsefulSignatureHeight}
            suffix="left to sign"
            doneText="Signing time is over"
            blockLabel="Last block a signature counts in:"
            detailVisible
          />
        ) : null}
        {n.state === 'signing' && n.decision?.phase === 'rejectedMet' ? (
          <Typography variant="body2" color="text.secondary">
            {forNominee
              ? 'Enough Minter Admins have said no: it closes'
              : 'Enough Minter Admins have rejected it: it ends as rejected'}{' '}
            {whenApplied(n.decision, now)}.
          </Typography>
        ) : n.state === 'signing' && tally?.rejectionCount ? (
          <Typography variant="body2" color="text.secondary">
            {forNominee
              ? `${plural(tally.rejectionCount, 'Minter Admin')} ${tally.rejectionCount === 1 ? 'has' : 'have'} said no so far, of the ${tally.needed} it takes to end it.`
              : `${plural(tally.rejectionCount, 'rejection')} of the ${tally.needed} that would end it.`}
          </Typography>
        ) : null}
        <ConsideringCount count={considering.people.length} />
        {n.state === 'signing' && !window ? (
          <Typography variant="body2" color="text.secondary">
            On its way into a block; the clock starts then.
          </Typography>
        ) : null}
        {n.state === 'waiting' && n.waitingEndsAt ? (
          <Typography variant="body2" color="text.secondary">
            Waiting for a Minter Admin’s first signature:{' '}
            {formatDuration(n.waitingEndsAt - now.timestamp)} left.
          </Typography>
        ) : null}
        {n.state === 'approved' ? (
          <Typography variant="body2" color="text.secondary">
            Approved. They only need to press Join now to become a member.
          </Typography>
        ) : null}
        {ended ? (
          <Typography variant="body2" color="text.secondary">
            {ended}
            {endedAt ? ` ${formatRelative(endedAt, now.timestamp)}` : ''}.
          </Typography>
        ) : null}
        {copyLink || actions ? (
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {actions}
            {/* After the screen's own actions: the link is the quieter one. */}
            {copyLink ? (
              <CopyLinkButton
                variant="text"
                path={nominationPath(n.nominee)}
                what={`the nomination of ${nominee.label}`}
              />
            ) : null}
          </Box>
        ) : null}
      </Box>

      {comments ? (
        <CommentsSection
          target={nominationCommentTarget(n)}
          label={`the nomination of ${nominee.label}`}
          defaultOpen={comments === 'open'}
        />
      ) : null}
    </Card>
  );
}
