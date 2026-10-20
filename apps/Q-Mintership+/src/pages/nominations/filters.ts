/**
 * Decisions → Nominations' list logic, pure so it is tested on its own: the
 * state filters, the name/address search, when a decided nomination ended,
 * whether it can be made again, and what the signed-in member already did
 * for a nomination.
 */
import type { ChainNow } from '../../data/chain';
import type { Nomination } from '../../data/nominations';
import { decidedAt, waitingEndsAt } from '../../rules/nomination';
import { waitingWindowBlocks, type GroupDelays } from '../../rules/timing';
import type { PendingWrite } from '../../writes/optimistic';

export type NominationFilter = 'all' | 'waiting' | 'signing' | 'approved';

export const FILTERS: Array<{ key: NominationFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'waiting', label: 'Waiting for a Minter Admin' },
  { key: 'signing', label: 'Collecting approvals' },
  { key: 'approved', label: 'Approved' },
];

export function parseFilter(value: string | null): NominationFilter {
  return FILTERS.some((f) => f.key === value) ? (value as NominationFilter) : 'all';
}

export function matchesFilter(n: Nomination, filter: NominationFilter): boolean {
  return filter === 'all' || n.state === filter;
}

export function countByFilter(list: Nomination[]): Record<NominationFilter, number> {
  const counts: Record<NominationFilter, number> = { all: 0, waiting: 0, signing: 0, approved: 0 };
  for (const n of list) {
    counts.all++;
    if (n.state === 'waiting' || n.state === 'signing' || n.state === 'approved') counts[n.state]++;
  }
  return counts;
}

/**
 * Search by the nominee's name or address, or by who nominated or supports
 * them. `nameOf` adds names looked up since the list loaded.
 */
export function matchesSearch(
  n: Nomination,
  text: string,
  nameOf: (address: string) => string | null | undefined = () => null
): boolean {
  const q = text.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    n.nominee,
    n.nomineeName,
    nameOf(n.nominee),
    n.nomination?.record.nomineeName,
    n.nomination?.publisher.name,
    ...n.supporters.map((s) => s.publisher.name),
  ];
  return haystack.some((value) => typeof value === 'string' && value.toLowerCase().includes(q));
}

/** When a decided nomination ended (ms): its invite's decision block, or the end of its wait. */
export function endedAt(
  n: Nomination,
  now: Pick<ChainNow, 'msPerBlock'>,
  group: GroupDelays
): number {
  if (n.latestInvite) return decidedAt(n.latestInvite, now.msPerBlock, group.maximumBlockDelay);
  if (n.state === 'lapsed')
    return waitingEndsAt(n.publishedAt, now.msPerBlock, waitingWindowBlocks(group));
  return n.publishedAt;
}

/** "Propose nomination again" makes sense once a round ran out without a decision. */
export function canNominateAgain(n: Nomination): boolean {
  return n.state === 'expired' || n.state === 'lapsed';
}

/**
 * What the signed-in member already did for a nomination, in their words
 * ("You nominated them", "Support sent ✓ (confirming…)"), or null. `pending`
 * is their support write in flight, if any.
 */
export function myPart(
  n: Nomination,
  me: string,
  pending: Pick<PendingWrite, 'status'> | null
): { label: string; inFlight: boolean } | null {
  if (me && n.nomination?.publisher.address === me)
    return { label: 'You nominated them', inFlight: false };
  if (me && n.supporters.some((s) => s.publisher.address === me))
    return { label: 'You support this', inFlight: false };
  if (pending && pending.status !== 'failed') {
    return {
      label: pending.status === 'sending' ? 'Sending…' : 'Support sent ✓ (confirming…)',
      inFlight: true,
    };
  }
  return null;
}

/**
 * Support still means something: the nomination waits for its first admin,
 * or collects signatures that can still count (not once enough have signed,
 * and not after the last useful block).
 */
export function isStillOpenForSupport(n: Nomination): boolean {
  if (n.state === 'waiting') return true;
  if (n.state !== 'signing') return false;
  const phase = n.decision?.phase;
  return !phase || phase === 'unconfirmed' || phase === 'early' || phase === 'open';
}
