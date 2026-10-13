/**
 * Decisions → "Minter Admin polls", for Minter Admins only (loaded on demand,
 * so nobody else downloads or reads any of it): open polls first, the
 * soonest end first, then those that ended in the last 31 days. Each card
 * votes, shares and comments through its own Hub step. Advisory only.
 */
import { useState } from 'react';
import { Box, Typography } from '@mui/material';
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
import { ADVISORY, myVoteView, type ShownPoll } from './adminPollUi';
import { useAdminPolls } from './useAdminPolls';

export const ADMIN_POLLS_SECTION_ID = 'admin-polls';

export default function AdminPollsSection({
  author,
  onAsk,
}: {
  /** The signed-in Minter Admin. */
  author: PollAuthor;
  /** Opens Ask the Minter Admins (as Propose does). */
  onAsk: () => void;
}) {
  const { query, views, pending, signers } = useAdminPolls(author.address);
  const now = useNow(60_000);
  const [dialog, setDialog] = useState<PollDialog | null>(null);
  const open = views?.filter((v) => v.open) ?? [];
  const closed = views?.filter((v) => !v.open) ?? [];

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
      title={`Minter Admin polls${views ? ` · ${views.length}` : ''}`}
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
      ) : !views.length ? (
        <EmptyState
          title="No Minter Admin polls in the last 31 days"
          description="Ask the Minter Admins a question: they vote Yes, No or Neutral."
          actionLabel="Ask the Minter Admins"
          onAction={onAsk}
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
