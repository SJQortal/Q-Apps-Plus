/**
 * Decisions → "Minter Admin polls", for Minter Admins only (loaded on demand,
 * so nobody else downloads or reads any of it): the open polls, the soonest
 * end first. Once closed, a poll is in History's timeline (pages/history/parts/ClosedPolls.tsx).
 * Each card votes, shares and comments through its own Hub step. Advisory
 * only. "Hide already voted on" (the Decisions switch) leaves out the polls
 * the viewer voted on, with a note to show them.
 */
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import { useTheme } from '@mui/material/styles';
import { Section } from '../../components/common/Section';
import { CARD_COLUMN } from '../../components/layout/flowColumns';
import {
  CardSkeleton,
  EmptyState,
  ErrorState,
  TruncatedNote,
} from '../../components/common/states';
import type { PollVote } from '../../data/adminPollRecords';
import { useNow } from '../../hooks/useNow';
import { plural } from '../../utils/format';
import type { PollAuthor } from '../../writes/adminPolls';
import { AdminPollCard } from './AdminPollCard';
import { PollWriteDialogs, type PollDialog } from './PollWriteDialogs';
import { SECTION_ICON, sectionAccent } from './sectionAccents';
import {
  ADVISORY,
  HUB_DID_NOT_DECRYPT,
  myVoteView,
  undecryptedText,
  type ShownPoll,
} from './adminPollUi';
import { useAdminPolls } from './useAdminPolls';
import { PATHS } from '../../routes/paths';

export const ADMIN_POLLS_SECTION_ID = 'admin-polls';

export default function AdminPollsSection({
  author,
  onAsk,
  hideVoted = false,
  onShowVoted,
}: {
  /** The signed-in Minter Admin. */
  author: PollAuthor;
  /** Opens Ask the Minter Admins, its page (as Propose does). */
  onAsk: () => void;
  /** Hide already voted on: leave out the polls the viewer voted on (in time or late). */
  hideVoted?: boolean;
  /** Turn hiding off (the note's Show them). */
  onShowVoted?: () => void;
}) {
  const { query, views, pending, signers, undecrypted, retry } = useAdminPolls(author.address);
  const now = useNow(60_000);
  const theme = useTheme();
  const [dialog, setDialog] = useState<PollDialog | null>(null);
  const votedOn = (v: ShownPoll) => Boolean(myVoteView(v, pending.votes[v.id]).vote || v.myLate);
  // Closed polls are in History.
  const open = views?.filter((v) => v.open) ?? null;
  const shown = (open ?? []).filter((v) => !(hideVoted && votedOn(v)));
  const hidden = (open?.length ?? 0) - shown.length;

  const card = (view: ShownPoll) => (
    <AdminPollCard
      key={view.id}
      view={view}
      now={now}
      author={author}
      admins={signers.length}
      pendingVote={pending.votes[view.id]}
      pendingShare={pending.shares[view.id]}
      onVote={(v: ShownPoll, vote: PollVote) =>
        setDialog({
          kind: 'vote',
          view: v,
          vote,
          changing: Boolean(myVoteView(v, pending.votes[v.id]).vote),
        })
      }
      onShare={(v: ShownPoll) => setDialog({ kind: 'share', view: v })}
    />
  );

  return (
    <Section
      title="Minter Admin polls"
      count={open?.length}
      accent={sectionAccent(theme, 'polls')}
      icon={<SECTION_ICON.polls />}
      id={ADMIN_POLLS_SECTION_ID}
      flow={CARD_COLUMN}
    >
      <Typography variant="body2" color="text.secondary">
        Questions for the Minter Admins. Questions, votes and comments here are encrypted to the
        Minter Admins: only Minter Admins can read them. {ADVISORY}
      </Typography>
      {!views && query.isError ? (
        <ErrorState
          compact
          title="Couldn’t load the Minter Admin polls."
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : !open ? (
        <CardSkeleton lines={3} />
      ) : !open.length && undecrypted ? (
        // Not "no polls": Hub didn't decrypt them this time.
        <ErrorState
          compact
          title="Couldn’t decrypt the Minter Admin polls."
          error={HUB_DID_NOT_DECRYPT}
          onRetry={retry}
        />
      ) : !open.length ? (
        <EmptyState
          title="No open Minter Admin polls"
          description="Ask the Minter Admins a question: they vote Yes, No or Neutral."
          actionLabel="Ask the Minter Admins"
          onAction={() => onAsk()}
        />
      ) : (
        <>
          {shown.map(card)}
          {hidden ? (
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {plural(hidden, 'poll')} you already voted on {hidden === 1 ? 'is' : 'are'} hidden.
              </Typography>
              <Button
                onClick={onShowVoted}
                aria-label="Show them: the polls you already voted on"
                sx={{ minHeight: 44 }}
              >
                Show them
              </Button>
            </Box>
          ) : null}
          {undecrypted ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1 }}>
              <Typography variant="body2" color="text.secondary" role="note">
                {undecryptedText(undecrypted)}
              </Typography>
              <Button onClick={retry} sx={{ minHeight: 44 }}>
                Try again
              </Button>
            </Box>
          ) : null}
        </>
      )}
      {query.data?.truncated ? <TruncatedNote what="the Minter Admin polls" /> : null}
      {open ? (
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Closed polls, with their results and comments, are in History.
          </Typography>
          <Button
            component={RouterLink}
            to={`${PATHS.history}?type=polls&period=all`}
            startIcon={<HistoryOutlinedIcon />}
            sx={{ minHeight: 44 }}
          >
            Closed polls
          </Button>
        </Box>
      ) : null}
      <PollWriteDialogs
        dialog={dialog}
        author={author}
        admins={signers.length}
        onClose={() => setDialog(null)}
      />
    </Section>
  );
}
