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
 * (data/historySeen.ts): a Minter Admin's History tab stops counting it.
 */
import { useEffect, useMemo, useState } from 'react';
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
} from '../../data/timeline';
import { useAdmins, useChainNow, useGroupInfo } from '../../hooks/useData';
import { usePhoneLayout } from '../../hooks/usePhoneLayout';
import { markHistorySeen } from '../../data/historySeen';
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
import { TimelineList } from './parts/TimelineList';
import { TypedHistory } from './TypedHistory';

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

  // The type and the period, from the URL.
  const [params, setParams] = useSearchParams();
  const filter = parseHistoryFilter(appParam(params, 'type'));
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
    search || !anchor ? 1 : windowsFor(Math.max(startMs, created ?? 0), anchor.timestamp);
  const query = useQuery<HistoryWindow[]>(
    anchor ? `timelines:${anchor.height}:${windowCount}` : null,
    (force) => loadHistoryWindows(anchor as HistoryAnchor, windowCount, { force })
  );
  // What the list reaches isn't new any more: the History tab's count drops it.
  const session = useSession();
  const me = session.status === 'ready' ? session.address : null;
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

  const choices = useMemo(() => historyFilterChoices(events, filter), [events, filter]);
  const filtered = useMemo(
    () => events.filter((e) => matchesHistoryFilter(e, filter) && e.at >= startMs),
    [events, filter, startMs]
  );

  const loadingOlder = Boolean(windows && query.fetching && !query.data);
  const shown = filtered.slice(0, limit);
  const hidden = filtered.length - shown.length;
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
        {filtered.length ? (
          <TimelineList
            events={shown}
            showSubject
            nowMs={nowMs}
            label={
              filter === 'all'
                ? 'MINTER events, newest first'
                : `MINTER events: ${label}, newest first`
            }
          />
        ) : loadingOlder ? null : filter === 'all' ? (
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
            {plural(filtered.length, 'event')} {scope}.
          </Typography>
          {hidden > 0 ? (
            <Button
              variant="outlined"
              onClick={() =>
                setLimit((n) => (hidden <= MORE_EVENTS ? filtered.length : n + MORE_EVENTS))
              }
              sx={{ minHeight: 44 }}
            >
              {hidden <= MORE_EVENTS ? `Show all ${filtered.length}` : `Show ${MORE_EVENTS} more`}
            </Button>
          ) : longer && !query.isError ? (
            <Button
              variant="outlined"
              onClick={() => {
                // The longer period's older days follow what is already shown.
                setLimit(filtered.length + MORE_EVENTS);
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
      </Typography>
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
