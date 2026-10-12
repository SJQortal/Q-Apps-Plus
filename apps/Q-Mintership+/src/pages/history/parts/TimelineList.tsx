/**
 * MINTER events as a list, grouped by month: what happened (or was only
 * proposed), to whom, when, and which Minter Admin proposed it. Proposals
 * that didn't happen carry a chip saying so; open ones link to Decisions.
 */
import { Fragment, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Link, Typography, type ChipProps } from '@mui/material';
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
import { PersonChip } from '../../../components/common/Person';
import { ToneChip } from '../../../components/common/Section';
import { decisionPath } from '../../../routes/paths';
import { formatDate, formatRelative } from '../../../utils/format';

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

function Inline({ children }: { children: ReactNode }) {
  return (
    <Box
      component="span"
      sx={{ display: 'inline-flex', verticalAlign: 'middle', '& p, & span': { display: 'inline' } }}
    >
      {children}
    </Box>
  );
}

function when(event: TimelineEvent, nowMs: number): string {
  if (event.outcome === 'pending') return `Proposed ${formatRelative(event.proposedAt, nowMs)}`;
  const date = formatDate(event.at);
  if (event.outcome === 'expired') return `Expired ${date}`;
  if (event.outcome === 'rejected') return `Rejected ${date}`;
  return date;
}

function TimelineItem({
  event,
  showSubject,
  showProposer,
  nowMs,
}: {
  event: TimelineEvent;
  showSubject: boolean;
  showProposer: boolean;
  nowMs: number;
}) {
  const proposer =
    showProposer && event.creator && event.kind !== 'join' && event.kind !== 'leave'
      ? event.creator
      : null;
  const chip = event.outcome === 'done' ? null : OUTCOME_CHIP[event.outcome];
  return (
    <Box
      component="li"
      sx={{
        display: 'flex',
        gap: 1.5,
        py: 1.5,
        px: { xs: 1.5, sm: 2 },
        '& + &': { borderTop: 1, borderColor: 'divider' },
      }}
    >
      <EventIcon event={event} />
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{event.title}</Typography>
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
              <Inline>
                <PersonChip address={proposer} size={20} strong={false} />
              </Inline>
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
            sx={{
              alignSelf: 'flex-start',
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: 44,
              my: -1,
            }}
          >
            See it in Decisions
          </Link>
        ) : null}
      </Box>
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
}

/** Events newest first, under a small month heading each. */
export function TimelineList({
  events,
  showSubject = false,
  showProposer = true,
  nowMs,
  label,
}: TimelineListProps) {
  const months: Array<{ month: string; events: TimelineEvent[] }> = [];
  for (const event of events) {
    const month = MONTH.format(new Date(event.at));
    const last = months[months.length - 1];
    if (last && last.month === month) last.events.push(event);
    else months.push({ month, events: [event] });
  }
  return (
    <Box aria-label={label} role="group" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {months.map(({ month, events: list }) => (
        <Fragment key={month}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontWeight: 700, px: 0.5, mt: 0.5 }}
          >
            {month}
          </Typography>
          <ListCard>
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {list.map((event) => (
                <TimelineItem
                  key={event.signature}
                  event={event}
                  showSubject={showSubject}
                  showProposer={showProposer}
                  nowMs={nowMs}
                />
              ))}
            </Box>
          </ListCard>
        </Fragment>
      ))}
    </Box>
  );
}
