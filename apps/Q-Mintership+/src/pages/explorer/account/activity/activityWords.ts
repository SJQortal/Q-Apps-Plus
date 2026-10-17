/**
 * The Activity chart's words: each family's name, a period in dates, and a
 * period read out ("3 – 9 Mar 2024: 12 transactions, 8 payments, 4 qdn data").
 */
import type {
  ActivityBucket,
  ActivityFamily,
  ActivityMark,
  MarkKind,
} from '../../../../rules/explorer/activity';
import { TX_FAMILIES } from '../../../../rules/explorer/txFamilies';
import { formatCount, formatDate, formatDateTime, plural } from '../../../../utils/format';
import { ACTIVITY_FAMILIES } from '../../../../rules/explorer/activity';

const DAY = 86_400_000;

export const FAMILY_LABEL = Object.fromEntries(
  TX_FAMILIES.filter((f) => f.key !== 'all').map((f) => [f.key, f.label])
) as Record<ActivityFamily, string>;

/** A milestone with where it opens. */
export interface PlacedMark extends ActivityMark {
  to: string;
}

/** "3 Mar 2024", or with the time for a period under a day; "3 – 9 Mar 2024" for a range. */
export function periodWords(bucket: Pick<ActivityBucket, 'start' | 'end'>): string {
  const short = bucket.end - bucket.start < DAY;
  const at = short ? formatDateTime : formatDate;
  const from = at(bucket.start);
  const to = at(bucket.end - 1);
  return from === to ? from : `${from} – ${to}`;
}

/** "12 transactions: 8 payments, 4 QDN data". */
export function bucketWords(bucket: ActivityBucket): string {
  if (bucket.unread) return `${periodWords(bucket)}: not read yet`;
  const parts = ACTIVITY_FAMILIES.filter((f) => bucket.byFamily[f]).map(
    (f) => `${formatCount(bucket.byFamily[f] ?? 0)} ${FAMILY_LABEL[f].toLowerCase()}`
  );
  return `${periodWords(bucket)}: ${plural(bucket.total, 'transaction')}${
    parts.length ? `, ${parts.join(', ')}` : ''
  }`;
}

/** Each kind of milestone, as Activity's settings name it, in this order. */
export const MARK_KIND_LABELS: ReadonlyArray<{ kind: MarkKind; label: string }> = [
  { kind: 'joined', label: 'Joined MINTER, or invited' },
  { kind: 'asked', label: 'Asked to join MINTER' },
  { kind: 'nominated', label: 'Nominated' },
  { kind: 'declined', label: 'Join request declined' },
  { kind: 'removed', label: 'Removed from MINTER' },
  { kind: 'banned', label: 'Banned from MINTER' },
  { kind: 'unbanned', label: 'Ban lifted' },
  { kind: 'left', label: 'Left MINTER' },
  { kind: 'admin', label: 'Made a Minter Admin' },
  { kind: 'notAdmin', label: 'No longer a Minter Admin' },
  { kind: 'name', label: 'Names registered, bought, sold or renamed' },
  { kind: 'minting', label: 'Minting: first reward share, levels moved' },
];
