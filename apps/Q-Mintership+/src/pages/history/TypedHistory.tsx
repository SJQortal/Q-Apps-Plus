/**
 * History → On chain, one type of decision: that type across all of
 * MINTER's history, or from the period's start (data/historySearch.ts),
 * newest first, 20 at a time. The search starts a signing window before the
 * period, so a proposal decided inside it is there too, and the events are
 * cut at the period's start by when they were decided. Removals and declined
 * join requests are both kicks: kicks are told apart from each person's own
 * history a batch at a time, as the list needs more. Events History's newest
 * window already has are taken from it, with their target changes.
 */
import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { blockAtTimeKey, getBlockAtTime } from '../../data/chain';
import {
  KICK_BATCH,
  kickMarksKey,
  loadKickMarks,
  loadTypedHistory,
  typedHistoryKey,
} from '../../data/historySearch';
import {
  buildTimeline,
  withDeclineMarks,
  type HistoryAnchor,
  type TimelineContext,
  type TimelineEvent,
} from '../../data/timeline';
import type { GroupTxType, TxRow } from '../../data/types';
import { useQuery } from '../../hooks/useQuery';
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  TruncatedNote,
} from '../../components/common/states';
import { formatCount, plural } from '../../utils/format';
import { historyFilterLabel, matchesHistoryFilter, type HistoryFilter } from './historyFilters';
import { TimelineList } from './parts/TimelineList';

/** Events shown at first, and added by each "Show more". */
export const TYPED_PAGE = 20;

export function TypedHistory({
  anchor,
  filter,
  types,
  startMs,
  scope,
  ctx,
  known,
  nowMs,
  onAnyTime,
}: {
  anchor: HistoryAnchor;
  filter: HistoryFilter;
  types: readonly GroupTxType[];
  /** The period's start (ms), or null for all of MINTER's history. */
  startMs: number | null;
  /** "in all of MINTER's history", "in the last 60 days", … */
  scope: string;
  ctx: TimelineContext;
  /** Events History's windows already hold (with their target changes). */
  known: readonly TimelineEvent[];
  nowMs: number;
  /** Shown on an empty period: widen it to any time. */
  onAnyTime?: () => void;
}) {
  const label = historyFilterLabel(filter);
  const [shown, setShown] = useState(TYPED_PAGE);

  const startBlock = useQuery(startMs === null ? null : blockAtTimeKey(startMs), () =>
    getBlockAtTime(startMs as number)
  );
  const fromHeight =
    startMs === null
      ? 1
      : startBlock.data
        ? Math.max(1, startBlock.data.height + 1 - ctx.maximumBlockDelay)
        : null;
  const rowsQ = useQuery(
    fromHeight === null ? null : typedHistoryKey(types, fromHeight, anchor.height),
    (force) => loadTypedHistory(types, fromHeight as number, anchor.height, { force })
  );

  // Kicks: told apart a batch at a time, newest first.
  const isKick = filter === 'declined' || filter === 'removal';
  const kicks = useMemo<TxRow[]>(
    () => (isKick && rowsQ.data ? rowsQ.data.rows.filter((tx) => tx.type === 'GROUP_KICK') : []),
    [isKick, rowsQ.data]
  );
  const [batches, setBatches] = useState(1);
  const marksQ = useQuery(isKick && rowsQ.data ? kickMarksKey(kicks, batches) : null, () =>
    loadKickMarks(kicks, batches)
  );
  // Keep what is marked on screen while the next batch is read.
  const [marked, setMarked] = useState<{ marks: Map<string, boolean>; batches: number } | null>(
    null
  );
  useEffect(() => {
    if (marksQ.data) setMarked({ marks: marksQ.data, batches });
  }, [marksQ.data, batches]);
  const checked = isKick && marked ? Math.min(kicks.length, marked.batches * KICK_BATCH) : 0;
  const moreKicks = isKick && checked < kicks.length;

  const events = useMemo<TimelineEvent[] | null>(() => {
    if (!rowsQ.data) return null;
    let rows = rowsQ.data.rows;
    if (isKick) {
      if (!marked) return null;
      rows = withDeclineMarks(kicks.slice(0, checked), marked.marks);
    }
    const fromWindows = new Map(known.map((e) => [e.signature, e]));
    return buildTimeline(rows, ctx)
      .filter((e) => e.outcome !== 'pending')
      .map((e) => fromWindows.get(e.signature) ?? e)
      .filter((e) => matchesHistoryFilter(e, filter))
      .filter((e) => startMs === null || e.at >= startMs);
  }, [rowsQ.data, isKick, marked, kicks, checked, known, ctx, filter, startMs]);

  // Mark more kicks while the list has fewer than it shows.
  const marking = isKick && marksQ.fetching;
  useEffect(() => {
    if (events && events.length < shown && moreKicks && !marking && marked?.batches === batches)
      setBatches((b) => b + 1);
  }, [events, shown, moreKicks, marking, marked, batches]);

  const error = startBlock.error ?? rowsQ.error ?? marksQ.error;
  if (!events && (startBlock.isError || rowsQ.isError || marksQ.isError)) {
    return (
      <ErrorState
        title={`Couldn't search MINTER's history for ${label.toLowerCase()}.`}
        error={error}
        onRetry={() =>
          void (startBlock.isError
            ? startBlock.refetch()
            : rowsQ.isError
              ? rowsQ.refetch()
              : marksQ.refetch())
        }
      />
    );
  }
  if (!events) {
    return <ListSkeleton count={3} label={`Searching MINTER's history: ${label}`} />;
  }
  if (!events.length && !moreKicks) {
    return (
      <EmptyState
        title={`Nothing under “${label}” ${scope}.`}
        description={
          startMs === null
            ? undefined
            : 'Choose a longer period, or any time, to search further back.'
        }
        actionLabel={startMs === null || !onAnyTime ? undefined : 'Any time'}
        onAction={startMs === null ? undefined : onAnyTime}
      />
    );
  }

  return (
    <>
      {events.length ? (
        <TimelineList
          events={events.slice(0, shown)}
          showSubject
          nowMs={nowMs}
          label={`MINTER events: ${label}, newest first`}
        />
      ) : null}
      {rowsQ.data?.truncated ? <TruncatedNote what={`these ${label.toLowerCase()}`} /> : null}
      {marksQ.isError ? (
        <ErrorState
          compact
          title="Couldn't check older kicks."
          error={marksQ.error}
          onRetry={() => void marksQ.refetch()}
        />
      ) : null}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: '1 1 200px' }}>
          {moreKicks
            ? `${plural(events.length, 'event')} so far: checked the newest ${formatCount(checked)} of ${plural(kicks.length, 'kick')} ${scope}.`
            : `${plural(events.length, 'event')} ${scope}.`}
        </Typography>
        {events.length > shown || moreKicks ? (
          <Button
            variant="outlined"
            onClick={() => setShown((n) => n + TYPED_PAGE)}
            disabled={marking && events.length <= shown}
            sx={{ minHeight: 44 }}
          >
            {marking && events.length <= shown ? 'Checking…' : 'Show more'}
          </Button>
        ) : null}
      </Box>
    </>
  );
}
