/**
 * The last visit, per signed-in account and group, kept on this device
 * (localStorage, `<prefix>last-visit-<address>-<groupId>`): what the app
 * showed then (rules/sinceLastVisit.ts → VisitSnapshot).
 *
 * The app saves a fresh snapshot whenever it has new data (the shell does,
 * on every screen), so "your last visit" is the last time the app was open.
 * The snapshot from before this session is read once and kept as the
 * session's baseline, so Home can compare against it however often it saves.
 * "Mark as seen" moves the baseline to now.
 *
 * Decisions decided since then are read once each
 * (`/transactions/signature/{sig}`, at most MAX_OUTCOME_LOOKUPS), and kept
 * for the session.
 */
import { STORAGE_PREFIX } from '../constants/plus';
import { MINTER_GROUP_ID } from './constants';
import { parseSnapshot, MAX_OUTCOME_LOOKUPS, type VisitSnapshot } from '../rules/sinceLastVisit';
import { mapLimit } from './qdn';
import { fetchQuery } from './query';
import { getTransaction } from './txs';
import type { TxRow } from './types';

export function lastVisitKey(address: string, groupId: number = MINTER_GROUP_ID): string {
  return `${STORAGE_PREFIX}last-visit-${address}-${groupId}`;
}

/** Each account's baseline for this session (null: no earlier visit on this device). */
const baselines = new Map<string, VisitSnapshot | null>();
/** Accounts whose "You're in" was marked as seen this session. */
const joinedSeen = new Set<string>();
/** Accounts whose summary was already read out this session. */
const announced = new Set<string>();

function readStored(key: string): VisitSnapshot | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? parseSnapshot(JSON.parse(raw)) : null;
  } catch {
    // Blocked storage or a damaged value: as if there were no earlier visit.
    return null;
  }
}

/** The snapshot from before this session, read once. */
export function visitBaseline(address: string): VisitSnapshot | null {
  const key = lastVisitKey(address);
  if (!baselines.has(key)) baselines.set(key, readStored(key));
  return baselines.get(key) ?? null;
}

/** Save what the app shows now (the baseline from before is kept for this session). */
export function recordVisit(address: string, snapshot: VisitSnapshot): void {
  visitBaseline(address);
  try {
    window.localStorage.setItem(lastVisitKey(address), JSON.stringify(snapshot));
  } catch {
    // Private windows: the panel is a convenience only.
  }
}

/** "Mark as seen": compare with `snapshot` (now) from here on, and save it. */
export function markSeen(address: string, snapshot: VisitSnapshot): void {
  baselines.set(lastVisitKey(address), snapshot);
  joinedSeen.add(address);
  recordVisit(address, snapshot);
}

export function isJoinedSeen(address: string): boolean {
  return joinedSeen.has(address);
}

/** True the first time for an account this session (its summary is read out once). */
export function claimAnnouncement(address: string): boolean {
  if (announced.has(address)) return false;
  announced.add(address);
  return true;
}

/** Tests start each render as a fresh app load. */
export function resetLastVisitSession(): void {
  baselines.clear();
  joinedSeen.clear();
  announced.clear();
}

/** The cache key loadOutcomes uses for these signatures. */
export function outcomesKey(signatures: readonly string[]): string {
  return `lastvisit:outcomes:${[...new Set(signatures)].sort().join(',')}`;
}

/**
 * The decided transactions behind `signatures` (null when Core doesn't know
 * one), at most MAX_OUTCOME_LOOKUPS reads, 4 at a time, kept for the session.
 */
export function loadOutcomes(signatures: readonly string[]): Promise<Map<string, TxRow | null>> {
  const list = [...new Set(signatures)].sort().slice(0, MAX_OUTCOME_LOOKUPS);
  return fetchQuery(
    outcomesKey(signatures),
    async () => {
      const rows = await mapLimit(list, 4, (signature) => getTransaction(signature));
      return new Map(list.map((signature, i) => [signature, rows[i]]));
    },
    { ttlMs: Number.POSITIVE_INFINITY }
  );
}
