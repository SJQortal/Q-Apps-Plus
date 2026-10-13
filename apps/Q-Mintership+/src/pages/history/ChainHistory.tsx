/**
 * History → On chain: MINTER's decided changes and joins, 30 days at a time
 * (block windows found with /blocks/timestamp, then bounded searches), with
 * the newest first. "Load older" adds the 30 days before; windows already
 * read stay cached, so only the new one is fetched. An approved admin change
 * says what it did to the target, worked back from today's admin count
 * (rules/targetShift.ts), where every later admin change is in the windows
 * read.
 */
import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { FALLBACK_MS_PER_BLOCK } from '../../data/constants';
import {
  HISTORY_MAX_WINDOWS,
  HISTORY_WINDOW_DAYS,
  buildTimeline,
  loadHistoryWindows,
  withTargetSteps,
  type HistoryAnchor,
  type HistoryWindow,
} from '../../data/timeline';
import { useAdmins, useChainNow, useGroupInfo } from '../../hooks/useData';
import { approvedAdminChanges, targetSteps } from '../../rules/targetShift';
import { useQuery } from '../../hooks/useQuery';
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  TruncatedNote,
} from '../../components/common/states';
import { Section } from '../../components/common/Section';
import { formatDate, plural } from '../../utils/format';
import { TimelineList } from './parts/TimelineList';

/** Events shown before "Show all". */
const FIRST_EVENTS = 12;

export function ChainHistory() {
  const chain = useChainNow();
  const group = useGroupInfo();
  const admins = useAdmins();
  // The windows hang off the tip seen on arrival, so refreshes don't shift them.
  const [pinned, setPinned] = useState<HistoryAnchor | null>(null);
  useEffect(() => {
    if (!pinned && chain.data)
      setPinned({ height: chain.data.height, timestamp: chain.data.timestamp });
  }, [pinned, chain.data]);
  const anchor =
    pinned ?? (chain.data ? { height: chain.data.height, timestamp: chain.data.timestamp } : null);

  const [count, setCount] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const query = useQuery<HistoryWindow[]>(
    anchor ? `timelines:${anchor.height}:${count}` : null,
    (force) => loadHistoryWindows(anchor as HistoryAnchor, count, { force })
  );
  // Keep the windows already on screen while an older one loads.
  const [previous, setPrevious] = useState<HistoryWindow[] | undefined>(undefined);
  useEffect(() => {
    if (query.data) setPrevious(query.data);
  }, [query.data]);
  const windows = query.data ?? previous;

  const msPerBlock = chain.data?.msPerBlock ?? FALLBACK_MS_PER_BLOCK;
  const maximumBlockDelay = group.data?.maximumBlockDelay ?? 10_080;
  const threshold = group.data?.approvalThreshold;
  const adminCount = admins.data?.adminCount;
  // Decided only: what is still collecting signatures lives in Nominations and Decisions.
  const events = useMemo(() => {
    if (!windows) return [];
    const rows = windows.flatMap((w) => w.rows);
    const decided = buildTimeline(rows, { msPerBlock, maximumBlockDelay }).filter(
      (e) => e.outcome !== 'pending'
    );
    if (adminCount === undefined || !threshold || windows.some((w) => w.truncated)) return decided;
    // A change approved this long after the oldest window's start was confirmed inside the
    // windows read, so every change after it is in hand and its count is exact.
    const exactFrom = (windows[windows.length - 1]?.startHeight ?? 1) + maximumBlockDelay;
    const steps = targetSteps(approvedAdminChanges(rows), adminCount, threshold).filter(
      (step) => step.height >= exactFrom
    );
    return withTargetSteps(decided, steps);
  }, [windows, msPerBlock, maximumBlockDelay, adminCount, threshold]);

  const loadingOlder = Boolean(windows && query.fetching && !query.data);
  const oldest = windows?.[windows.length - 1];
  const canLoadOlder = count < HISTORY_MAX_WINDOWS && (oldest?.startHeight ?? 2) > 1;
  const shown = expanded ? events : events.slice(0, FIRST_EVENTS);
  const loadOlder = () => {
    setExpanded(true);
    setCount((c) => c + 1);
  };

  let body;
  if (!windows && (chain.isError || query.isError)) {
    body = (
      <ErrorState
        title="Couldn't load MINTER's history."
        error={query.error ?? chain.error}
        onRetry={() => void (chain.isError ? chain.refetch() : query.refetch())}
      />
    );
  } else if (!windows) {
    body = <ListSkeleton count={3} label="Loading MINTER's history" />;
  } else {
    body = (
      <>
        {events.length ? (
          <TimelineList
            events={shown}
            showSubject
            nowMs={chain.data?.timestamp ?? Date.now()}
            label="MINTER events, newest first"
          />
        ) : (
          <EmptyState
            title={`Nothing changed in MINTER in the last ${count * HISTORY_WINDOW_DAYS} days.`}
            description="No one was added, removed, banned or made an admin, and no one joined or left."
          />
        )}
        {windows.some((w) => w.truncated) ? <TruncatedNote what="these MINTER events" /> : null}
        {query.isError && windows ? (
          <ErrorState
            compact
            title="Couldn't load older events."
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        ) : null}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ flex: '1 1 200px' }}>
            {plural(events.length, 'event')} since {formatDate(oldest?.startMs ?? Date.now())}.
          </Typography>
          {events.length > shown.length ? (
            <Button variant="outlined" onClick={() => setExpanded(true)} sx={{ minHeight: 44 }}>
              Show all {events.length}
            </Button>
          ) : canLoadOlder && !query.isError ? (
            <Button
              variant="outlined"
              onClick={loadOlder}
              disabled={loadingOlder}
              sx={{ minHeight: 44 }}
            >
              {loadingOlder ? 'Loading…' : `Load the ${HISTORY_WINDOW_DAYS} days before`}
            </Button>
          ) : null}
        </Box>
      </>
    );
  }

  return (
    <Section title="On chain" id="history-chain">
      <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
        Who was added to MINTER, removed, banned or made a Minter Admin. Only approved changes
        happened; proposals that expired or were rejected are marked. Open ones are in Nominations
        and Decisions.
      </Typography>
      {body}
    </Section>
  );
}
