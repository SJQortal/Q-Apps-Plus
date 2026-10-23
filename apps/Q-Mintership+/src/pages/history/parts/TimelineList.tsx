/**
 * MINTER events as a list, grouped by month: what happened (or was only
 * proposed), to whom, when, and which Minter Admin proposed it. Proposals
 * that didn't happen carry a chip saying so. Every decision links to its own
 * page (/decisions/<signature>): open ones to sign or follow, decided ones
 * to see how they ended and whose answers counted. Joins and leaves need no
 * decision, so they have no link.
 *
 * With `groupAlike` (the Explorer's Mintership tab), events of one kind
 * that ended the same way the same day are one line ("Made a Minter Admin ·
 * 12 accounts") that opens to each of them (alikeEvents.ts).
 */
import { Fragment, useId, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, ButtonBase, Link, Typography, type ChipProps } from '@mui/material';
import { alpha, styled, useTheme } from '@mui/material/styles';
import type { SvgIconComponent } from '@mui/icons-material';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import PersonRemoveOutlinedIcon from '@mui/icons-material/PersonRemoveOutlined';
import RemoveModeratorOutlinedIcon from '@mui/icons-material/RemoveModeratorOutlined';
import { primarySoft } from '../../../hub-theme';
import { OUTCOME_LABEL, type TimelineEvent, type TimelineKind } from '../../../data/timeline';
import { PersonChip, PersonInline } from '../../../components/common/Person';
import { ExpandChevron } from '../../../components/common/ExpandChevron';
import { SmoothReveal } from '../../../components/common/SmoothReveal';
import { flowColumns, SECTION_COLUMN } from '../../../components/layout/flowColumns';
import { alikeEvents } from './alikeEvents';
import { ToneChip } from '../../../components/common/Section';
import { useDisplayName } from '../../../hooks/useDisplayName';
import { decisionPath } from '../../../routes/paths';
import { formatCount, formatDate, formatRelative } from '../../../utils/format';

const ICON: Record<TimelineKind, SvgIconComponent> = {
  invite: PersonAddAlt1OutlinedIcon,
  join: LoginOutlinedIcon,
  leave: LogoutOutlinedIcon,
  kick: PersonRemoveOutlinedIcon,
  ban: BlockOutlinedIcon,
  cancelBan: LockOpenOutlinedIcon,
  addAdmin: AdminPanelSettingsOutlinedIcon,
  removeAdmin: RemoveModeratorOutlinedIcon,
  cancelInvite: CancelOutlinedIcon,
  other: HowToRegOutlinedIcon,
};

const OUTCOME_CHIP: Record<
  Exclude<TimelineEvent['outcome'], 'done'>,
  { color: ChipProps['color']; variant: ChipProps['variant'] }
> = {
  pending: { color: 'primary', variant: 'filled' },
  expired: { color: 'default', variant: 'outlined' },
  rejected: { color: 'error', variant: 'outlined' },
};

const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });

/** A card whose rows bring their own padding (lists of events and comments). */
export const ListCard = styled('div')(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  overflow: 'hidden',
  minWidth: 0,
}));

function EventIcon({ event }: { event: TimelineEvent }) {
  const theme = useTheme();
  const Icon =
    event.outcome === 'pending' ? HourglassEmptyOutlinedIcon : (ICON[event.kind] ?? ICON.other);
  const tone =
    event.tone === 'good'
      ? theme.palette.success.main
      : event.tone === 'bad'
        ? theme.palette.error.main
        : null;
  return (
    <Box
      aria-hidden
      sx={{
        width: 36,
        height: 36,
        flexShrink: 0,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: tone ? alpha(tone, 0.14) : primarySoft(theme),
        color: tone ?? theme.palette.primary.main,
      }}
    >
      <Icon sx={{ fontSize: 20 }} />
    </Box>
  );
}

/** "12 Oct 2026", "expired 12 Oct 2026" or "rejected 12 Oct 2026": when it was decided. */
function decidedOn(event: TimelineEvent): string {
  const date = formatDate(event.at);
  if (event.outcome === 'expired') return `expired ${date}`;
  if (event.outcome === 'rejected') return `rejected ${date}`;
  return date;
}

function when(event: TimelineEvent, nowMs: number): string {
  if (event.outcome === 'pending') return `Proposed ${formatRelative(event.proposedAt, nowMs)}`;
  const decided = decidedOn(event);
  return decided.charAt(0).toUpperCase() + decided.slice(1);
}

/** A link under the event, with a 44 px tap target that doesn't widen the row's gaps. */
const ROW_LINK_SX = {
  alignSelf: 'flex-start',
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 44,
  my: -1,
} as const;

/**
 * A decided event's link to its decision's page. Its name says which one
 * ("Open the decision: Approved for MINTER, Ada, 3 Oct 2026"), as a list
 * can hold several of the same kind; it starts with the words on screen.
 */
function DecidedLink({ event }: { event: TimelineEvent }) {
  const who = useDisplayName(event.subject ?? '', event.subject ? undefined : null);
  const what = [event.title, event.subject ? who.label : null, decidedOn(event)]
    .filter(Boolean)
    .join(', ');
  return (
    <Link
      component={RouterLink}
      to={decisionPath(event.signature)}
      variant="body2"
      aria-label={`Open the decision: ${what}`}
      sx={ROW_LINK_SX}
    >
      Open the decision
    </Link>
  );
}

function TimelineItem({
  event,
  showSubject,
  showProposer,
  nowMs,
  fresh = false,
}: {
  event: TimelineEvent;
  showSubject: boolean;
  showProposer: boolean;
  nowMs: number;
  /** New since the reader last looked: tinted, with an edge and a "New" chip. */
  fresh?: boolean;
}) {
  const proposer =
    showProposer && event.creator && event.kind !== 'join' && event.kind !== 'leave'
      ? event.creator
      : null;
  const chip = event.outcome === 'done' ? null : OUTCOME_CHIP[event.outcome];
  return (
    <Box
      component="li"
      data-new={fresh ? '' : undefined}
      sx={(theme) => ({
        display: 'flex',
        gap: 1.5,
        py: 1.5,
        px: { xs: 1.5, sm: 2 },
        '& + &': { borderTop: 1, borderColor: 'divider' },
        ...(fresh
          ? {
              bgcolor: alpha(
                theme.palette.primary.main,
                theme.palette.mode === 'dark' ? 0.14 : 0.08
              ),
              boxShadow: `inset 4px 0 0 ${theme.palette.primary.main}`,
              // Outlined chips keep the card's own background, so their words keep their contrast.
              '& .MuiChip-outlined': { bgcolor: 'background.paper' },
            }
          : {}),
      })}
    >
      <EventIcon event={event} />
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{event.title}</Typography>
          {fresh ? <ToneChip size="small" label="New" color="primary" variant="filled" /> : null}
          {chip ? (
            <ToneChip
              size="small"
              label={OUTCOME_LABEL[event.outcome as keyof typeof OUTCOME_LABEL]}
              color={chip.color}
              variant={chip.variant}
            />
          ) : null}
        </Box>
        {showSubject && event.subject ? <PersonChip address={event.subject} size={28} /> : null}
        <Typography component="div" variant="body2" color="text.secondary">
          {when(event, nowMs)}
          {proposer && proposer !== event.subject ? (
            <>
              {event.outcome === 'pending' ? ' by ' : ' · proposed by '}
              <PersonInline address={proposer} />
            </>
          ) : null}
        </Typography>
        {event.detail || event.reason ? (
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            {[event.detail, event.reason ? `Reason: “${event.reason}”` : null]
              .filter(Boolean)
              .join(' · ')}
          </Typography>
        ) : null}
        {event.outcome === 'pending' ? (
          <Link
            component={RouterLink}
            to={decisionPath(event.signature)}
            variant="body2"
            sx={ROW_LINK_SX}
          >
            See it in Decisions
          </Link>
        ) : event.kind !== 'join' && event.kind !== 'leave' ? (
          <DecidedLink event={event} />
        ) : null}
      </Box>
    </Box>
  );
}

/** Events of one kind that ended the same way the same day: one line, opening to each. */
function TimelineGroup({
  events,
  showSubject,
  showProposer,
  nowMs,
}: {
  events: TimelineEvent[];
  showSubject: boolean;
  showProposer: boolean;
  nowMs: number;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const first = events[0];
  const chip = first.outcome === 'done' ? null : OUTCOME_CHIP[first.outcome];
  const subjects = [
    ...new Set(events.map((e) => e.subject).filter((s): s is string => Boolean(s))),
  ];
  const named = subjects.slice(0, 3);
  const many = showSubject && subjects.length > 1;
  return (
    <Box component="li">
      <ButtonBase
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          gap: 1.5,
          py: 1.5,
          px: { xs: 1.5, sm: 2 },
          textAlign: 'left',
          '&:hover': { bgcolor: 'action.hover' },
          '&.Mui-focusVisible': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 },
        }}
      >
        <EventIcon event={first} />
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
              {first.title}
            </Typography>
            <Box
              component="span"
              sx={(theme) => ({
                ...theme.typography.body2,
                fontWeight: 700,
                px: 0.75,
                py: 0.25,
                borderRadius: 999,
                bgcolor: primarySoft(theme),
                whiteSpace: 'nowrap',
              })}
            >
              {many
                ? `${formatCount(subjects.length)} accounts`
                : `${formatCount(events.length)} times`}
            </Box>
            {chip ? (
              <ToneChip
                size="small"
                label={OUTCOME_LABEL[first.outcome as keyof typeof OUTCOME_LABEL]}
                color={chip.color}
                variant={chip.variant}
              />
            ) : null}
          </Box>
          {many ? (
            <Typography component="div" variant="body2" sx={{ overflowWrap: 'anywhere' }}>
              {named.map((address, i) => (
                <Fragment key={address}>
                  {i > 0
                    ? i === named.length - 1 && subjects.length === named.length
                      ? ' and '
                      : ', '
                    : null}
                  <PersonInline address={address} />
                </Fragment>
              ))}
              {subjects.length > named.length
                ? ` and ${formatCount(subjects.length - named.length)} more`
                : null}
            </Typography>
          ) : null}
          <Typography variant="body2" color="text.secondary">
            {when(first, nowMs)}
          </Typography>
        </Box>
        <ExpandChevron open={open} />
      </ButtonBase>
      <SmoothReveal open={open}>
        <Box
          component="ul"
          id={panelId}
          aria-label={`${first.title}: ${formatCount(events.length)}`}
          sx={{
            listStyle: 'none',
            m: 0,
            p: 0,
            ml: { xs: 2, sm: 4 },
            borderLeft: 2,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          {events.map((event) => (
            <TimelineItem
              key={event.signature}
              event={event}
              showSubject={showSubject}
              showProposer={showProposer}
              nowMs={nowMs}
            />
          ))}
        </Box>
      </SmoothReveal>
    </Box>
  );
}

export interface TimelineListProps {
  events: TimelineEvent[];
  /** Show who each event is about (History); a person page leaves it out. */
  showSubject?: boolean;
  /** Show which Minter Admin proposed each (default true; off on an admin's own list). */
  showProposer?: boolean;
  nowMs: number;
  /** A label for the list, read by screen readers. */
  label: string;
  /** Events of one kind that ended the same way the same day as one line (the Explorer). */
  groupAlike?: boolean;
  /** New since this person last looked (a Minter Admin's History): marked so. */
  isNew?: (event: TimelineEvent) => boolean;
}

/** Events newest first, under a small month heading each. */
export function TimelineList({
  events,
  showSubject = false,
  showProposer = true,
  nowMs,
  label,
  groupAlike = false,
  isNew,
}: TimelineListProps) {
  const months: Array<{ month: string; events: TimelineEvent[] }> = [];
  for (const event of events) {
    const month = MONTH.format(new Date(event.at));
    const last = months[months.length - 1];
    if (last && last.month === month) last.events.push(event);
    else months.push({ month, events: [event] });
  }
  return (
    // A month under another; side by side in Full window on a big screen, newest first.
    <Box aria-label={label} role="group" sx={{ ...flowColumns(SECTION_COLUMN), gap: 1 }}>
      {months.map(({ month, events: list }) => (
        <Box key={month} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontWeight: 700, px: 0.5, mt: 0.5 }}
          >
            {month}
          </Typography>
          <ListCard>
            <Box
              component="ul"
              sx={{
                listStyle: 'none',
                m: 0,
                p: 0,
                '& > li + li': { borderTop: 1, borderColor: 'divider' },
              }}
            >
              {(groupAlike ? alikeEvents(list) : list.map((event) => [event])).map((run) =>
                run.length > 1 ? (
                  <TimelineGroup
                    key={run[0].signature}
                    events={run}
                    showSubject={showSubject}
                    showProposer={showProposer}
                    nowMs={nowMs}
                  />
                ) : (
                  <TimelineItem
                    key={run[0].signature}
                    event={run[0]}
                    showSubject={showSubject}
                    showProposer={showProposer}
                    nowMs={nowMs}
                    fresh={Boolean(isNew?.(run[0]))}
                  />
                )
              )}
            </Box>
          </ListCard>
        </Box>
      ))}
    </Box>
  );
}
