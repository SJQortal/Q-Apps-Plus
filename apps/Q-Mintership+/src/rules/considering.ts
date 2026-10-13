/**
 * Who is considering a decision or a waiting nomination ("I've looked at
 * this, not sure yet"). Pure; data/considering.ts reads the records.
 *
 * - Only records whose publisher is a current Minter Admin reach here (the
 *   loader re-checks it on every read).
 * - Per admin only their latest publish counts; a `cleared` one means "no
 *   longer considering".
 * - A later answer on chain by the same admin (a signature, a rejection or
 *   a withdrawn signature) replaces it in the display. A record published
 *   after their latest answer (reconsidering a rejection) shows until their
 *   next one.
 * - A nomination's record (keyed by the nominee) carries over to its invite
 *   once the first signature puts it on chain, as long as it was published
 *   in this round (`since`).
 */
import type { ConsideringRecord } from '../data/records';

export interface ConsideringEntry {
  publisher: { name: string; address: string };
  record: ConsideringRecord;
  /** The QDN row's newest timestamp (trusted over the body). */
  publishedAt: number;
}

export interface ConsideringTargetQuery {
  /** The decision's pending transaction. */
  pendingSignature?: string | null;
  /** The nominee, for a waiting nomination or an invite's nomination. */
  nomineeAddress?: string | null;
  /** Only nominee records published from this time on (ms): this round's. */
  since?: number;
}

/** An admin's latest answer on the decision (confirmed or on its way), for superseding. */
export interface ChainAnswer {
  address?: string;
  timestamp: number;
}

export interface ConsideringPerson {
  address: string;
  name: string;
  note: string | null;
  publishedAt: number;
}

function matches(entry: ConsideringEntry, target: ConsideringTargetQuery): boolean {
  const r = entry.record;
  if (r.pendingSignature)
    return Boolean(target.pendingSignature) && r.pendingSignature === target.pendingSignature;
  return (
    Boolean(target.nomineeAddress) &&
    r.nomineeAddress === target.nomineeAddress &&
    entry.publishedAt >= (target.since ?? Number.NEGATIVE_INFINITY)
  );
}

/**
 * The Minter Admins considering `target` now, oldest first: each admin's
 * latest matching record, unless it is cleared or an answer on chain by
 * them came after it.
 */
export function consideringFor(
  entries: ConsideringEntry[],
  target: ConsideringTargetQuery,
  answers: ChainAnswer[] = []
): ConsideringPerson[] {
  const latest = new Map<string, ConsideringEntry>();
  for (const entry of entries) {
    if (!matches(entry, target)) continue;
    const current = latest.get(entry.publisher.address);
    if (!current || entry.publishedAt > current.publishedAt)
      latest.set(entry.publisher.address, entry);
  }
  const people: ConsideringPerson[] = [];
  for (const entry of latest.values()) {
    if (entry.record.cleared) continue;
    const answeredLater = answers.some(
      (a) => a.address === entry.publisher.address && a.timestamp > entry.publishedAt
    );
    if (answeredLater) continue;
    people.push({
      address: entry.publisher.address,
      name: entry.publisher.name,
      note: entry.record.note ?? null,
      publishedAt: entry.publishedAt,
    });
  }
  return people.sort((a, b) => a.publishedAt - b.publishedAt);
}

/** A publish from this device still on its way (writes/optimistic.ts PendingWrite). */
export interface ConsideringWrite {
  status: 'sending' | 'confirming' | 'failed';
  at: number;
}

export interface MyConsideringState {
  /** Shown as considering (from QDN, or a publish from this device still on its way). */
  considering: boolean;
  /** QDN shows it; false while this device's publish is on its way. */
  settled: boolean;
  /** A publish from this device is being sent or is on its way: no new one until it shows. */
  busy: boolean;
  /** Being sent right now ('set': Considering, 'clear': No longer considering). */
  sending: 'set' | 'clear' | null;
}

/** Entries older than this are dropped (as writes/optimistic.ts does). */
const WRITE_EXPIRE_MS = 15 * 60_000;

/**
 * This admin's Considering as the card shows it: what QDN says, unless a
 * newer publish from this device ("Considering" or "No longer considering")
 * hasn't shown up there yet.
 */
export function myConsideringState(
  people: ConsideringPerson[],
  myAddress: string,
  pending: { set: ConsideringWrite | null; clear: ConsideringWrite | null },
  nowMs = Date.now()
): MyConsideringState {
  const onQdn = people.some((p) => p.address === myAddress);
  const live = (w: ConsideringWrite | null) =>
    w && (w.status === 'sending' || w.status === 'confirming') && nowMs - w.at <= WRITE_EXPIRE_MS
      ? w
      : null;
  const set = live(pending.set);
  const clear = live(pending.clear);
  const newest =
    set && clear ? (set.at >= clear.at ? 'set' : 'clear') : set ? 'set' : clear ? 'clear' : null;
  const write = newest === 'set' ? set : newest === 'clear' ? clear : null;
  if (!newest || !write) return { considering: onQdn, settled: true, busy: false, sending: null };
  if (write.status === 'sending')
    return { considering: onQdn, settled: true, busy: true, sending: newest };
  const want = newest === 'set';
  const settled = onQdn === want;
  return { considering: want, settled, busy: !settled, sending: null };
}

/** "1 Minter Admin is considering", "3 Minter Admins are considering". */
export function consideringCountText(count: number): string {
  return count === 1
    ? '1 Minter Admin is considering'
    : `${count.toLocaleString('en-US')} Minter Admins are considering`;
}
