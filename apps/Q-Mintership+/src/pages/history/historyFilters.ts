/**
 * History's type filters, for the chips above "On chain": each kind of
 * event under a name of its own, in a fixed order (new minters first), and
 * `?type=<key>` in the URL, so Back from a decision's page keeps the choice.
 * Invites include the nominations that expired or were rejected (their rows
 * say so); a kick that declined a join request is its own type; removals
 * and bans share one; making, removing, becoming a Minter Admin and
 * stepping down share another. Pure, so the order and the names are pinned
 * by tests.
 */
import type { TimelineEvent } from '../../data/timeline';

export type HistoryType =
  | 'invite'
  | 'joinRequest'
  | 'joined'
  | 'declined'
  | 'removal'
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
  { key: 'removal', label: 'Removals and bans' },
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
      return 'removal';
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

/** `?type=` as a filter; anything else (or nothing) is All. */
export function parseHistoryFilter(value: string | null): HistoryFilter {
  return HISTORY_TYPES.some((t) => t.key === value) ? (value as HistoryType) : 'all';
}

export function historyTypeLabel(key: HistoryType): string {
  return HISTORY_TYPES.find((t) => t.key === key)?.label ?? key;
}

export function matchesHistoryFilter(
  e: Pick<TimelineEvent, 'kind' | 'decline' | 'joinRequest'>,
  filter: HistoryFilter
): boolean {
  return filter === 'all' || historyType(e) === filter;
}

/**
 * The chips to show: All, then each type with events, in HISTORY_TYPES
 * order, with its count. The chosen type stays even with none (after a
 * refresh, or from a link), so it can be seen and left.
 */
export function historyFilterChips(
  events: ReadonlyArray<Pick<TimelineEvent, 'kind' | 'decline' | 'joinRequest'>>,
  chosen: HistoryFilter
): Array<{ key: HistoryFilter; label: string; count: number }> {
  const counts = new Map<HistoryType, number>();
  for (const e of events) {
    const type = historyType(e);
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return [
    { key: 'all', label: 'All', count: events.length },
    ...HISTORY_TYPES.filter((t) => counts.has(t.key) || t.key === chosen).map((t) => ({
      ...t,
      count: counts.get(t.key) ?? 0,
    })),
  ];
}
