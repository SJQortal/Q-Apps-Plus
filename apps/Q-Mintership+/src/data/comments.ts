/**
 * Reading comments (docs/apps/Q-Mintership+.md → Data contract):
 *
 * - **Counts:** one shared search lists every comment of the last 45 days
 *   (`identifier=qmp-comment-&prefix=true&after=…`, 100 a page, at most 3
 *   pages), split by key, so a page full of cards costs one GET. A card whose
 *   comments can be older, or any card when that list is full, searches its
 *   own keys instead (only once it is on screen; components/comments).
 * - **A thread, once opened:** its keys' searches, the bodies of the newest
 *   20 comments (20 more per "Show more"), the comments their replies answer,
 *   and the Minter Admins' hide records for those keys. A body that isn't on
 *   the node yet shows as "fetching" and fills in when it arrives.
 *
 * Searches are cached for 3 minutes and shared; bodies for the session, per
 * version (data/qdn.ts). Nothing here writes.
 */
import { getNameOwner } from './accounts';
import {
  COMMENT_PREFIX,
  COMMENT_SERVICE,
  commentSearchPrefix,
  hideSearchPrefix,
  parseComment,
  parseHide,
} from './commentRecords';
import {
  commentRowsFor,
  missingParents,
  resolveHides,
  targetId,
  targetSince,
  type CommentBody,
  type CommentRow,
  type CommentTarget,
  type HideRow,
} from './commentThread';
import { getAdmins } from './group';
import { QdnDeletedError, fetchQdnJson, mapLimit, rowTime, searchQdn } from './qdn';
import { fetchQuery, getQueryState, setQueryData } from './query';
import type { QdnRow } from './types';

/** The shared count list covers comments published in this many days. */
export const INDEX_LOOKBACK_MS = 45 * 86_400_000;
const INDEX_PAGES = 3;
/** Per key: up to 500 comments, 200 hide records. */
const KEY_PAGES = 5;
const HIDE_PAGES = 2;
/** A thread shows this many comments, and this many more per "Show more". */
export const COMMENTS_PAGE = 20;
/** A body slower than this shows as "fetching" and fills in when it arrives. */
let bodyWaitMs = 3_000;
const HOUR = 3_600_000;

/** Tests shorten the wait. */
export function setCommentBodyWait(ms: number): void {
  bodyWaitMs = ms;
}

export interface CommentIndex {
  /** Comments published after this time (ms) are all listed, unless `truncated`. */
  after: number;
  rows: QdnRow[];
  truncated: boolean;
}

/** Every comment of the last 45 days, for counts. Key `comments:index`. */
export function loadCommentIndex(options: { force?: boolean } = {}): Promise<CommentIndex> {
  return fetchQuery(
    'comments:index',
    async () => {
      // Rounded to the hour, so the search's own cache key holds for an hour.
      const after = Math.floor((Date.now() - INDEX_LOOKBACK_MS) / HOUR) * HOUR;
      const result = await searchQdn(
        { service: COMMENT_SERVICE, identifier: COMMENT_PREFIX, after, maxPages: INDEX_PAGES },
        { force: options.force }
      );
      return { after, rows: result.rows, truncated: result.truncated };
    },
    { ttlMs: 3 * 60_000, force: options.force }
  );
}

/** Whether the shared list has every comment `target` can have. */
export function indexCovers(index: CommentIndex, target: CommentTarget): boolean {
  const since = targetSince(target);
  return !index.truncated && since !== null && since > index.after;
}

export interface CommentRows {
  rows: CommentRow[];
  truncated: boolean;
}

/** A target's comment rows from its own keys' searches. Key `comments:rows:<target>`. */
export function loadCommentRows(
  target: CommentTarget,
  options: { force?: boolean } = {}
): Promise<CommentRows> {
  return fetchQuery(
    `comments:rows:${targetId(target)}`,
    async () => {
      const results = await Promise.all(
        target.keys.map((span) =>
          searchQdn(
            {
              service: COMMENT_SERVICE,
              identifier: commentSearchPrefix(span.key),
              maxPages: KEY_PAGES,
            },
            { force: options.force }
          )
        )
      );
      return {
        rows: commentRowsFor(
          target,
          results.flatMap((r) => r.rows)
        ),
        truncated: results.some((r) => r.truncated),
      };
    },
    { ttlMs: 3 * 60_000, force: options.force }
  );
}

type Quick<T> = { value: T; late: null } | { value: null; late: Promise<T> };

/** `work`, or after `bodyWaitMs` the promise still running. */
async function quick<T>(work: Promise<T>): Promise<Quick<T>> {
  // Nobody may be waiting for it any more when it fails late.
  work.catch(() => undefined);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const slow = new Promise<'slow'>((resolve) => {
    timer = setTimeout(() => resolve('slow'), bodyWaitMs);
  });
  const first = await Promise.race([work, slow]);
  clearTimeout(timer);
  return first === 'slow' ? { value: null, late: work } : { value: first as T, late: null };
}

function readBody(row: CommentRow): Promise<CommentBody> {
  return fetchQdnJson(COMMENT_SERVICE, row.name, row.identifier, row.version).then(
    (body): CommentBody => {
      const record = parseComment(body, row.identifier);
      return record ? { status: 'ok', record } : { status: 'invalid' };
    },
    (error): CommentBody =>
      error instanceof QdnDeletedError ? { status: 'invalid' } : { status: 'unavailable' }
  );
}

/** Read hide records for the target's keys, keep the ones a Minter Admin published. */
async function loadHides(
  target: CommentTarget,
  force: boolean | undefined
): Promise<Map<string, boolean>> {
  const results = await Promise.all(
    target.keys.map((span) =>
      searchQdn(
        { service: COMMENT_SERVICE, identifier: hideSearchPrefix(span.key), maxPages: HIDE_PAGES },
        { force }
      )
    )
  );
  const rows = results.flatMap((r) => r.rows);
  if (!rows.length) return new Map();
  const keys = new Set(target.keys.map((span) => span.key));
  const parsed = await mapLimit(rows, 6, async (row): Promise<HideRow | null> => {
    const read = await quick(
      fetchQdnJson(COMMENT_SERVICE, row.name, row.identifier, row.latestSignature ?? rowTime(row))
    ).catch(() => null);
    // A slow one counts on the next read (it is cached by then).
    if (!read || read.value === null) return null;
    const record = parseHide(read.value, row.identifier);
    return record && keys.has(record.key)
      ? { name: row.name, updatedAt: rowTime(row), record }
      : null;
  });
  const valid = parsed.filter((h): h is HideRow => h !== null);
  if (!valid.length) return new Map();
  const admins = await getAdmins();
  const adminSet = new Set(admins.signers.map((a) => a.member));
  const adminNames = new Set<string>();
  await mapLimit([...new Set(valid.map((h) => h.name))], 6, async (name) => {
    const owner = await getNameOwner(name).catch(() => null);
    if (owner && adminSet.has(owner)) adminNames.add(name);
  });
  return resolveHides(valid, (name) => adminNames.has(name));
}

export interface CommentThreadData {
  /** Every comment row of the target, newest first (the count). */
  rows: CommentRow[];
  /** Bodies read so far: the newest `limit` rows and the comments their replies answer. */
  bodies: Map<string, CommentBody>;
  /** Comments a Minter Admin hid (true) or showed again (false). */
  hides: Map<string, boolean>;
  limit: number;
  truncated: boolean;
}

export function commentThreadKey(target: CommentTarget, limit: number): string {
  return `comments:thread:${targetId(target)}:${limit}`;
}

/**
 * A thread's newest `limit` comments, with what they answer and the hides.
 * Key `comments:thread:<target>:<limit>`.
 */
export function loadCommentThread(
  target: CommentTarget,
  limit: number,
  options: { force?: boolean } = {}
): Promise<CommentThreadData> {
  const key = commentThreadKey(target, limit);
  return fetchQuery(
    key,
    async () => {
      const force = options.force;
      const [{ rows, truncated }, hides] = await Promise.all([
        loadCommentRows(target, { force }),
        loadHides(target, force).catch(() => new Map<string, boolean>()),
      ]);
      const bodies = new Map<string, CommentBody>();
      let shown = false;
      // A body that arrives after the thread is shown fills in where it
      // belongs, if the thread on screen still lists that version.
      const fillLate = (row: CommentRow, late: Promise<CommentBody>) => {
        void late.then((body) => {
          if (!shown) {
            bodies.set(row.ref, body);
            return;
          }
          const current = getQueryState<CommentThreadData>(key).data;
          const listed = current?.rows.find((r) => r.ref === row.ref);
          if (!current || listed?.version !== row.version) return;
          const next = new Map(current.bodies);
          next.set(row.ref, body);
          setQueryData<CommentThreadData>(key, { ...current, bodies: next });
        });
      };
      const read = (list: CommentRow[]) =>
        mapLimit(list, 6, async (row) => {
          const result = await quick(readBody(row));
          if (result.late) {
            bodies.set(row.ref, { status: 'unavailable', fetching: true });
            fillLate(row, result.late);
          } else {
            bodies.set(row.ref, result.value);
          }
        });
      await read(rows.slice(0, limit));
      // The comments that replies answer, and theirs (threads are one level deep).
      for (let round = 0; round < 3; round++) {
        const parents = missingParents(rows, bodies);
        if (!parents.length) break;
        await read(parents);
      }
      shown = true;
      return { rows, bodies, hides, limit, truncated };
    },
    { ttlMs: 60_000, force: options.force }
  );
}
