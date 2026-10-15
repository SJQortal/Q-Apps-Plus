/**
 * Decisions → "Minter Admin polls", for Minter Admins only (loaded on demand,
 * so nobody else downloads or reads any of it): open polls first, the
 * soonest end first, then those that ended in the last 31 days. Each card
 * votes, shares and comments through its own Hub step. Advisory only.
 * "Hide already voted on" (the Decisions switch) leaves out the polls the
 * viewer voted on, with a note to show them.
 */
import { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Section } from '../../components/common/Section';
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

export const ADMIN_POLLS_SECTION_ID = 'admin-polls';

export default function AdminPollsSection({
  author,
  onAsk,
  hideVoted = false,
  onShowVoted,
}: {
  /** The signed-in Minter Admin. */
  author: PollAuthor;
  /** Opens Ask the Minter Admins (as Propose does), from this button: focus comes back to it. */
  onAsk: (from: HTMLElement) => void;
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
  const shown = (views ?? []).filter((v) => !(hideVoted && votedOn(v)));
  const hidden = (views?.length ?? 0) - shown.length;
  const open = shown.filter((v) => v.open);
  const closed = shown.filter((v) => !v.open);

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
      count={views?.length}
      accent={sectionAccent(theme, 'polls')}
      icon={<SECTION_ICON.polls />}
      id={ADMIN_POLLS_SECTION_ID}
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
      ) : !views ? (
        <CardSkeleton lines={3} />
      ) : !views.length && undecrypted ? (
        // Not "no polls": Hub didn't decrypt them this time.
        <ErrorState
          compact
          title="Couldn’t decrypt the Minter Admin polls."
          error={HUB_DID_NOT_DECRYPT}
          onRetry={retry}
        />
      ) : !views.length ? (
        <EmptyState
          title="No Minter Admin polls in the last 31 days"
          description="Ask the Minter Admins a question: they vote Yes, No or Neutral."
          actionLabel="Ask the Minter Admins"
          onAction={(event) => onAsk(event.currentTarget)}
        />
      ) : (
        <>
          {open.map(card)}
          {closed.length ? (
            <Box sx={{ pt: 0.5 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                {plural(closed.length, 'poll')} closed in the last 31 days
              </Typography>
            </Box>
          ) : null}
          {closed.map(card)}
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
      <PollWriteDialogs
        dialog={dialog}
        author={author}
        admins={signers.length}
        onClose={() => setDialog(null)}
      />
    </Section>
  );
}
