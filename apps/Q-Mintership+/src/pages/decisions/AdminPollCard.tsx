/**
 * One Minter Admin poll: the question and its details, who asked (and who
 * shared it, when the viewer reads a share's copy), when it ends, who voted
 * Yes, No and Neutral in three columns (as a decision's answers), the
 * viewer's own vote with the
 * buttons to vote or change it (each one Hub step), "Share with N Minter
 * Admins added since", Copy link and the encrypted comments. Advisory only:
 * there is no pass or fail.
 */
import { lazy, Suspense, useId, useState, type ReactNode } from 'react';
import { Box, Button, Chip, Typography } from '@mui/material';
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import ExpandLessOutlinedIcon from '@mui/icons-material/ExpandLessOutlined';
import ExpandMoreOutlinedIcon from '@mui/icons-material/ExpandMoreOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import RemoveCircleOutlineOutlinedIcon from '@mui/icons-material/RemoveCircleOutlineOutlined';
import { CopyLinkButton } from '../../components/common/CopyLinkButton';
import { PersonInline } from '../../components/common/Person';
import { PeopleColumns, type ColumnTone } from '../../components/decision/AnswerColumns';
import { Card, ToneChip } from '../../components/common/Section';
import { ListSkeleton } from '../../components/common/states';
import { DoneChip } from '../../components/decision/DecisionParts';
import { POLL_VOTES, type PollVote } from '../../data/adminPollRecords';
import { adminPollPath } from '../../routes/paths';
import type { PendingShare, PendingVote } from '../../state/adminPolls';
import { usePendingPollWrites } from '../../state/adminPolls';
import { formatCount, formatRelative, plural } from '../../utils/format';
import type { PollAuthor } from '../../writes/adminPolls';
import { NeedsName } from './NeedsName';
import {
  ADVISORY,
  CLOSING_TEXT,
  MY_LATE_TEXT,
  VOTE_LABEL,
  adminPollCardId,
  endBlockText,
  endText,
  myVoteView,
  notVotedText,
  shareLabel,
  unlistedText,
  unreadText,
  voteClosing,
  type ShownPoll,
} from './adminPollUi';
import { useClamped } from '../../hooks/useClamped';
import { usePhoneLayout } from '../../hooks/usePhoneLayout';

const AdminPollComments = lazy(() => import('./AdminPollComments'));

export interface AdminPollCardProps {
  view: ShownPoll;
  now: number;
  /** The signed-in Minter Admin. */
  author: PollAuthor;
  /** How many Minter Admins can sign now (what a write is encrypted to). */
  admins: number;
  pendingVote?: PendingVote;
  pendingShare?: PendingShare;
  onVote: (view: ShownPoll, vote: PollVote) => void;
  onShare: (view: ShownPoll) => void;
  /** Start with the comments open (the poll's own page). */
  commentsOpen?: boolean;
  /** Copy link on the card (not on the poll's own page, where the header has it). */
  copyLink?: boolean;
}

export function AdminPollCard({
  view,
  now,
  author,
  admins,
  pendingVote,
  pendingShare,
  onVote,
  onShare,
  commentsOpen = false,
  copyLink = true,
}: AdminPollCardProps) {
  const { poll } = view;
  const title = `Minter Admin poll: ${poll.question}`;
  const mine = myVoteView(view, pendingVote);
  const sharing = pendingShare && pendingShare.status !== 'failed';
  // Votes the viewer can't read are votes all the same.
  const voted = view.votes.length + view.unread.length;
  const unlisted = view.votes.filter((v) => v.unlisted).length;
  // In the last minutes no vote is started: it could land after the end.
  const closing = voteClosing(view, now);
  // Votes and shares are published under a name: without one, say so instead.
  const nameless = !author.name;

  return (
    <Card
      as="article"
      id={adminPollCardId(view.id)}
      tabIndex={-1}
      aria-label={title}
      sx={(theme) => ({
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        outline: 'none',
        scrollMarginTop: 'calc(var(--qmp-header-offset, 0px) + 16px)',
        '&:focus-visible': { boxShadow: `0 0 0 2px ${theme.palette.primary.main}` },
      })}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <ToneChip
          size="small"
          label={view.open ? 'Open' : 'Closed'}
          color={view.open ? 'primary' : 'default'}
          variant={view.open ? 'filled' : 'outlined'}
        />
        <Chip
          size="small"
          variant="outlined"
          icon={<LockOutlinedIcon aria-hidden />}
          label="Minter Admins only"
        />
        {view.publishing ? <Chip size="small" variant="outlined" label="Publishing…" /> : null}
      </Box>

      <Typography component="h3" sx={{ fontWeight: 700, fontSize: 16, overflowWrap: 'anywhere' }}>
        {poll.question}
      </Typography>
      <Typography component="div" variant="body2" color="text.secondary">
        Asked by <PersonInline address={view.publisher.address} name={view.publisher.name} />{' '}
        {formatRelative(view.postedAt, now)}
        {view.sharedBy ? (
          <>
            {' '}
            · Shared by <PersonInline address={view.sharedBy.address} name={view.sharedBy.name} />:
            you read their copy.
          </>
        ) : null}
      </Typography>
      {poll.details ? <Details text={poll.details} /> : null}

      <Typography
        variant="body2"
        sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, overflowWrap: 'anywhere' }}
      >
        <ScheduleOutlinedIcon aria-hidden sx={{ fontSize: 18, mt: '1px' }} />
        <span>
          {endText(poll, now)} ({endBlockText(poll)})
        </span>
      </Typography>

      <VoteColumns view={view} />
      {view.unread.length ? (
        <Typography variant="body2" color="text.secondary">
          {unreadText(view.unread.length)}
        </Typography>
      ) : null}
      {unlisted ? (
        <Typography variant="body2" color="text.secondary">
          {unlistedText(unlisted)}
        </Typography>
      ) : null}
      {view.open && !view.publishing ? (
        <Typography variant="body2" color="text.secondary">
          {notVotedText(voted, admins) ?? 'Every Minter Admin has voted.'}
        </Typography>
      ) : null}
      {!view.open && view.late.length ? (
        <Typography variant="body2" color="text.secondary">
          {view.late.length === 1
            ? '1 vote came after the end and doesn’t count.'
            : `${formatCount(view.late.length)} votes came after the end and don’t count.`}
        </Typography>
      ) : null}
      <Typography variant="body2" color="text.secondary">
        {ADVISORY}
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        {mine.label ? (
          <DoneChip label={mine.label} settled={mine.settled} />
        ) : !view.open ? (
          <Typography variant="body2" color="text.secondary">
            {view.myLate ? MY_LATE_TEXT : 'You didn’t vote.'}
          </Typography>
        ) : null}
        {closing && !view.publishing ? (
          <Typography variant="body2" color="text.secondary" sx={{ flexBasis: '100%' }}>
            {CLOSING_TEXT}
          </Typography>
        ) : nameless && (view.open || view.missing.length) && !view.publishing ? (
          <NeedsName
            address={author.address}
            title="Voting and sharing need a registered name"
            text="Votes and shared copies are published on QDN under a name, so the Minter Admins can see whose they are."
          />
        ) : view.open && !view.publishing ? (
          <VoteButtons
            question={poll.question}
            current={mine.vote}
            sending={mine.sending}
            onVote={(vote) => onVote(view, vote)}
          />
        ) : null}
        {mine.failed ? (
          <Typography variant="body2" sx={{ flexBasis: '100%' }}>
            Your last vote hasn’t shown up yet. Wait a minute before voting again.
          </Typography>
        ) : null}
      </Box>

      {view.missing.length && !view.publishing && !nameless ? (
        <Box>
          {sharing ? (
            <DoneChip label="Shared ✓ (confirming…)" settled={false} />
          ) : (
            <Button
              variant="outlined"
              startIcon={<ShareOutlinedIcon />}
              onClick={() => onShare(view)}
              aria-label={`${shareLabel(view.missing.length)}: ${poll.question}`}
              sx={{ minHeight: 44, textAlign: 'left' }}
            >
              {shareLabel(view.missing.length)}
            </Button>
          )}
        </Box>
      ) : null}

      {copyLink && !view.publishing ? (
        <Box sx={{ display: 'flex', mt: -0.5, ml: -1 }}>
          <CopyLinkButton
            variant="text"
            path={adminPollPath(view.id)}
            what={`the poll ${poll.question}`}
          />
        </Box>
      ) : null}

      {view.publishing ? null : (
        <PollComments
          view={view}
          author={author}
          admins={admins}
          label={poll.question}
          defaultOpen={commentsOpen}
        />
      )}
    </Card>
  );
}

/**
 * The poll's details in full on wider screens; on a phone a long text shows
 * its first lines with "Show more" (only when it is really cut off).
 */
function Details({ text }: { text: string }) {
  const phone = usePhoneLayout();
  const [open, setOpen] = useState(false);
  const [node, setNode] = useState<HTMLElement | null>(null);
  const id = useId();
  const lines = phone && !open ? PHONE_LINES : null;
  const clamped = useClamped(lines ? node : null, `${text}:${lines}`);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography
        ref={setNode}
        id={id}
        sx={{
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          ...(lines
            ? {
                display: '-webkit-box',
                WebkitLineClamp: lines,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }
            : {}),
        }}
      >
        {text}
      </Typography>
      {phone && (clamped || open) ? (
        <Button
          size="small"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={id}
          sx={{ alignSelf: 'flex-start', minHeight: 44 }}
        >
          {open ? 'Show less' : 'Show more'}
        </Button>
      ) : null}
    </Box>
  );
}

/** Lines a poll's details show on a phone before "Show more". */
const PHONE_LINES = 4;

const VOTE_TONE: Record<PollVote, ColumnTone> = { yes: 'success', no: 'error', neutral: 'neutral' };
const VOTE_ICON: Record<PollVote, ReactNode> = {
  yes: <CheckCircleOutlineOutlinedIcon aria-hidden />,
  no: <CancelOutlinedIcon aria-hidden />,
  neutral: <RemoveCircleOutlineOutlinedIcon aria-hidden />,
};

/** Yes, No and Neutral side by side, each with its count and who voted it (as on decisions). */
function VoteColumns({ view }: { view: ShownPoll }) {
  return (
    <PeopleColumns
      columns={POLL_VOTES.map((v) => ({
        key: v,
        title: VOTE_LABEL[v],
        listLabel: (n: number) => `Voted ${VOTE_LABEL[v]}: ${plural(n, 'Minter Admin')}`,
        icon: VOTE_ICON[v],
        tone: VOTE_TONE[v],
        people: view.votes
          .filter((x) => x.vote === v)
          .map((x) => ({ address: x.address, name: x.name })),
        count: view.counts[v],
        emptyText: view.open ? 'No one yet' : 'No one',
      }))}
    />
  );
}

function VoteButtons({
  question,
  current,
  sending,
  onVote,
}: {
  question: string;
  current: PollVote | null;
  sending: boolean;
  onVote: (vote: PollVote) => void;
}) {
  if (sending)
    return (
      <Button variant="contained" disabled sx={{ minHeight: 44 }}>
        Voting…
      </Button>
    );
  const options = POLL_VOTES.filter((v) => v !== current);
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, ml: 'auto' }}>
      {current ? (
        <Typography variant="body2" color="text.secondary">
          Change your vote:
        </Typography>
      ) : null}
      {options.map((v) => (
        <Button
          key={v}
          variant="outlined"
          onClick={() => onVote(v)}
          aria-label={`${current ? 'Change your vote to' : 'Vote'} ${VOTE_LABEL[v]}: ${question}`}
          sx={{ minHeight: 44, minWidth: 88 }}
        >
          {VOTE_LABEL[v]}
        </Button>
      ))}
    </Box>
  );
}

/** "Comments (n)": opens the encrypted thread (its code loads on demand). */
function PollComments({
  view,
  author,
  admins,
  label,
  defaultOpen,
}: {
  view: ShownPoll;
  author: PollAuthor;
  admins: number;
  label: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const pending = usePendingPollWrites().comments;
  const listed = new Set(view.commentRows.map((r) => r.ref));
  for (const c of view.shareComments) listed.add(`${c.name}\n${c.identifier}`);
  const count =
    listed.size +
    Object.values(pending).filter((p) => p.pollId === view.id && !listed.has(p.ref)).length;
  const text = `Comments (${formatCount(count)})`;
  return (
    <Box sx={{ minWidth: 0, borderTop: 1, borderColor: 'divider', pt: 0.5 }}>
      <Button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`${text}: ${label}`}
        startIcon={<ChatBubbleOutlineOutlinedIcon />}
        endIcon={open ? <ExpandLessOutlinedIcon /> : <ExpandMoreOutlinedIcon />}
        sx={{ minHeight: 44, ml: -1 }}
      >
        {text}
      </Button>
      {open ? (
        <Suspense fallback={<ListSkeleton count={1} label="Loading comments" />}>
          <AdminPollComments
            id={panelId}
            view={view}
            author={author}
            admins={admins}
            label={label}
          />
        </Suspense>
      ) : null}
    </Box>
  );
}
