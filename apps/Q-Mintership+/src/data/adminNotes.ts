/**
 * Reading what is for the Minter Admins only (docs/apps/Q-Mintership+.md →
 * Reads): the notes proposers add to their decisions and nominations, and
 * the Minter Admins' comments. Only for a viewer who is a current Minter
 * Admin (nobody else can decrypt them, so the screens never call these for
 * anyone else), and only where a decision or a nomination is on screen.
 *
 * - **Lists:** one shared search per kind lists those of the last 45 days
 *   (`searchsimple?service=DOCUMENT_PRIVATE&identifier=qmp-adminnote-` or
 *   `qmp-macomment-` `&prefix=true&reverse=true&after=…`, 100 a page, at most
 *   3 pages), so a page full of cards costs one GET each. A card whose
 *   decision can be older, or any card when that list is full, searches its
 *   own keys instead, once it is on screen.
 * - **Who counts:** a note only from a name owned by the account that
 *   proposed the decision (the nominator, for a nomination); a comment only
 *   from a name owned by a current Minter Admin who can sign. Each name is
 *   looked up once (an admin's primary name needs no lookup).
 * - **Bodies:** `/arbitrary/DOCUMENT_PRIVATE/{name}/{identifier}?encoding=base64`,
 *   then Hub's `DECRYPT_DATA` (no dialog), once per version for the session
 *   (the poll bodies' reader, data/adminPolls.ts → readPollBody). One that
 *   wasn't encrypted to the viewer (a Minter Admin added since) says so.
 *
 * Searches are cached for 3 minutes and shared; nothing here writes.
 */
import type { Decision } from '../rules/decision';
import type { BodyRead, PollRow } from '../rules/adminPolls';
import { getNameOwner } from './accounts';
import {
  ADMIN_COMMENT_PREFIX,
  ADMIN_NOTE_PREFIX,
  ADMIN_NOTE_SERVICE,
  adminCommentSearchPrefix,
  adminNoteIdentifier,
  parseAdminComment,
  parseAdminNote,
  parseAdminNoteIdentifier,
} from './adminNoteRecords';
import { readPollBody } from './adminPolls';
import { decisionCommentKey } from './commentRecords';
import { readCommentBody } from './comments';
import {
  commentRowsFor,
  decisionCommentTarget,
  nominationCommentTarget,
  targetId,
  targetSince,
  type CommentBody,
  type CommentRow,
  type CommentTarget,
  type NominationForComments,
} from './commentThread';
import { getAdmins, type AdminList } from './group';
import { mapLimit, quick, rowTime, searchQdn } from './qdn';
import { fetchQuery } from './query';
import type { QdnRow } from './types';

/** The shared lists cover what was published in this many days (as public comments' counts). */
export const ADMIN_INDEX_LOOKBACK_MS = 45 * 86_400_000;
const INDEX_PAGES = 3;
/** Per key: up to 500 comments; a note is one identifier per name. */
const KEY_PAGES = 5;
const NOTE_PAGES = 1;
const HOUR = 3_600_000;

export const ADMIN_NOTES_INDEX_KEY = 'adminnotes:index';
export const ADMIN_COMMENTS_INDEX_KEY = 'macomments:index';

export interface AdminIndex {
  /** Records published after this time (ms) are all listed, unless `truncated`. */
  after: number;
  /** The rows from names that may count (see each list), newest first. */
  rows: QdnRow[];
  truncated: boolean;
}

/**
 * Who owns each name: a current admin's primary name is known from the
 * admin list; any other is looked up once (cached 30 minutes).
 */
async function ownersOf(
  names: Iterable<string>,
  admins: AdminList
): Promise<Map<string, string | null>> {
  const owners = new Map<string, string | null>();
  for (const a of admins.signers) if (a.primaryName) owners.set(a.primaryName, a.member);
  await mapLimit(
    [...new Set(names)].filter((n) => n && !owners.has(n)),
    6,
    async (name) => owners.set(name, await getNameOwner(name).catch(() => null))
  );
  return owners;
}

/** Only the rows whose name a current Minter Admin who can sign owns. */
async function fromAdmins(rows: readonly QdnRow[]): Promise<QdnRow[]> {
  if (!rows.length) return [];
  const admins = await getAdmins();
  const signers = new Set(admins.signers.map((a) => a.member));
  const owners = await ownersOf(
    rows.map((r) => r.name),
    admins
  );
  return rows.filter((r) => {
    const owner = owners.get(r.name);
    return owner !== null && owner !== undefined && signers.has(owner);
  });
}

function loadIndex(key: string, prefix: string, force?: boolean): Promise<AdminIndex> {
  return fetchQuery(
    key,
    async () => {
      // Rounded to the hour, so the search's own cache key holds for an hour.
      const after = Math.floor((Date.now() - ADMIN_INDEX_LOOKBACK_MS) / HOUR) * HOUR;
      const result = await searchQdn(
        { service: ADMIN_NOTE_SERVICE, identifier: prefix, after, maxPages: INDEX_PAGES },
        { force }
      );
      // Comments count only from Minter Admins: the others never make a count.
      const rows = prefix === ADMIN_COMMENT_PREFIX ? await fromAdmins(result.rows) : result.rows;
      return { after, rows, truncated: result.truncated };
    },
    { ttlMs: 3 * 60_000, force }
  );
}

/** Every note of the last 45 days. Key `adminnotes:index`. Minter Admins only. */
export function loadAdminNoteIndex(options: { force?: boolean } = {}): Promise<AdminIndex> {
  return loadIndex(ADMIN_NOTES_INDEX_KEY, ADMIN_NOTE_PREFIX, options.force);
}

/** Every Minter Admins' comment of the last 45 days, from current Minter Admins. Key `macomments:index`. */
export function loadAdminCommentIndex(options: { force?: boolean } = {}): Promise<AdminIndex> {
  return loadIndex(ADMIN_COMMENTS_INDEX_KEY, ADMIN_COMMENT_PREFIX, options.force);
}

/** Whether a shared list has everything that can belong to something from `since` on. */
export function adminIndexCovers(index: AdminIndex, since: number | null): boolean {
  return !index.truncated && since !== null && since > index.after;
}

// ---- notes ---------------------------------------------------------------------------

/** One key a note can be under, from when, and the one account whose note counts there. */
export interface NoteSpan {
  key: string;
  /** A note under this key published before this time (ms) belongs to something earlier. */
  since: number | null;
  /** Whose note counts: who proposed it (the nominator, for a nomination's key). */
  author: string;
}

export interface NoteTarget {
  spans: NoteSpan[];
}

/** One stable string per note target (store keys). */
export function noteTargetId(target: NoteTarget): string {
  return target.spans.map((s) => `${s.key}@${s.since ?? ''}@${s.author}`).join('+');
}

/** The earliest time a note of the target can have (null: any time). */
function noteSince(target: NoteTarget): number | null {
  return targetSince({ postKey: '', keys: target.spans });
}

/** The nominator of a nomination that has a record (null: none). */
type WithNominator = NominationForComments & {
  nomination: (NominationForComments['nomination'] & { publisher: { address: string } }) | null;
};

/** A nomination's note: the nominator's, under the nominee's address, from this round. */
function nominatorSpans(target: CommentTarget, n: WithNominator | null | undefined): NoteSpan[] {
  const nominator = n?.nomination?.publisher.address;
  if (!n || !nominator) return [];
  return target.keys
    .filter((span) => span.key === n.nominee)
    .map((span) => ({ key: span.key, since: span.since, author: nominator }));
}

/**
 * Where a decision's note is: its proposer's under the decision's key; for
 * an invite, the nominator's under the nominee's address (the nomination
 * behind it). Null when there is nothing to look for.
 */
export function decisionNoteTarget(
  d: Pick<Decision, 'signature' | 'kind' | 'subject' | 'createdAt' | 'creatorAddress'>,
  nomination?: WithNominator | null
): NoteTarget | null {
  const comments = decisionCommentTarget(d, nomination);
  const spans: NoteSpan[] =
    d.kind === 'invite'
      ? nominatorSpans(comments, nomination)
      : d.creatorAddress
        ? comments.keys
            .filter((span) => span.key === decisionCommentKey(d.signature))
            .map((span) => ({ ...span, author: d.creatorAddress as string }))
        : [];
  return spans.length ? { spans } : null;
}

/** Where a nomination's note is: its nominator's, under the nominee's address. */
export function nominationNoteTarget(n: WithNominator): NoteTarget | null {
  const spans = nominatorSpans(nominationCommentTarget(n), n);
  return spans.length ? { spans } : null;
}

/** The rows that can be the target's note (any name: the owner is checked on reading), newest first. */
export function noteRowsFor(target: NoteTarget, rows: readonly QdnRow[]): QdnRow[] {
  return rows
    .filter((row) => {
      const parsed = parseAdminNoteIdentifier(row.identifier);
      if (!parsed || typeof row.name !== 'string' || !row.name) return false;
      return target.spans.some(
        (span) => span.key === parsed.key && (span.since === null || row.created >= span.since)
      );
    })
    .sort((a, b) => rowTime(b) - rowTime(a));
}

export type AdminNoteRead =
  /** No note from its proposer. */
  | { status: 'none' }
  | {
      status: 'ok';
      text: string;
      /** The name it was published under, and the account that owns it. */
      name: string;
      author: string;
      key: string;
      identifier: string;
      /** When this version was published (ms). */
      at: number;
      edited: boolean;
    }
  /** There is one, but it wasn't encrypted to the viewer (a Minter Admin added since). */
  | { status: 'locked'; name: string; at: number }
  /** There is one that couldn't be read now; `hub` when Hub didn't decrypt it. */
  | { status: 'unavailable'; name: string; at: number; hub: boolean };

export function adminNoteKey(viewer: string, target: NoteTarget): string {
  return `adminnotes:note:${viewer}:${noteTargetId(target)}`;
}

const asPollRow = (row: QdnRow): PollRow => ({
  name: row.name,
  identifier: row.identifier,
  created: row.created,
  updated: row.updated,
  latestSignature: row.latestSignature,
});

/**
 * The target's note as `viewer` reads it: the newest version from a name
 * its author owns, decrypted. From the shared list when it covers the
 * target, else its own keys' searches. Key `adminnotes:note:<viewer>:<target>`.
 */
export function loadAdminNote(
  viewer: string,
  target: NoteTarget,
  options: { force?: boolean } = {}
): Promise<AdminNoteRead> {
  return fetchQuery(
    adminNoteKey(viewer, target),
    async (): Promise<AdminNoteRead> => {
      const force = options.force;
      const index = await loadAdminNoteIndex({ force });
      let rows: QdnRow[];
      if (adminIndexCovers(index, noteSince(target))) rows = index.rows;
      else {
        const found = await Promise.all(
          [...new Set(target.spans.map((s) => s.key))].map((key) =>
            searchQdn(
              {
                service: ADMIN_NOTE_SERVICE,
                identifier: adminNoteIdentifier(key),
                prefix: false,
                maxPages: NOTE_PAGES,
              },
              { force }
            )
          )
        );
        rows = found.flatMap((r) => r.rows);
      }
      const candidates = noteRowsFor(target, rows);
      if (!candidates.length) return { status: 'none' };
      const admins = await getAdmins();
      const owners = await ownersOf(
        candidates.map((r) => r.name),
        admins
      );
      const row = candidates.find((r) => {
        const key = parseAdminNoteIdentifier(r.identifier)?.key;
        const owner = owners.get(r.name);
        return target.spans.some(
          (span) =>
            span.key === key &&
            span.author === owner &&
            (span.since === null || r.created >= span.since)
        );
      });
      if (!row) return { status: 'none' };
      const at = rowTime(row);
      const body: BodyRead = await readPollBody(viewer, asPollRow(row));
      if (body.status === 'locked') return { status: 'locked', name: row.name, at };
      if (body.status === 'unavailable')
        return { status: 'unavailable', name: row.name, at, hub: Boolean(body.hub) };
      const record = body.status === 'ok' ? parseAdminNote(body.value, row.identifier) : null;
      if (!record) return { status: 'none' };
      return {
        status: 'ok',
        text: record.text,
        name: row.name,
        author: owners.get(row.name) as string,
        key: record.key,
        identifier: row.identifier,
        at,
        edited: Boolean(record.edited),
      };
    },
    { ttlMs: 60_000, force: options.force }
  );
}

// ---- comments ------------------------------------------------------------------------

export interface AdminCommentRows {
  /** From current Minter Admins only, newest first (each marked adminOnly). */
  rows: CommentRow[];
  truncated: boolean;
}

/** A target's Minter Admins' comments from its own keys' searches. Key `macomments:rows:<target>`. */
export function loadAdminCommentRows(
  target: CommentTarget,
  options: { force?: boolean } = {}
): Promise<AdminCommentRows> {
  return fetchQuery(
    `macomments:rows:${targetId(target)}`,
    async () => {
      const results = await Promise.all(
        target.keys.map((span) =>
          searchQdn(
            {
              service: ADMIN_NOTE_SERVICE,
              identifier: adminCommentSearchPrefix(span.key),
              maxPages: KEY_PAGES,
            },
            { force: options.force }
          )
        )
      );
      const trusted = await fromAdmins(results.flatMap((r) => r.rows));
      return {
        rows: commentRowsFor(target, trusted, { adminOnly: true }),
        truncated: results.some((r) => r.truncated),
      };
    },
    { ttlMs: 3 * 60_000, force: options.force }
  );
}

export interface AdminThreadData {
  /** The target's Minter Admins' comments (the count). */
  rows: CommentRow[];
  /**
   * Bodies read so far: the newest `limit` of them and the comments their
   * replies answer, which may be public ones (by their own refs).
   */
  bodies: Map<string, CommentBody>;
  /** Comments here that weren't encrypted to the viewer (left out, and said). */
  locked: number;
  truncated: boolean;
}

export function adminThreadKey(viewer: string, target: CommentTarget, limit: number): string {
  return `macomments:thread:${viewer}:${targetId(target)}:${limit}`;
}

/** A decrypted Minter Admins' comment as the thread takes it. */
async function readAdminBody(
  viewer: string,
  row: CommentRow
): Promise<CommentBody | { status: 'locked' }> {
  const body = await readPollBody(viewer, {
    name: row.name,
    identifier: row.identifier,
    created: row.postedAt,
    updated: row.updatedAt,
  });
  if (body.status === 'locked') return { status: 'locked' };
  if (body.status === 'unavailable') return { status: 'unavailable' };
  const record = body.status === 'ok' ? parseAdminComment(body.value, row.identifier) : null;
  return record ? { status: 'ok', record } : { status: 'invalid' };
}

/**
 * A thread's Minter Admins' comments, once opened: the newest `limit`, and
 * the comments their replies answer, read from `publicRows` too (threads are
 * one level deep). A body slower than the wait shows as fetching until the
 * next read (every minute while open).
 */
export function loadAdminThread(
  viewer: string,
  target: CommentTarget,
  publicRows: readonly CommentRow[],
  limit: number,
  options: { force?: boolean } = {}
): Promise<AdminThreadData> {
  return fetchQuery(
    adminThreadKey(viewer, target, limit),
    async () => {
      const { rows, truncated } = await loadAdminCommentRows(target, { force: options.force });
      const bodies = new Map<string, CommentBody>();
      const lockedRefs = new Set<string>();
      const readAdmin = (list: readonly CommentRow[]) =>
        mapLimit([...list], 6, async (row) => {
          const result = await quick(readAdminBody(viewer, row));
          const body = result.value ?? { status: 'unavailable' as const, fetching: true };
          if (body.status === 'locked') lockedRefs.add(row.ref);
          else bodies.set(row.ref, body);
        });
      const readPublic = (list: readonly CommentRow[]) =>
        mapLimit([...list], 6, async (row) => {
          const result = await quick(readCommentBody(row));
          bodies.set(row.ref, result.value ?? { status: 'unavailable', fetching: true });
        });
      await readAdmin(rows.slice(0, limit));
      for (let round = 0; round < 3; round++) {
        const wanted = new Set<string>();
        for (const body of bodies.values())
          if (body.status === 'ok' && body.record.replyTo) wanted.add(body.record.replyTo);
        const missing = (list: readonly CommentRow[]) => {
          const first = new Map<string, CommentRow>();
          for (const row of list) {
            if (!wanted.has(row.identifier) || bodies.has(row.ref) || lockedRefs.has(row.ref))
              continue;
            const current = first.get(row.identifier);
            if (!current || row.postedAt < current.postedAt) first.set(row.identifier, row);
          }
          return [...first.values()];
        };
        const admin = missing(rows);
        const open = missing(publicRows);
        if (!admin.length && !open.length) break;
        await Promise.all([readAdmin(admin), readPublic(open)]);
      }
      return { rows, bodies, locked: lockedRefs.size, truncated };
    },
    { ttlMs: 60_000, force: options.force }
  );
}
