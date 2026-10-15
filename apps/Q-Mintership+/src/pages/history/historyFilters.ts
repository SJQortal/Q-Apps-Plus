/**
 * History's filters: a type of event and a period, both in the URL
 * (`?type=<key>`, `?period=60|120|365` or `?from=YYYY-MM-DD`; the last 30
 * days without either), so Back from a decision's page and Hub's Copy link
 * keep them.
 *
 * Each kind of event has a name of its own, in a fixed order (new minters
 * first). Invites include the nominations that expired or were rejected
 * (their rows say so); a kick that declined a join request is its own type,
 * as are removals and bans; making, removing, becoming a Minter Admin and
 * stepping down share one. Decision types are searched by type over the
 * period (data/historySearch.ts); all types, joins, join requests and leaves
 * are read in 30-day windows. Pure, so the order and the names are pinned by
 * tests.
 */
import { HISTORY_MAX_WINDOWS, HISTORY_WINDOW_DAYS, type TimelineEvent } from '../../data/timeline';
import type { GroupTxType } from '../../data/types';
import { formatDate } from '../../utils/format';
import { DAY_MS, fromDateInput } from '../activity/range';

export type HistoryType =
  | 'invite'
  | 'joinRequest'
  | 'joined'
  | 'declined'
  | 'removal'
  | 'ban'
  | 'left'
  | 'liftBan'
  | 'cancelInvite'
  | 'admins'
  | 'other';

export type HistoryFilter = 'all' | HistoryType;

export const HISTORY_TYPES: ReadonlyArray<{ key: HistoryType; label: string }> = [
  { key: 'invite', label: 'Invites' },
  { key: 'joinRequest', label: 'Join requests' },
  { key: 'joined', label: 'Joined MINTER' },
  { key: 'declined', label: 'Declined requests' },
  { key: 'removal', label: 'Removals' },
  { key: 'ban', label: 'Bans' },
  { key: 'left', label: 'Left MINTER' },
  { key: 'liftBan', label: 'Bans lifted' },
  { key: 'cancelInvite', label: 'Cancelled invites' },
  { key: 'admins', label: 'Minter Admin changes' },
  { key: 'other', label: 'Other changes' },
];

export function historyType(
  e: Pick<TimelineEvent, 'kind' | 'decline' | 'joinRequest'>
): HistoryType {
  switch (e.kind) {
    case 'invite':
      return 'invite';
    case 'join':
      return e.joinRequest ? 'joinRequest' : 'joined';
    case 'kick':
      return e.decline ? 'declined' : 'removal';
    case 'ban':
      return 'ban';
    case 'leave':
      return 'left';
    case 'cancelBan':
      return 'liftBan';
    case 'cancelInvite':
      return 'cancelInvite';
    case 'addAdmin':
    case 'removeAdmin':
      return 'admins';
    default:
      return 'other';
  }
}

/**
 * The transaction types a filter searches by type over the period, or null
 * for the ones read in 30-day windows (all, joins, join requests, leaves).
 */
export function searchTypesFor(filter: HistoryFilter): readonly GroupTxType[] | null {
  switch (filter) {
    case 'invite':
      return ['GROUP_INVITE'];
    case 'declined':
    case 'removal':
      return ['GROUP_KICK'];
    case 'ban':
      return ['GROUP_BAN'];
    case 'liftBan':
      return ['CANCEL_GROUP_BAN'];
    case 'cancelInvite':
      return ['CANCEL_GROUP_INVITE'];
    case 'admins':
      return ['ADD_GROUP_ADMIN', 'REMOVE_GROUP_ADMIN'];
    default:
      return null;
  }
}

/** `?type=` as a filter; anything else (or nothing) is All. */
export function parseHistoryFilter(value: string | null): HistoryFilter {
  return HISTORY_TYPES.some((t) => t.key === value) ? (value as HistoryType) : 'all';
}

export function historyFilterLabel(key: HistoryFilter): string {
  if (key === 'all') return 'All';
  return HISTORY_TYPES.find((t) => t.key === key)?.label ?? key;
}

export function matchesHistoryFilter(
  e: Pick<TimelineEvent, 'kind' | 'decline' | 'joinRequest'>,
  filter: HistoryFilter
): boolean {
  return filter === 'all' || historyType(e) === filter;
}

/**
 * The type choices: All, then every type in HISTORY_TYPES order. Other
 * changes only shows when `events` hold one or it is chosen: History's reads
 * hold only MINTER's own kinds of change.
 */
export function historyFilterChoices(
  events: ReadonlyArray<Pick<TimelineEvent, 'kind' | 'decline' | 'joinRequest'>>,
  chosen: HistoryFilter
): Array<{ key: HistoryFilter; label: string }> {
  const other = chosen === 'other' || events.some((e) => historyType(e) === 'other');
  return [
    { key: 'all', label: 'All' },
    ...HISTORY_TYPES.filter((t) => t.key !== 'other' || other).map((t) => ({ ...t })),
  ];
}

// ---- the period ------------------------------------------------------------

export const PERIOD_DAYS = [30, 60, 120, 365] as const;
export type PeriodDays = (typeof PERIOD_DAYS)[number];

export type HistoryPeriod = { kind: 'days'; days: PeriodDays } | { kind: 'from'; date: string };

export const DEFAULT_PERIOD: HistoryPeriod = { kind: 'days', days: 30 };

/** `?period=` and `?from=` as a period; anything else is the last 30 days. */
export function parseHistoryPeriod(period: string | null, from: string | null): HistoryPeriod {
  if (from && fromDateInput(from) !== null) return { kind: 'from', date: from };
  const days = Number(period);
  if (PERIOD_DAYS.includes(days as PeriodDays)) return { kind: 'days', days: days as PeriodDays };
  return DEFAULT_PERIOD;
}

/** The value a period select holds: '30', '60', '120', '365' or 'from'. */
export function periodKey(period: HistoryPeriod): string {
  return period.kind === 'days' ? String(period.days) : period.kind;
}

/** The next longer period after the last 30, 60 or 120 days (none after a year or a date). */
export function longerPeriod(period: HistoryPeriod): { kind: 'days'; days: PeriodDays } | null {
  if (period.kind !== 'days') return null;
  const next = PERIOD_DAYS[PERIOD_DAYS.indexOf(period.days) + 1];
  return next ? { kind: 'days', days: next } : null;
}

export const PERIOD_CHOICES: ReadonlyArray<{ key: string; label: string }> = [
  { key: '30', label: 'Last 30 days' },
  { key: '60', label: 'Last 60 days' },
  { key: '120', label: 'Last 120 days' },
  { key: '365', label: 'Last year' },
  { key: 'from', label: 'From a date…' },
];

/** When the period starts (ms). */
export function periodStartMs(period: HistoryPeriod, nowMs: number): number {
  if (period.kind === 'from') return fromDateInput(period.date) ?? nowMs - 30 * DAY_MS;
  return nowMs - period.days * DAY_MS;
}

/** "in the last 60 days", "in the last year", "since 3 Jan 2026". */
export function periodWords(period: HistoryPeriod, startMs: number): string {
  if (period.kind === 'from') return `since ${formatDate(startMs)}`;
  return period.days === 365 ? 'in the last year' : `in the last ${period.days} days`;
}

/** "Show the last 60 days", "Show the last year": the button for a longer period. */
export function longerPeriodLabel(period: HistoryPeriod): string {
  return `Show ${periodWords(period, 0).replace(/^in /, '')}`;
}

/** The 30-day windows that reach back to `startMs` from `anchorMs` (at least 1). */
export function windowsFor(startMs: number, anchorMs: number): number {
  const days = (anchorMs - startMs) / DAY_MS;
  return Math.min(HISTORY_MAX_WINDOWS, Math.max(1, Math.ceil(days / HISTORY_WINDOW_DAYS)));
}
