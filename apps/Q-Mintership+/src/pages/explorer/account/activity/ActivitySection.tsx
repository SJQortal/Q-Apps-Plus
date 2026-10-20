/**
 * Overview's Activity (Simon, 2026-10-16, after Minter Helper's timeline):
 * the account's transactions over time as a chart (ActivityChart), from
 * when it was first seen to now, with its milestones marked on it: joined
 * MINTER, removed, banned, left, made a Minter Admin, a name registered,
 * bought or sold, its first reward share, each nomination.
 *
 * - What it reads: its newest 1,000 transactions once the section nears the
 *   screen (or the number picked in its settings, the gear), then as many
 *   more at a time on request, or all of it
 *   (useActivityRows); the account's own list, shared with its
 *   Transactions tab. What wasn't read yet is hatched and said.
 * - Its MINTER milestones and nominations: its own MINTER history and its
 *   nominations, the same cached reads as its Mintership tab (without the
 *   histories of others a Minter Admin removed, which only its own
 *   milestones don't need).
 * - A family in the legend can be hidden. A period picked on the chart
 *   lists its transactions under it, each opening as in the Transactions
 *   tab; the milestones are listed too, each a link.
 * - Full screen: the same, as tall as the screen allows, in a dialog.
 */
import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Chip, IconButton, Link, Skeleton, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import OpenInFullOutlinedIcon from '@mui/icons-material/OpenInFullOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { useAtomValue } from 'jotai';
import { ResponsiveDialog } from '../../../../components/common/ResponsiveDialog';
import { Section } from '../../../../components/common/Section';
import { ErrorState } from '../../../../components/common/states';
import { markAccent } from '../../../../components/explorer/activityColours';
import { txFamilyAccent } from '../../../../components/explorer/txFamilyAccent';
import { TxList } from '../../../../components/explorer/TxListRow';
import type { FirstSeen } from '../../../../data/explorer/account';
import { useDisplayName } from '../../../../hooks/useDisplayName';
import { useInView } from '../../../../hooks/useInView';
import { usePhoneLayout } from '../../../../hooks/usePhoneLayout';
import { getMintingStart } from '../../../../data/explorer/account';
import { useQuery, type UseQueryResult } from '../../../../hooks/useQuery';
import { explorerAccountPath, explorerTxPath, nominationPath } from '../../../../routes/paths';
import {
  ACTIVITY_FAMILIES,
  chainMarks,
  firstShareMark,
  familyCounts,
  minterMarks,
  rowsIn,
  type ActivityBucket,
  type ActivityFamily,
} from '../../../../rules/explorer/activity';
import { familyOf } from '../../../../rules/explorer/txFamilies';
import { formatCount, formatDate, plural } from '../../../../utils/format';
import { getChainNow } from '../../../../data/chain';
import { FALLBACK_MS_PER_BLOCK } from '../../../../data/constants';
import { getGroupInfo } from '../../../../data/group';
import { loadNominationsFor } from '../../../../data/nominations';
import { buildTimeline, withOwnSubject } from '../../../../data/timeline';
import { getAddressHistory } from '../../../../data/txs';
import { ActivityChart } from './ActivityChart';
import { FAMILY_LABEL, periodWords, type PlacedMark } from './activityWords';
import { ACTIVITY_MAX, useActivityRows, type ActivityRows } from './useActivityRows';
import { useViewState } from '../../../../hooks/useViewState';
import {
  activityFirstReadAtom,
  activityHiddenMarksAtom,
  clampActivityRead,
} from '../../../../state/settings';
import { ActivitySettingsDialog } from './ActivitySettings';

const DAY = 86_400_000;
/** MINTER's approval window when its settings can't be read (as on the Minter Profile). */
const DEFAULT_MAX_BLOCK_DELAY = 10_080;
/** A period's transactions listed before "Show all". */
const PERIOD_ROWS = 20;
/** Milestones listed before "Show all". */
const MARKS_SHOWN = 8;

interface ActivityState {
  rows: ActivityRows;
  /** How many it reads at first and on each Read older (the person's setting). */
  step: number;
  label: string;
  address: string;
  from: number;
  to: number;
  readFrom: number | null;
  firstSeenAt: number | null;
  marks: PlacedMark[];
  hidden: ReadonlySet<ActivityFamily>;
  toggle: (family: ActivityFamily) => void;
  selected: { start: number; end: number } | null;
  select: (bucket: ActivityBucket | null) => void;
}

/** What was read, and the ways to read more. */
function ReadLine({ state }: { state: ActivityState }) {
  const { rows, from, firstSeenAt } = state;
  const list = rows.rows ?? [];
  const oldest = list.length ? list[list.length - 1].timestamp : null;
  let words: string;
  if (!list.length) words = rows.done ? 'No transactions found.' : 'Reading its transactions…';
  // Everything is read: said plainly, so no Read older is missed (Simon, 2026-10-18, on a phone).
  else if (rows.done)
    words = `All ${plural(list.length, 'transaction')}, back to its first on ${formatDate(oldest ?? from)}. Nothing older to read.`;
  else
    words = `Its newest ${plural(list.length, 'transaction')}, back to ${formatDate(oldest ?? from)}${
      firstSeenAt ? `. Its history goes back to ${formatDate(firstSeenAt)}` : ''
    }: older ones aren't read yet (the hatched part).`;
  const canRead = !rows.done && list.length > 0 && list.length < ACTIVITY_MAX;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <Typography role="status" variant="body2" color="text.secondary">
        {rows.reading && list.length
          ? `Reading… ${formatCount(list.length)} of up to ${formatCount(rows.target)} read.`
          : words}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <SettingsButton />
        {canRead ? (
          <>
            <Button
              variant="outlined"
              onClick={rows.readMore}
              disabled={rows.reading}
              sx={{ minHeight: 44 }}
            >
              Read {formatCount(state.step)} older
            </Button>
            <Button onClick={rows.readAll} disabled={rows.reading} sx={{ minHeight: 44 }}>
              Read all of it
            </Button>
          </>
        ) : null}
      </Box>
      {rows.error ? (
        <ErrorState
          compact
          title="Couldn't read more of its transactions."
          error={rows.error}
          onRetry={rows.retry}
        />
      ) : null}
    </Box>
  );
}

/** The gear: Activity's settings (how much it reads at first, which milestones it shows). */
function SettingsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tooltip title="Activity settings">
        <IconButton
          aria-label="Activity settings"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          sx={{ width: 44, height: 44 }}
        >
          <SettingsOutlinedIcon />
        </IconButton>
      </Tooltip>
      {open ? <ActivitySettingsDialog open onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** Each family with its count: press one to hide it from the chart (and again to show it). */
function Legend({ state }: { state: ActivityState }) {
  const theme = useTheme();
  const counts = familyCounts(state.rows.rows ?? []);
  const present = ACTIVITY_FAMILIES.filter((f) => counts[f] > 0);
  if (!present.length) return null;
  return (
    <Box
      component="ul"
      aria-label="Kinds of transactions: press one to hide or show it"
      sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}
    >
      {present.map((family) => {
        const shown = !state.hidden.has(family);
        const colour = txFamilyAccent(theme, family);
        return (
          <li key={family}>
            <Chip
              clickable
              onClick={() => state.toggle(family)}
              aria-pressed={shown}
              variant={shown ? 'filled' : 'outlined'}
              icon={
                <Box
                  component="span"
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '3px',
                    bgcolor: shown ? colour : 'transparent',
                    border: `2px solid ${colour}`,
                    ml: '8px !important',
                  }}
                />
              }
              label={`${FAMILY_LABEL[family]} ${formatCount(counts[family])}`}
              sx={{
                minHeight: 36,
                fontSize: 14,
                ...(shown ? {} : { color: 'text.secondary', textDecoration: 'line-through' }),
              }}
            />
          </li>
        );
      })}
    </Box>
  );
}

/** The milestones as links, oldest first. */
function Milestones({ marks }: { marks: readonly PlacedMark[] }) {
  const theme = useTheme();
  const [all, setAll] = useViewState('milestones:all', false);
  if (!marks.length) return null;
  const shown = all ? marks : marks.slice(0, MARKS_SHOWN);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography component="h3" sx={{ fontWeight: 700, fontSize: 16 }}>
        Milestones
      </Typography>
      <Box
        component="ul"
        aria-label="Milestones"
        sx={{
          listStyle: 'none',
          m: 0,
          p: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))',
          columnGap: 2,
        }}
      >
        {shown.map((mark) => (
          <li key={mark.key}>
            <Link
              component={RouterLink}
              to={mark.to}
              underline="hover"
              color="inherit"
              sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 44 }}
            >
              <Box
                aria-hidden
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  flexShrink: 0,
                  bgcolor: markAccent(theme, mark.kind),
                }}
              />
              <Box component="span" sx={{ minWidth: 0 }}>
                <Box component="span" sx={{ display: 'block', overflowWrap: 'anywhere' }}>
                  {mark.label}
                </Box>
                <Typography component="span" variant="body2" color="text.secondary">
                  {formatDate(mark.at)}
                </Typography>
              </Box>
            </Link>
          </li>
        ))}
      </Box>
      {marks.length > MARKS_SHOWN ? (
        <Button
          onClick={() => setAll((open) => !open)}
          aria-expanded={all}
          sx={{ alignSelf: 'flex-start', minHeight: 44 }}
        >
          {all ? 'Show fewer' : `Show all ${marks.length}`}
        </Button>
      ) : null}
    </Box>
  );
}

/** The picked period's transactions, newest first. */
function PeriodList({ state }: { state: ActivityState }) {
  const [all, setAll] = useViewState('period:all', false);
  const picked = state.selected;
  const rows = useMemo(
    () =>
      picked
        ? rowsIn(state.rows.rows ?? [], picked.start, picked.end).filter(
            (tx) => !state.hidden.has(familyOf(tx.type))
          )
        : [],
    [picked, state.rows.rows, state.hidden]
  );
  if (!picked) return null;
  const period = periodWords(picked);
  const shown = all ? rows : rows.slice(0, PERIOD_ROWS);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <Box role="status" sx={{ mr: 'auto' }}>
          <Typography component="h3" sx={{ fontWeight: 700, fontSize: 16 }}>
            {plural(rows.length, 'transaction')} · {period}
          </Typography>
        </Box>
        <Button onClick={() => state.select(null)} sx={{ minHeight: 44 }}>
          Close the list
        </Button>
      </Box>
      {rows.length ? (
        <TxList rows={shown} viewpoint={state.address} label={`Transactions, ${period}`} />
      ) : null}
      {rows.length > shown.length ? (
        <Button onClick={() => setAll(true)} sx={{ alignSelf: 'flex-start', minHeight: 44 }}>
          Show all {formatCount(rows.length)}
        </Button>
      ) : null}
    </Box>
  );
}

/** Everything but the section's frame: inline, or full screen. */
function ActivityPanel({ state, height }: { state: ActivityState; height: number }) {
  const list = state.rows.rows;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
      <ReadLine state={state} />
      {list === undefined ? (
        <Skeleton variant="rounded" height={height + 48} aria-hidden />
      ) : list.length ? (
        <>
          <Legend state={state} />
          <ActivityChart
            rows={list}
            from={state.from}
            to={state.to}
            readFrom={state.readFrom}
            hidden={state.hidden}
            marks={state.marks}
            height={height}
            selected={state.selected?.start ?? null}
            onSelect={state.select}
            label={state.label}
          />
          <PeriodList state={state} />
          <Milestones marks={state.marks} />
        </>
      ) : null}
    </Box>
  );
}

function ActivityBody({
  address,
  firstSeen,
}: {
  address: string;
  firstSeen: UseQueryResult<FirstSeen>;
}) {
  const phone = usePhoneLayout();
  const { label } = useDisplayName(address);
  // How much it reads at first, and the milestones it leaves out: the person's settings.
  const step = clampActivityRead(useAtomValue(activityFirstReadAtom));
  const hiddenMarks = useAtomValue(activityHiddenMarksAtom);
  const rows = useActivityRows(address, true, step);
  // Its own MINTER history (the Mintership tab's read, shared), for its MINTER milestones.
  const history = useQuery(`history:${address}`, (force) => getAddressHistory(address, { force }));
  const chain = useQuery('chain:now', (force) => getChainNow({ force }));
  const group = useQuery('group:info', (force) => getGroupInfo({ force }));
  const nominationsQ = useQuery(`nominations:for:${address}`, (force) =>
    loadNominationsFor(address, { force })
  );
  // Its first reward share, from its whole history (one row; Node online reads it too).
  const mintingStart = useQuery(`xmintstart:${address}`, () => getMintingStart(address));
  const events = useMemo(
    () =>
      history.data
        ? buildTimeline(withOwnSubject(history.data.rows, address), {
            msPerBlock: chain.data?.msPerBlock ?? FALLBACK_MS_PER_BLOCK,
            maximumBlockDelay: group.data?.maximumBlockDelay ?? DEFAULT_MAX_BLOCK_DELAY,
          })
        : null,
    [history.data, chain.data, group.data, address]
  );
  // What is picked on the chart is kept for Back (useViewState).
  const [hidden, setHidden] = useViewState<ReadonlySet<ActivityFamily>>(
    'activity:hidden',
    () => new Set()
  );
  const [selected, setSelected] = useViewState<{ start: number; end: number } | null>(
    'activity:selected',
    null
  );
  const [full, setFull] = useViewState('activity:full', false);
  // "Now", to the minute, so the chart doesn't redraw on every render.
  const to = Math.ceil(Date.now() / 60_000) * 60_000;

  const list = useMemo(() => rows.rows ?? [], [rows.rows]);
  const oldest = list.length ? list[list.length - 1].timestamp : null;
  const firstSeenAt = firstSeen.data?.firstSeen?.timestamp ?? null;
  // All of it once its first transaction is read; until then what was read, after a
  // short hatched stretch that says older history exists.
  const from =
    rows.done || oldest === null
      ? Math.min(...[firstSeenAt, oldest].filter((t): t is number => t !== null), to - 30 * DAY)
      : Math.max(firstSeenAt ?? 0, oldest - Math.max(DAY, (to - oldest) * 0.15));
  const readFrom = rows.done ? null : oldest;

  const nominations = nominationsQ.data;
  const marks = useMemo<PlacedMark[]>(() => {
    const placed: PlacedMark[] = [
      ...minterMarks(events ?? [], address),
      ...chainMarks(list, address),
      ...firstShareMark(mintingStart.data?.firstShare),
    ].map((mark) => ({
      ...mark,
      // Several names in one milestone: its Names tab lists them all.
      to: mark.names ? explorerAccountPath(address, 'names') : explorerTxPath(mark.signature ?? ''),
    }));
    for (const n of nominations ?? [])
      if (n.nomination)
        placed.push({
          key: `nominated:${n.nomination.identifier}`,
          at: n.nomination.publishedAt,
          kind: 'nominated',
          label: `Nominated by ${n.nomination.publisher.name}`,
          to: nominationPath(address),
        });
    return placed
      .filter((m) => m.at >= from && m.at <= to && !hiddenMarks.includes(m.kind))
      .sort((a, b) => a.at - b.at);
  }, [events, list, nominations, mintingStart.data, address, from, to, hiddenMarks]);

  const state: ActivityState = {
    rows,
    step,
    label,
    address,
    from,
    to,
    readFrom,
    firstSeenAt,
    marks,
    hidden,
    toggle: (family) =>
      setHidden((current) => {
        const next = new Set(current);
        if (next.has(family)) next.delete(family);
        else next.add(family);
        return next;
      }),
    selected,
    select: (bucket) => setSelected(bucket ? { start: bucket.start, end: bucket.end } : null),
  };
  const fullHeight = Math.max(220, Math.min(720, window.innerHeight - 420));

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: -1 }}>
        <Tooltip title="Full screen">
          <IconButton
            aria-label="Show the activity full screen"
            onClick={() => setFull(true)}
            sx={{ width: 44, height: 44 }}
          >
            <OpenInFullOutlinedIcon />
          </IconButton>
        </Tooltip>
      </Box>
      {full ? null : <ActivityPanel state={state} height={phone ? 150 : 200} />}
      <ResponsiveDialog
        open={full}
        onClose={() => setFull(false)}
        title={`Activity: ${label}`}
        fullScreen
      >
        {full ? <ActivityPanel state={state} height={fullHeight} /> : null}
      </ResponsiveDialog>
    </>
  );
}

export function ActivitySection({
  address,
  firstSeen,
}: {
  address: string;
  firstSeen: UseQueryResult<FirstSeen>;
}) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  // Its reads start once the section nears the screen.
  const near = useInView(node, '300px');
  return (
    <Section title="Activity" id="overview-activity">
      <Box ref={setNode} sx={{ minWidth: 0 }}>
        {near ? (
          <ActivityBody address={address} firstSeen={firstSeen} />
        ) : (
          <Skeleton variant="rounded" height={260} aria-hidden />
        )}
      </Box>
    </Section>
  );
}
