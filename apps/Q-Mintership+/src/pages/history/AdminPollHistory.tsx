/**
 * History → "Minter Admin polls", for Minter Admins only (loaded on demand,
 * so nobody else downloads or reads any of it; Simon, 2026-10-23: "the closed
 * minter admin polls should go into history"). Every poll once it has closed,
 * the latest end first, 10 at a time, with its results, who voted what, its
 * comments, and Share for the Minter Admins added since. Open polls are on
 * Decisions. Read over all time (data/adminPolls.ts, PollScope `closed`):
 * votes and shares only for the polls shown.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import { Section } from '../../components/common/Section';
import { CARD_COLUMN } from '../../components/layout/flowColumns';
import {
  CardSkeleton,
  EmptyState,
  ErrorState,
  TruncatedNote,
} from '../../components/common/states';
import { POLL_HISTORY_PAGE, type PollScope } from '../../data/adminPolls';
import type { PollVote } from '../../data/adminPollRecords';
import { useNow } from '../../hooks/useNow';
import type { PollAuthor } from '../../writes/adminPolls';
import { AdminPollCard } from '../decisions/AdminPollCard';
import { PollWriteDialogs, type PollDialog } from '../decisions/PollWriteDialogs';
import {
  ADVISORY,
  HUB_DID_NOT_DECRYPT,
  myVoteView,
  undecryptedText,
  type ShownPoll,
} from '../decisions/adminPollUi';
import { useAdminPolls } from '../decisions/useAdminPolls';
import { HISTORY_POLLS_ID } from './historyIds';

export default function AdminPollHistory({ author }: { author: PollAuthor }) {
  const [count, setCount] = useState(POLL_HISTORY_PAGE);
  const scope = useMemo<PollScope>(() => ({ kind: 'closed', count }), [count]);
  const { query, views, pending, signers, undecrypted, retry } = useAdminPolls(
    author.address,
    true,
    scope
  );
  const now = useNow(60_000);
  const [dialog, setDialog] = useState<PollDialog | null>(null);

  // Show more reads a longer list under a key of its own: the shorter one stays meanwhile.
  const [kept, setKept] = useState<{ views: ShownPoll[]; more: boolean } | null>(null);
  if (views && kept?.views !== views) setKept({ views, more: Boolean(query.data?.more) });
  const list = views ?? kept?.views ?? null;
  const more = views ? Boolean(query.data?.more) : Boolean(kept?.more);
  const loadingMore = !views && kept !== null && !query.isError;

  // Decisions' "Closed polls" opens History here.
  const { hash } = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  const arrived = list !== null;
  useEffect(() => {
    if (arrived && hash === `#${HISTORY_POLLS_ID}`)
      ref.current?.scrollIntoView?.({ block: 'start' });
  }, [arrived, hash]);

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
    <Box
      ref={ref}
      id={HISTORY_POLLS_ID}
      sx={{ scrollMarginTop: 'calc(var(--qmp-header-offset, 0px) + 16px)' }}
    >
      <Section title="Minter Admin polls" id="history-polls" flow={CARD_COLUMN}>
        <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
          The Minter Admins’ polls once they closed, the latest first: the results, who voted what,
          and the comments. Encrypted to the Minter Admins: only they can read them. {ADVISORY}
        </Typography>
        {!list && query.isError ? (
          <ErrorState
            compact
            title="Couldn’t load the closed Minter Admin polls."
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        ) : !list ? (
          <CardSkeleton lines={3} />
        ) : !list.length && undecrypted ? (
          // Not "no polls": Hub didn't decrypt them this time.
          <ErrorState
            compact
            title="Couldn’t decrypt the Minter Admin polls."
            error={HUB_DID_NOT_DECRYPT}
            onRetry={retry}
          />
        ) : !list.length ? (
          <EmptyState
            title="No closed Minter Admin polls yet"
            description="Once a poll’s voting ends, it moves here from Decisions."
          />
        ) : (
          <>
            {list.map(card)}
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
            {more || loadingMore ? (
              <Box>
                <Button
                  variant="outlined"
                  onClick={() => setCount((n) => n + POLL_HISTORY_PAGE)}
                  disabled={loadingMore}
                  sx={{ minHeight: 44 }}
                >
                  {loadingMore ? 'Loading…' : `Show ${POLL_HISTORY_PAGE} more`}
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
    </Box>
  );
}
