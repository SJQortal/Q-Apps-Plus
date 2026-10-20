/**
 * An account's activity over time (Overview → Activity, Simon 2026-10-16,
 * after Minter Helper's timeline): its transactions in periods of equal
 * length from when it was first seen to now, each period counted by
 * family, and the milestones marked on it. Pure; ActivityChart draws it.
 *
 * - Periods (`activityBuckets`): `count` of them between `from` and `to`;
 *   a period wholly before the oldest transaction read is `unread` (the
 *   account's older history hasn't been read yet), never "no activity".
 * - Milestones (`chainMarks`, `minterMarks`, `firstShareMark`): what the
 *   transactions read say (a name registered, bought, sold or renamed; a
 *   minting level moved), its first reward share (read on its own: the
 *   oldest of those read so far isn't the first, Simon 2026-10-18) and its
 *   MINTER story (joined, removed,
 *   banned, left, made or no longer a Minter Admin, ban lifted, asked to
 *   join), each with its time and the transaction behind it.
 */
import type { TimelineEvent } from '../../data/timeline';
import type { TxRow } from '../../data/types';
import { MEMBERS_ONLY_FROM } from './onlineShare';
import { familyOf, type TxFamilyKey } from './txFamilies';

export type ActivityFamily = Exclude<TxFamilyKey, 'all'>;

/** The families, in the order the bars stack them (bottom first) and the legend lists them. */
export const ACTIVITY_FAMILIES: readonly ActivityFamily[] = [
  'payments',
  'names',
  'minting',
  'groups',
  'qdn',
  'trading',
  'messages',
  'other',
];

export interface ActivityBucket {
  start: number;
  end: number;
  total: number;
  byFamily: Partial<Record<ActivityFamily, number>>;
  /** Wholly before the oldest transaction read: not read yet, not empty. */
  unread: boolean;
}

/**
 * `count` periods from `from` to `to`, counting `rows` (any order) by
 * family, leaving out the families in `hidden`. Periods that end before
 * `readFrom` (the oldest transaction read, when older ones exist) are unread.
 */
export function activityBuckets(
  rows: readonly TxRow[],
  options: {
    from: number;
    to: number;
    count: number;
    readFrom?: number | null;
    hidden?: ReadonlySet<ActivityFamily>;
  }
): ActivityBucket[] {
  const { from, to, count } = options;
  const span = Math.max(1, to - from);
  const size = span / count;
  const buckets: ActivityBucket[] = Array.from({ length: count }, (_, i) => {
    const start = from + i * size;
    const end = i === count - 1 ? to : start + size;
    return {
      start,
      end,
      total: 0,
      byFamily: {},
      unread: options.readFrom != null && end <= options.readFrom,
    };
  });
  for (const tx of rows) {
    if (tx.timestamp < from || tx.timestamp > to) continue;
    const family = familyOf(tx.type);
    if (options.hidden?.has(family)) continue;
    const i = Math.min(count - 1, Math.max(0, Math.floor((tx.timestamp - from) / size)));
    const bucket = buckets[i];
    bucket.total += 1;
    bucket.byFamily[family] = (bucket.byFamily[family] ?? 0) + 1;
  }
  return buckets;
}

/** How many of `rows` there are in each family. */
export function familyCounts(rows: readonly TxRow[]): Record<ActivityFamily, number> {
  const counts = Object.fromEntries(ACTIVITY_FAMILIES.map((f) => [f, 0])) as Record<
    ActivityFamily,
    number
  >;
  for (const tx of rows) counts[familyOf(tx.type)] += 1;
  return counts;
}

/** The rows in [start, end), newest first. */
export function rowsIn(rows: readonly TxRow[], start: number, end: number): TxRow[] {
  return rows
    .filter((tx) => tx.timestamp >= start && tx.timestamp < end)
    .sort((a, b) => b.timestamp - a.timestamp);
}

// ---- milestones -----------------------------------------------------------------

/** What a milestone is about, for its colour and icon. */
export type MarkKind =
  | 'name'
  | 'minting'
  | 'joined'
  | 'asked'
  | 'declined'
  | 'removed'
  | 'banned'
  | 'left'
  | 'admin'
  | 'notAdmin'
  | 'unbanned'
  | 'nominated';

export interface ActivityMark {
  key: string;
  at: number;
  kind: MarkKind;
  label: string;
  /** The transaction behind it, when there is one (a nomination is a QDN record). */
  signature?: string;
  /** Names registered the same day, in one milestone: how many (2 or more). */
  names?: number;
}

const DAY = 86_400_000;

const str = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null;

/**
 * Milestones in what was read: a name registered, bought, sold or renamed,
 * and minting levels moved to or from it. (Its first reward share is
 * firstShareMark's: what was read may not reach it.)
 */
export function chainMarks(rows: readonly TxRow[], address: string): ActivityMark[] {
  const marks: ActivityMark[] = [];
  // Level moves the same way in one block: one milestone ("in 6 transactions").
  const moves = new Map<string, { mark: ActivityMark; count: number; base: string }>();
  for (const tx of rows) {
    const mine = tx.creatorAddress === address;
    const name = str(tx.name);
    const push = (kind: MarkKind, label: string) =>
      marks.push({
        key: `${kind}:${tx.signature}`,
        at: tx.timestamp,
        kind,
        label,
        signature: tx.signature,
      });
    switch (tx.type) {
      case 'REGISTER_NAME':
        if (mine && name) push('name', `Registered the name “${name}”`);
        break;
      case 'BUY_NAME':
        if (mine && name) push('name', `Bought the name “${name}”`);
        else if (name && tx.seller === address) push('name', `Sold the name “${name}”`);
        break;
      case 'UPDATE_NAME': {
        const renamed = str(tx.newName);
        if (mine && name && renamed && renamed !== name)
          push('name', `Renamed “${name}” to “${renamed}”`);
        break;
      }
      case 'TRANSFER_PRIVS': {
        const base = mine ? 'Moved its minting level away' : 'Got a minting level';
        const key = `${mine}:${tx.blockHeight ?? tx.signature}`;
        const same = moves.get(key);
        if (same) {
          same.count += 1;
          same.mark.label = `${same.base} (${same.count} transactions)`;
          // The milestone stands at the earliest of them.
          if (tx.timestamp < same.mark.at) {
            same.mark.at = tx.timestamp;
            same.mark.signature = tx.signature;
          }
          break;
        }
        push('minting', base);
        moves.set(key, { mark: marks[marks.length - 1], count: 1, base });
        break;
      }
    }
  }
  return sameDayNames(marks).sort((a, b) => a.at - b.at);
}

/**
 * Its first reward share, as the minter or the recipient: the oldest in
 * its whole history (data/explorer/account.ts, getMintingStart), not the
 * oldest read so far, which moved as more was read. A reward share no
 * longer means minting on its own (Simon, 2026-10-18: "reward share was a
 * thing of the past"): since block 1,945,900 only MINTER members' minting
 * counts, so one from before then says it was the sponsorship era.
 */
export function firstShareMark(
  first: { timestamp: number; height?: number; signature?: string } | null | undefined
): ActivityMark[] {
  if (!first) return [];
  const before = first.height !== undefined && first.height < MEMBERS_ONLY_FROM;
  return [
    {
      key: `minting:${first.signature ?? first.timestamp}`,
      at: first.timestamp,
      kind: 'minting',
      label: before ? 'First reward share (sponsorship era)' : 'First reward share',
      signature: first.signature,
    },
  ];
}

/** Names registered on the same day as one milestone: "Registered 6 names: “A”, “B”, “C”, …". */
function sameDayNames(marks: ActivityMark[]): ActivityMark[] {
  const registered = (m: ActivityMark) =>
    m.kind === 'name' && m.label.startsWith('Registered the name');
  const byDay = new Map<number, ActivityMark[]>();
  for (const mark of marks.filter(registered)) {
    const day = Math.floor(mark.at / DAY);
    byDay.set(day, [...(byDay.get(day) ?? []), mark]);
  }
  const grouped = [...byDay.values()].map((day): ActivityMark => {
    if (day.length === 1) return day[0];
    const sorted = [...day].sort((a, b) => a.at - b.at);
    const names = sorted.map((m) => m.label.replace('Registered the name ', ''));
    return {
      ...sorted[0],
      key: `names:${sorted[0].signature}`,
      label: `Registered ${day.length} names: ${names.slice(0, 3).join(', ')}${day.length > 3 ? ', …' : ''}`,
      names: day.length,
    };
  });
  return [...marks.filter((m) => !registered(m)), ...grouped];
}

/** Its MINTER story's milestones: the events about it that took effect. */
export function minterMarks(events: readonly TimelineEvent[], address: string): ActivityMark[] {
  return events
    .filter((e) => e.subject === address && e.outcome === 'done')
    .flatMap((e): ActivityMark[] => {
      const kind = minterKind(e);
      return kind
        ? [{ key: `minter:${e.signature}`, at: e.at, kind, label: e.title, signature: e.signature }]
        : [];
    })
    .sort((a, b) => a.at - b.at);
}

function minterKind(e: TimelineEvent): MarkKind | null {
  if (e.becameMember) return 'joined';
  if (e.joinRequest) return 'asked';
  switch (e.kind) {
    case 'kick':
      return e.decline ? 'declined' : 'removed';
    case 'ban':
      return 'banned';
    case 'leave':
      return 'left';
    case 'addAdmin':
      return 'admin';
    case 'removeAdmin':
      return 'notAdmin';
    case 'cancelBan':
      return 'unbanned';
    case 'invite':
      return 'joined';
    default:
      return null;
  }
}

/** Date ticks for an axis `width` px wide: one about every 160 px, at least two. */
export function axisTicks(from: number, to: number, width: number): number[] {
  const count = Math.max(2, Math.min(24, Math.floor(width / 160)));
  return Array.from({ length: count + 1 }, (_, i) => from + ((to - from) * i) / count);
}
