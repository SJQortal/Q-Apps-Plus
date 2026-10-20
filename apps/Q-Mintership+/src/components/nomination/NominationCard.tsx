/**
 * One nomination, as everyone sees it: the nominee, who nominated and who
 * supports (with their notes), the reason and links, and where it stands
 * (waiting for a Minter Admin, k of n approvals with the countdown and any
 * rejections, approved, or how it ended). While it is open, the Minter
 * Admins' answers sit side by side as on Decisions (who approved, rejected
 * or is considering it), for everyone: Decisions itself is only for the
 * admins. Screens add their own buttons through `actions`, and its public
 * comments with `comments`. The community's Yes and No sit beside Copy
 * link, and anyone who isn't a Minter Admin (or the nominee) can vote,
 * where the admins' own buttons are on a decision. Minter Admins also see
 * the nominator's note for the Minter Admins under the reason (AdminNote).
 */
import { useState, type ReactNode } from 'react';
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
import { useCommunityVoter, useCommunityVotes } from '../../hooks/useCommunityVotes';
import { takesVotes } from '../../rules/communityVotes';
import { useInView } from '../../hooks/useInView';
import { AnswerColumns, type AnswerPerson } from '../decision/AnswerColumns';
import { tallyPeople } from '../decision/answerPeople';
import { nominationPath } from '../../routes/paths';
import { Countdown } from '../common/Countdown';
import { CopyLinkButton } from '../common/CopyLinkButton';
import { FramedText } from '../common/FramedText';
import { PersonChip, PersonInline } from '../common/Person';
import { ProgressRing } from '../common/ProgressRing';
import { Card, NominationStateChip } from '../common/Section';
import { CommentsSection } from '../comments/CommentsSection';
import { AdminNote } from '../decision/AdminNote';
import { nominationNoteTarget } from '../../data/adminNotes';
import { tallyBadges, withCommunityBadges } from '../comments/answerBadges';
import { CommunitySummary, CommunityVoteControls } from '../community/CommunityVotes';
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
  lapsed: 'Closed with no Minter Admin approval',
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
  // The community's votes: read while it is open, cast while it still collects approvals.
  const [node, setNode] = useState<HTMLElement | null>(null);
  const nearScreen = useInView(node);
  const voter = useCommunityVoter(takesVotes(n.state, n.decision?.phase) ? n.nominee : null);
  const votes = useCommunityVotes(
    n.state === 'waiting' || n.state === 'signing' || n.state === 'approved'
      ? { nominee: n.nominee, since: n.publishedAt }
      : null,
    { nearScreen, myAddress: voter?.address }
  );
  const voted = votes.tally.yes.length + votes.tally.no.length > 0;
  // The Minter Admins' answers so far: while it collects approvals, or while it waits for
  // the first one with someone considering it.
  const answers = tallyPeople(n.state === 'signing' ? tally : null);
  const consideringPeople: AnswerPerson[] = considering.people.map((p) => ({
    address: p.address,
    name: p.name,
    note: p.note,
  }));
  const showAnswers =
    (n.state === 'signing' || n.state === 'waiting') &&
    answers.approved.length + answers.rejected.length + consideringPeople.length > 0;
  return (
    <Card
      ref={setNode}
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

      {n.nomination ? (
        <FramedText
          text={n.nomination.record.reason}
          links={n.nomination.record.links}
          moreLabel="Show the whole reason"
          compact={compact}
        />
      ) : null}

      {n.nomination ? (
        <AdminNote
          target={nominationNoteTarget(n)}
          near={nearScreen}
          label={`The nomination of ${nominee.label}`}
          addable={n.state === 'waiting' || n.state === 'signing'}
        />
      ) : null}

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

      {showAnswers ? (
        <AnswerColumns
          approved={answers.approved}
          rejected={answers.rejected}
          considering={consideringPeople}
          headingLevel="h3"
          phoneLimit={3}
          label={`the Minter Admins’ answers on ${nominee.label}`}
        />
      ) : null}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
        {/* No "left to approve" once the count has decided it (as on the hero and decision cards). */}
        {n.state === 'signing' &&
        window &&
        n.decision?.phase !== 'rejectedMet' &&
        n.decision?.phase !== 'thresholdMet' ? (
          <Countdown
            now={now}
            height={window.lastUsefulSignatureHeight}
            suffix="left to approve"
            doneText="Time to approve is over"
            blockLabel="Last block an approval counts in:"
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
        {n.state === 'signing' && !window ? (
          <Typography variant="body2" color="text.secondary">
            On its way into a block; the clock starts then.
          </Typography>
        ) : null}
        {n.state === 'waiting' && n.waitingEndsAt ? (
          <Typography variant="body2" color="text.secondary">
            Waiting for a Minter Admin’s first approval:{' '}
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
        {copyLink || actions || voted || (voter && votes.mine) ? (
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {actions}
            {voter && votes.mine ? (
              <CommunityVoteControls
                nominee={n.nominee}
                label={nominee.label}
                mine={votes.mine}
                signer={voter}
              />
            ) : null}
            {/* After the screen's own actions: the link is the quieter one. */}
            {copyLink ? (
              <CopyLinkButton
                variant="text"
                path={nominationPath(n.nominee)}
                what={`the nomination of ${nominee.label}`}
              />
            ) : null}
            <CommunitySummary tally={votes.tally} label={nominee.label} />
          </Box>
        ) : null}
      </Box>

      {comments ? (
        <CommentsSection
          target={nominationCommentTarget(n)}
          label={`the nomination of ${nominee.label}`}
          answers={withCommunityBadges(tallyBadges(tally, considering.people), votes.tally)}
          defaultOpen={comments === 'open'}
        />
      ) : null}
    </Card>
  );
}
