/**
 * The admin changes that moved MINTER's target between two blocks, for
 * "the target changed since your last visit, because …". One bounded,
 * cached search, made only when the target did change.
 *
 * A change approved after block `since` was confirmed at most one approval
 * window (maximumBlockDelay) before its approval, so the search starts one
 * window before `since`. It never reaches back more than five windows
 * (about six weeks) from the tip; a longer gap says only how the count
 * moved.
 */
import { approvedAdminChanges, type ApprovedAdminChange } from '../rules/targetShift';
import { fetchQuery } from './query';
import { getDecisionsInRange } from './txs';

const ADMIN_CHANGE_TYPES = ['ADD_GROUP_ADMIN', 'REMOVE_GROUP_ADMIN'] as const;
/** How far back the search may start, in approval windows. */
export const ADMIN_CHANGES_MAX_WINDOWS = 5;

export interface AdminChangesBetween {
  /** Approved admin changes with since < approval block ≤ until, oldest first. */
  changes: ApprovedAdminChange[];
  /** False when the gap was too long to read in full, or a read stopped at its ceiling. */
  complete: boolean;
}

export function adminChangesKey(since: number, until: number): string {
  return `targetchanges:${since}:${until}`;
}

/** Key `targetchanges:<since>:<until>`, cached 5 minutes. */
export function loadAdminChangesBetween(
  since: number,
  until: number,
  maximumBlockDelay: number,
  options: { force?: boolean } = {}
): Promise<AdminChangesBetween> {
  return fetchQuery(
    adminChangesKey(since, until),
    () => readAdminChanges(since, until, maximumBlockDelay, options.force),
    { ttlMs: 5 * 60_000, force: options.force }
  );
}

async function readAdminChanges(
  since: number,
  until: number,
  maximumBlockDelay: number,
  force?: boolean
): Promise<AdminChangesBetween> {
  const floor = Math.max(1, until - ADMIN_CHANGES_MAX_WINDOWS * maximumBlockDelay);
  const wanted = Math.max(1, since - maximumBlockDelay);
  const start = Math.max(floor, wanted);
  if (until < start) return { changes: [], complete: true };
  const result = await getDecisionsInRange(ADMIN_CHANGE_TYPES, start, until, {
    force,
    ttlMs: 5 * 60_000,
  });
  const changes = approvedAdminChanges(result.rows)
    .filter((c) => c.height > since && c.height <= until)
    .sort((a, b) => a.height - b.height);
  return { changes, complete: wanted >= floor && !result.truncated };
}
