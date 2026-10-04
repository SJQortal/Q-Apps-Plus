/**
 * Alias scan (N9): finds aliases other people addressed mail to, by reading
 * the network's `qortal_qmail_` MAIL_PRIVATE index newest first and trying to
 * decrypt alias-mail candidates (identifiers with no address suffix, not to
 * an owned name).
 *
 * The original walked the whole index on every run (200 per page, to the
 * end) and fetched + decrypted every candidate after its checkpoint. This one
 * is paged and capped:
 *
 * - 50 resources per page, at most `maxPages` pages per run (10 = 500);
 *   "Scan more" runs again and continues where the last run stopped;
 * - pages go through `searchResources` with a session TTL, so re-running in
 *   the same session does not refetch a page;
 * - the checkpoint (localStorage, per address) keeps the stretches of the
 *   index already walked as created-time intervals with their resource
 *   counts. A run walks the gap above the newest interval (new mail), jumps
 *   over each interval by its count, then walks the next gap, and so on down
 *   to the end of the index. A finished scan is one interval and a later run
 *   costs one page;
 * - every candidate fetched + decrypted is remembered per address (capped),
 *   so nothing is fetched twice even when intervals are dropped or shift.
 *
 * Only localStorage changes; nothing is published (data contract §16).
 */
import { MAIL_SERVICE_TYPE } from "../../constants/mail";
import { parseSentRecipientFromIdentifier } from "./mailIdentifier";

export const ALIAS_SCAN_PAGE_SIZE = 50;
export const ALIAS_SCAN_MAX_PAGES = 10;
/** Session cache for scan pages: long enough that "Scan more" and re-runs reuse them. */
export const ALIAS_SCAN_SEARCH_TTL_MS = 15 * 60_000;
export const ALIAS_SCAN_SEEN_LIMIT = 3000;
export const ALIAS_SCAN_MAX_INTERVALS = 8;

/** A stretch of the newest-first index already walked: created times `hi` ≥ `lo`, `count` resources (−1 = unknown). */
export interface AliasScanInterval {
  hi: number;
  lo: number;
  count: number;
}

export interface AliasScanCheckpoint {
  /** Newest created time walked (kept for the "Last checkpoint" line and older builds). */
  lastProcessedTimestamp: number;
  lastProcessedIdentifier: string;
  updatedAt: number;
  /** Walked stretches, newest first, disjoint. */
  intervals: AliasScanInterval[];
  /** True when the last interval reaches the end of the index. */
  complete: boolean;
}

export const EMPTY_ALIAS_SCAN_CHECKPOINT: AliasScanCheckpoint = {
  lastProcessedTimestamp: 0,
  lastProcessedIdentifier: "",
  updatedAt: 0,
  intervals: [],
  complete: false,
};

export const getAliasScanCheckpointStorageKey = (address: string): string =>
  `qmail_alias_scan_checkpoint_${address}`;

export const getAliasScanSeenStorageKey = (address: string): string =>
  `qmail_alias_scan_seen_${address}`;

const finiteNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const sanitizeIntervals = (value: unknown): AliasScanInterval[] => {
  if (!Array.isArray(value)) return [];
  const intervals: AliasScanInterval[] = [];
  for (const item of value) {
    const hi = finiteNumber(item?.hi);
    const lo = finiteNumber(item?.lo);
    const count = finiteNumber(item?.count);
    if (!(hi >= 0) || !(lo >= 0) || lo > hi || !(count >= -1)) continue;
    const previous = intervals[intervals.length - 1];
    if (previous && hi >= previous.lo) continue;
    intervals.push({ hi, lo, count: Math.floor(count) });
  }
  return intervals;
};

/**
 * The stored checkpoint. A checkpoint written by the old full-walk scan (no
 * `intervals`) meant everything up to `lastProcessedTimestamp` was scanned,
 * so it reads as one finished interval from that time to the end.
 */
export const readAliasScanCheckpointFromStorage = (address: string): AliasScanCheckpoint | null => {
  try {
    const raw = localStorage.getItem(getAliasScanCheckpointStorageKey(address));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const lastProcessedTimestamp = finiteNumber(parsed?.lastProcessedTimestamp || 0);
    if (!(lastProcessedTimestamp >= 0)) return null;
    const lastProcessedIdentifier =
      typeof parsed?.lastProcessedIdentifier === "string" ? parsed.lastProcessedIdentifier : "";
    const updatedAt = finiteNumber(parsed?.updatedAt || 0);
    const base = {
      lastProcessedTimestamp,
      lastProcessedIdentifier,
      updatedAt: updatedAt >= 0 ? updatedAt : 0,
    };
    if (!Array.isArray(parsed?.intervals)) {
      return lastProcessedTimestamp > 0
        ? { ...base, intervals: [{ hi: lastProcessedTimestamp, lo: 0, count: -1 }], complete: true }
        : { ...base, intervals: [], complete: false };
    }
    const intervals = sanitizeIntervals(parsed.intervals);
    return { ...base, intervals, complete: Boolean(parsed.complete) && intervals.length > 0 };
  } catch {
    return null;
  }
};

export const writeAliasScanCheckpointToStorage = (
  address: string,
  checkpoint: AliasScanCheckpoint
): void => {
  try {
    localStorage.setItem(getAliasScanCheckpointStorageKey(address), JSON.stringify(checkpoint));
  } catch {
    // Ignore storage failures.
  }
};

export const readAliasScanSeenFromStorage = (address: string): string[] => {
  try {
    const raw = localStorage.getItem(getAliasScanSeenStorageKey(address));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
};

/** Keeps the newest `limit` keys (insertion order, oldest first). */
export const writeAliasScanSeenToStorage = (
  address: string,
  seen: Iterable<string>,
  limit = ALIAS_SCAN_SEEN_LIMIT
): void => {
  try {
    const list = Array.from(seen);
    localStorage.setItem(
      getAliasScanSeenStorageKey(address),
      JSON.stringify(list.slice(Math.max(0, list.length - limit)))
    );
  } catch {
    // Ignore storage failures.
  }
};

/** The search params of one scan page: the original's query, 50 at a time. */
export const aliasScanSearchParams = (offset: number, limit = ALIAS_SCAN_PAGE_SIZE): URLSearchParams =>
  new URLSearchParams({
    mode: "ALL",
    service: MAIL_SERVICE_TYPE,
    query: "qortal_qmail_",
    limit: String(limit),
    includemetadata: "false",
    offset: String(offset),
    reverse: "true",
    excludeblocked: "true",
  });

/** Created time of a search row (the index is ordered by it), falling back to `updated`. */
export const aliasScanResourceTime = (resource: any): number => {
  const created = Number(resource?.created || 0);
  if (Number.isFinite(created) && created > 0) return created;
  const updated = Number(resource?.updated || 0);
  return Number.isFinite(updated) && updated > 0 ? updated : 0;
};

export interface AliasScanCandidate {
  name: string;
  identifier: string;
  /** The alias from the identifier. */
  recipientHint: string;
  key: string;
}

/** An alias-mail candidate, or null for direct mail, mail to an owned name, threads and junk. */
export const toAliasScanCandidate = (
  resource: any,
  ownedNames: Set<string>
): AliasScanCandidate | null => {
  const identifier = typeof resource?.identifier === "string" ? resource.identifier.trim() : "";
  const name = typeof resource?.name === "string" ? resource.name.trim() : "";
  if (!identifier || !name) return null;
  const { recipientName, recipientAddress } = parseSentRecipientFromIdentifier(identifier);
  // Mail with an address segment went to a registered name, not an alias.
  if (recipientAddress) return null;
  const alias = typeof recipientName === "string" ? recipientName.trim() : "";
  if (!alias || ownedNames.has(alias.toLowerCase())) return null;
  return { name, identifier, recipientHint: alias, key: `${name}|${identifier}` };
};

/**
 * Names a decrypted alias mail reveals: its `recipient` and `to`, else the
 * alias from the identifier; owned names never count. `body` null = the
 * fetch or decrypt failed, which reveals nothing.
 */
export const aliasNamesFromBody = (
  body: any,
  recipientHint: string,
  ownedNames: Set<string>
): Map<string, string> => {
  const names = new Map<string, string>();
  if (body === null || body === undefined) return names;
  const add = (value: unknown) => {
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    const normalized = trimmed.toLowerCase();
    if (trimmed && !ownedNames.has(normalized)) names.set(normalized, trimmed);
  };
  add(body?.recipient);
  add(body?.to);
  if (names.size === 0) add(recipientHint);
  return names;
};

/** The Aliases page's scan button label. */
export const aliasScanButtonLabel = (
  state: { isRunning: boolean; isCancelRequested?: boolean; complete?: boolean },
  hasCheckpoint: boolean
): string => {
  if (state.isRunning) return state.isCancelRequested ? "Cancel requested" : "Cancel scan";
  if (!hasCheckpoint) return "Start alias scan";
  return state.complete ? "Check new mail" : "Scan more";
};

export interface AliasScanProgress {
  pagesFetched: number;
  maxPages: number;
  resourcesWalked: number;
  candidatesChecked: number;
  discovered: number;
}

export interface AliasScanPassOptions {
  checkpoint: AliasScanCheckpoint | null;
  seen: Iterable<string>;
  ownedNames: Set<string>;
  /** Normalised aliases already saved; not reported again. */
  knownAliases?: Set<string>;
  search: (offset: number, limit: number) => Promise<any[]>;
  /** FETCH_QDN_RESOURCE + DECRYPT_DATA; resolves to the decoded body, or null when either fails. */
  inspect: (candidate: AliasScanCandidate) => Promise<any | null>;
  isCancelled?: () => boolean;
  onProgress?: (progress: AliasScanProgress) => void;
  /** Called after each page and at the end with what is safe to store. */
  onCheckpoint?: (checkpoint: AliasScanCheckpoint, seen: string[]) => void;
  pageSize?: number;
  maxPages?: number;
  now?: () => number;
}

export interface AliasScanPassResult extends AliasScanProgress {
  checkpoint: AliasScanCheckpoint;
  seen: string[];
  /** Newly found aliases, normalised → display. */
  discoveredAliases: Map<string, string>;
  stoppedBy: "complete" | "cap" | "cancel";
}

/** One capped run of the alias scan. Never throws for a failed candidate; a failed search rejects. */
export async function runAliasScanPass(options: AliasScanPassOptions): Promise<AliasScanPassResult> {
  const pageSize = options.pageSize ?? ALIAS_SCAN_PAGE_SIZE;
  const maxPages = options.maxPages ?? ALIAS_SCAN_MAX_PAGES;
  const now = options.now ?? Date.now;
  const start = options.checkpoint ?? EMPTY_ALIAS_SCAN_CHECKPOINT;
  const oldIntervals = start.intervals.map(interval => ({ ...interval }));
  const seenSet = new Set<string>(options.seen);
  const knownAliases = options.knownAliases ?? new Set<string>();
  const discoveredAliases = new Map<string, string>();

  let pagesFetched = 0;
  let resourcesWalked = 0;
  let candidatesChecked = 0;
  let nextIndex = 0; // next old interval below the walk
  let current: AliasScanInterval | null = null; // contiguous stretch walked from the top
  let newestIdentifier = start.lastProcessedIdentifier;
  let complete = start.complete;
  let position = 0;
  let buffer: any[] = [];
  let bufferStart = 0;
  let reachedEnd = false;

  const progress = (): AliasScanProgress => ({
    pagesFetched,
    maxPages,
    resourcesWalked,
    candidatesChecked,
    discovered: discoveredAliases.size,
  });

  const snapshot = (finished: boolean): AliasScanCheckpoint => {
    const intervals = [...(current ? [current] : []), ...oldIntervals.slice(nextIndex)];
    const kept = intervals.slice(0, ALIAS_SCAN_MAX_INTERVALS);
    const isComplete = finished || (complete && kept.length === intervals.length && nextIndex < oldIntervals.length);
    return {
      lastProcessedTimestamp: kept[0]?.hi ?? 0,
      lastProcessedIdentifier: newestIdentifier,
      updatedAt: now(),
      intervals: kept,
      complete: isComplete && kept.length > 0,
    };
  };

  const report = () => options.onProgress?.(progress());
  const save = (finished = false) => options.onCheckpoint?.(snapshot(finished), Array.from(seenSet));

  type Next = { kind: "item"; item: any } | { kind: "end" } | { kind: "cap" } | { kind: "cancel" };
  const next = async (): Promise<Next> => {
    const index = position - bufferStart;
    if (index >= 0 && index < buffer.length) return { kind: "item", item: buffer[index] };
    if (reachedEnd && position >= bufferStart + buffer.length) return { kind: "end" };
    if (options.isCancelled?.()) return { kind: "cancel" };
    if (pagesFetched >= maxPages) return { kind: "cap" };
    if (pagesFetched > 0) save();
    const page = await options.search(position, pageSize);
    pagesFetched += 1;
    buffer = Array.isArray(page) ? page : [];
    bufferStart = position;
    if (buffer.length < pageSize) reachedEnd = true;
    report();
    return buffer.length > 0 ? { kind: "item", item: buffer[0] } : { kind: "end" };
  };

  let stoppedBy: AliasScanPassResult["stoppedBy"] = "cap";
  report();

  for (;;) {
    const target = oldIntervals[nextIndex];
    const step = await next();
    if (step.kind === "cap" || step.kind === "cancel") {
      stoppedBy = step.kind;
      break;
    }
    if (step.kind === "end") {
      // The bottom of the index: everything walked is one finished stretch.
      // Older intervals still listed (deleted resources) are dropped.
      nextIndex = oldIntervals.length;
      complete = true;
      stoppedBy = "complete";
      break;
    }

    const resource = step.item;
    const time = aliasScanResourceTime(resource);

    if (target && time <= target.hi) {
      // Reached a stretch walked before: merge and jump over it.
      const above = current as AliasScanInterval | null;
      current = {
        hi: above ? above.hi : target.hi,
        lo: target.lo,
        count: target.count < 0 ? -1 : (above ? above.count : 0) + target.count,
      };
      nextIndex += 1;
      const isLast = nextIndex >= oldIntervals.length;
      if ((isLast && complete) || target.count < 0) {
        nextIndex = oldIntervals.length;
        complete = true;
        stoppedBy = "complete";
        break;
      }
      position += target.count;
      continue;
    }

    // A resource in a gap: walk it.
    if (!current) newestIdentifier = typeof resource?.identifier === "string" ? resource.identifier : "";
    const candidate = toAliasScanCandidate(resource, options.ownedNames);
    if (candidate && !seenSet.has(candidate.key)) {
      if (options.isCancelled?.()) {
        stoppedBy = "cancel";
        break;
      }
      let body: any = null;
      try {
        body = await options.inspect(candidate);
      } catch {
        body = null;
      }
      candidatesChecked += 1;
      seenSet.add(candidate.key);
      aliasNamesFromBody(body, candidate.recipientHint, options.ownedNames).forEach((display, normalized) => {
        if (knownAliases.has(normalized) || discoveredAliases.has(normalized)) return;
        discoveredAliases.set(normalized, display);
      });
    }
    current = current
      ? { hi: current.hi, lo: Math.min(current.lo, time), count: current.count + 1 }
      : { hi: time, lo: time, count: 1 };
    resourcesWalked += 1;
    position += 1;
    report();
  }

  const checkpoint = snapshot(stoppedBy === "complete");
  const seen = Array.from(seenSet);
  options.onCheckpoint?.(checkpoint, seen);
  report();
  return { ...progress(), checkpoint, seen, discoveredAliases, stoppedBy };
}
