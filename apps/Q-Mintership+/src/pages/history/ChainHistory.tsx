/**
 * History → On chain: MINTER's decided changes and joins, newest first, over
 * a period: the last 30 days (the default), 60 or 120 days, a year, from a
 * date, or all of it (Scan all History: every window back to MINTER's
 * start). The type and the period are in the URL (historyFilters.ts); a
 * button at the end shows the next longer period.
 *
 * All types, and joins, join requests and leaves, are read in 30-day windows
 * (block windows found with /blocks/timestamp, then bounded searches), as
 * many as the period covers and never before MINTER's creation. Windows
 * already read stay cached, so a longer period fetches only the new ones. A
 * type of decision (invites, removals, bans, …) is one search by type over
 * the period instead (TypedHistory.tsx).
 *
 * An approved admin change says what it did to the target, worked back from
 * today's admin count (rules/targetShift.ts), where every later admin change
 * is in the windows read. Each decided change links to its decision's own
 * page (parts/TimelineList.tsx), which reads its signatures only when opened.
 * Once the list is in, what it reaches is no longer new for this account
 * (data/historySeen.ts): a Minter Admin's History tab stops counting it. What
 * that count was counting stays marked New on this visit (Simon, 2026-10-17:
 * "when they click History I want that new in History to be highlighted").
 *
 * For a Minter Admin, the Minter Admin polls that closed in the period are
 * rows among the events, by when voting ended, and a type of their own
 * (parts/ClosedPolls.tsx, loaded only for them; Simon, 2026-10-23).
 */
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import { FALLBACK_MS_PER_BLOCK } from '../../data/constants';
import {
  buildTimeline,
  loadHistoryWindows,
  withTargetSteps,
  type HistoryAnchor,
  type HistoryWindow,
  type TimelineContext,
  type TimelineEvent,
} from '../../data/timeline';
import {
  useAdmins,
  useChainNow,
  useGroupInfo,
  useMyStatus,
  useNominations,
} from '../../hooks/useData';
import { inviteProposers } from '../../data/nominations';
import { waitingWindowBlocks } from '../../rules/timing';
import { usePhoneLayout } from '../../hooks/usePhoneLayout';
import { markHistorySeen, readHistorySeen } from '../../data/historySeen';
import { isHistoryNews } from '../../data/historyNews';
import { useSession } from '../../state/session';
import { adminLeaves, approvedAdminChanges, targetSteps } from '../../rules/targetShift';
import { useQuery } from '../../hooks/useQuery';
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  TruncatedNote,
} from '../../components/common/states';
import { Section } from '../../components/common/Section';
import { appParam } from '../../routes/hubLocation';
import { plural } from '../../utils/format';
import {
  DEFAULT_PERIOD,
  historyFilterChoices,
  historyFilterLabel,
  longerPeriod,
  longerPeriodLabel,
  matchesHistoryFilter,
  parseHistoryFilter,
  parseHistoryPeriod,
  periodKey,
  periodStartMs,
  periodWords,
  searchTypesFor,
  windowsFor,
  type HistoryFilter,
  type HistoryPeriod,
} from './historyFilters';
import { HistoryFilterBar } from './parts/HistoryFilterBar';
import { TimelineList, type TimelinePoll } from './parts/TimelineList';
import type { ClosedPollsState } from './parts/ClosedPolls';
import { TypedHistory } from './TypedHistory';

/** The closed Minter Admin polls: loaded only for Minter Admins. */
const ClosedPolls = lazy(() => import('./parts/ClosedPolls'));

/** Events shown before "Show all"; a longer list (a year is about 900) shows 50 more at a time. */
const FIRST_EVENTS = 12;
const MORE_EVENTS = 50;

export function ChainHistory() {
  const chain = useChainNow();
  const group = useGroupInfo();
  const admins = useAdmins();
  const phone = usePhoneLayout();
  // The windows hang off the tip seen on arrival, so refreshes don't shift them.
  const [pinned, setPinned] = useState<HistoryAnchor | null>(null);
  useEffect(() => {
    if (!pinned && chain.data)
      setPinned({ height: chain.data.height, timestamp: chain.data.timestamp });
  }, [pinned, chain.data]);
  const anchor =
    pinned ?? (chain.data ? { height: chain.data.height, timestamp: chain.data.timestamp } : null);

  const session = useSession();
  const me = session.status === 'ready' ? session.address : null;
  const { status } = useMyStatus();
  const admin = Boolean(me && status?.isAdmin && status.address === me);

  // The type and the period, from the URL; Minter Admin polls only for a Minter Admin.
  const [params, setParams] = useSearchParams();
  const asked = parseHistoryFilter(appParam(params, 'type'));
  const filter = asked === 'polls' && status && !admin ? 'all' : asked;
  const period = parseHistoryPeriod(appParam(params, 'period'), appParam(params, 'from'));
  const setQuery = (values: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(values)) {
          if (value === null) next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace: true }
    );
  const setFilter = (key: HistoryFilter) => setQuery({ type: key === 'all' ? null : key });
  // The last 30 days, the default, leaves the URL without a period.
  const setPeriod = (p: HistoryPeriod) =>
    setQuery({
      period:
        p.kind === 'all'
          ? 'all'
          : p.kind === 'days' && periodKey(p) !== periodKey(DEFAULT_PERIOD)
            ? String(p.days)
            : null,
      from: p.kind === 'from' ? p.date : null,
    });

  const created = group.data?.created;
  const startMs = periodStartMs(period, anchor?.timestamp ?? Date.now(), created);
  const scope = periodWords(period, startMs, created);
  const search = searchTypesFor(filter);
  const longer = longerPeriod(period);
  const showLonger = () => {
    if (longer) setPeriod(longer);
  };

  // The windows the period covers, from MINTER's creation at the earliest; a search by
  // type reads the newest one only (its target changes, and what is seen).
  const [limit, setLimit] = useState(FIRST_EVENTS);
  const windowCount =
    search || filter === 'polls' || !anchor
      ? 1
      : windowsFor(Math.max(startMs, created ?? 0), anchor.timestamp);
  const query = useQuery<HistoryWindow[]>(
    anchor ? `timelines:${anchor.height}:${windowCount}` : null,
    (force) => loadHistoryWindows(anchor as HistoryAnchor, windowCount, { force })
  );
  // What the list reaches isn't new any more: the History tab's count drops it.
  // What a Minter Admin had seen before this visit (read before it is marked seen below):
  // what came after is what the count counted, and is marked New.
  const [seenBefore, setSeenBefore] = useState(() => ({
    me,
    height: me ? readHistorySeen(me) : null,
  }));
  if (seenBefore.me !== me) setSeenBefore({ me, height: me ? readHistorySeen(me) : null });
  const newSince = status?.isAdmin ? seenBefore.height : null;
  const isNew = useMemo(
    () =>
      newSince === null ? undefined : (event: TimelineEvent) => isHistoryNews(event, newSince),
    [newSince]
  );
  const shownTo = query.data && anchor ? anchor.height : null;
  useEffect(() => {
    if (me && shownTo) markHistorySeen(me, shownTo);
  }, [me, shownTo]);
  // Keep the windows already on screen while older ones load.
  const [previous, setPrevious] = useState<HistoryWindow[] | undefined>(undefined);
  useEffect(() => {
    if (query.data) setPrevious(query.data);
  }, [query.data]);
  const windows = query.data ?? previous;

  const msPerBlock = chain.data?.msPerBlock ?? FALLBACK_MS_PER_BLOCK;
  const maximumBlockDelay = group.data?.maximumBlockDelay ?? 10_080;
  // An invite that answered a nomination says its nominator proposed it (the read Home makes too).
  const nominations = useNominations();
  const proposerOf = useMemo(
    () =>
      inviteProposers(
        nominations.data?.all,
        waitingWindowBlocks({ minimumBlockDelay: 0, maximumBlockDelay }) * msPerBlock
      ),
    [nominations.data, maximumBlockDelay, msPerBlock]
  );
  const threshold = group.data?.approvalThreshold;
  const owner = group.data?.owner;
  const adminCount = admins.data?.adminCount;
  const ctx = useMemo<TimelineContext>(
    () => ({ msPerBlock, maximumBlockDelay }),
    [msPerBlock, maximumBlockDelay]
  );
  // Decided only: what is still collecting signatures lives in Nominations and Decisions.
  const events = useMemo(() => {
    if (!windows) return [];
    const rows = windows.flatMap((w) => w.rows);
    const decided = buildTimeline(rows, ctx).filter((e) => e.outcome !== 'pending');
    if (adminCount === undefined || !threshold || windows.some((w) => w.truncated)) return decided;
    // A change approved this long after the oldest window's start was confirmed inside the
    // windows read, so every change after it is in hand and its count is exact.
    const exactFrom = (windows[windows.length - 1]?.startHeight ?? 1) + maximumBlockDelay;
    // An admin's own LEAVE_GROUP takes their admin row away too (the rows read have them).
    const changes = approvedAdminChanges(rows);
    const leaves = adminLeaves(rows, changes, { owner });
    const steps = targetSteps(changes, adminCount, threshold, leaves).filter(
      (step) => step.height >= exactFrom
    );
    return withTargetSteps(decided, steps);
  }, [windows, ctx, maximumBlockDelay, adminCount, threshold, owner]);

  const choices = useMemo(
    () => historyFilterChoices(events, filter, { polls: admin }),
    [events, filter, admin]
  );
  const filtered = useMemo(
    () => events.filter((e) => matchesHistoryFilter(e, filter) && e.at >= startMs),
    [events, filter, startMs]
  );

  // The polls that closed in the period, among the events (All) or alone (Minter Admin polls).
  const [pollState, setPollState] = useState<ClosedPollsState | null>(null);
  const pollsWanted = admin && Boolean(anchor) && (filter === 'all' || filter === 'polls');
  const polls = useMemo(
    () => (pollsWanted ? (pollState?.polls ?? []) : []),
    [pollsWanted, pollState]
  );
  const pollsLoading = pollsWanted && !pollState?.polls && !pollState?.error;
  const items = useMemo(
    () =>
      [
        ...filtered.map((event) => ({ at: event.at, event, poll: null })),
        ...polls.map((poll) => ({ at: poll.at, event: null, poll })),
      ].sort((a, b) => b.at - a.at),
    [filtered, polls]
  );

  const newCount = isNew ? filtered.filter(isNew).length : 0;
  const loadingOlder = Boolean(windows && query.fetching && !query.data);
  const shownItems = items.slice(0, limit);
  const shown = shownItems.flatMap((item) => (item.event ? [item.event] : []));
  const shownPolls = shownItems.flatMap((item): TimelinePoll[] => (item.poll ? [item.poll] : []));
  const hidden = items.length - shownItems.length;
  const label = historyFilterLabel(filter);
  const nowMs = chain.data?.timestamp ?? Date.now();

  let body;
  if (search && anchor) {
    body = (
      <TypedHistory
        key={`${filter}:${startMs}`}
        anchor={anchor}
        filter={filter}
        types={search}
        startMs={startMs}
        scope={scope}
        ctx={ctx}
        known={events}
        nowMs={nowMs}
        isNew={isNew}
        proposerOf={proposerOf}
        longer={longer ? longerPeriodLabel(longer) : null}
        earliest={created}
        onLonger={showLonger}
      />
    );
  } else if (!windows && (chain.isError || query.isError)) {
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
        {newCount ? (
          <Typography role="status" variant="body2" sx={{ fontWeight: 600, px: 0.5 }}>
            {plural(newCount, 'change')} new since you last looked, marked New.
          </Typography>
        ) : null}
        {items.length ? (
          <TimelineList
            events={shown}
            polls={shownPolls}
            showSubject
            nowMs={nowMs}
            isNew={isNew}
            proposerOf={proposerOf}
            label={
              filter === 'all'
                ? 'MINTER events, newest first'
                : `MINTER events: ${label}, newest first`
            }
          />
        ) : loadingOlder ? null : filter === 'polls' ? (
          pollsLoading ? (
            <ListSkeleton count={2} label="Loading the Minter Admin polls" />
          ) : pollState?.error ? null : (
            <EmptyState
              title={`No Minter Admin polls closed ${scope}.`}
              description={
                longer || period.kind === 'all'
                  ? 'Open polls are in Decisions.'
                  : 'Open polls are in Decisions. Pick an earlier date in When to look further back.'
              }
            />
          )
        ) : filter === 'all' ? (
          <EmptyState
            title={`Nothing changed in MINTER ${scope}.`}
            description="No one was added, removed, banned or made an admin, and no one joined or left."
          />
        ) : (
          <EmptyState
            title={`Nothing under “${label}” ${scope}.`}
            description={
              longer || period.kind === 'all'
                ? undefined
                : 'Pick an earlier date in When to look further back.'
            }
          />
        )}
        {loadingOlder ? <ListSkeleton count={2} label="Loading older MINTER events" /> : null}
        {pollsWanted && pollState?.error ? (
          <ErrorState
            compact
            title="Couldn’t load the Minter Admin polls."
            error={pollState.error}
            onRetry={pollState.retry}
          />
        ) : null}
        {pollsWanted && pollState?.undecrypted ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1 }}>
            <Typography variant="body2" color="text.secondary" role="note" sx={{ px: 0.5 }}>
              {pollState.undecrypted}
            </Typography>
            <Button onClick={pollState.retry} sx={{ minHeight: 44 }}>
              Try again
            </Button>
          </Box>
        ) : null}
        {pollsWanted && pollState?.more ? <TruncatedNote what="the Minter Admin polls" /> : null}
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
            {plural(items.length, filter === 'polls' ? 'poll' : 'event')} {scope}.
          </Typography>
          {hidden > 0 ? (
            <Button
              variant="outlined"
              onClick={() =>
                setLimit((n) => (hidden <= MORE_EVENTS ? items.length : n + MORE_EVENTS))
              }
              sx={{ minHeight: 44 }}
            >
              {hidden <= MORE_EVENTS ? `Show all ${items.length}` : `Show ${MORE_EVENTS} more`}
            </Button>
          ) : longer && !query.isError ? (
            <Button
              variant="outlined"
              onClick={() => {
                // The longer period's older days follow what is already shown.
                setLimit(items.length + MORE_EVENTS);
                showLonger();
              }}
              disabled={loadingOlder}
              sx={{ minHeight: 44 }}
            >
              {loadingOlder ? 'Loading…' : longerPeriodLabel(longer)}
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
        {admin
          ? ' The Minter Admin polls are here once they close, for Minter Admins only: encrypted to them, and advisory.'
          : null}
      </Typography>
      {pollsWanted && anchor ? (
        <Suspense fallback={null}>
          <ClosedPolls viewer={me as string} since={startMs} onChange={setPollState} />
        </Suspense>
      ) : null}
      {anchor ? (
        <HistoryFilterBar
          choices={choices}
          filter={filter}
          onFilter={setFilter}
          period={period}
          onPeriod={setPeriod}
          phone={phone}
          earliest={created}
          nowMs={anchor.timestamp}
        />
      ) : null}
      {body}
    </Section>
  );
}
