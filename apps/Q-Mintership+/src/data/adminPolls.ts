/**
 * Minter Admin polls as one admin reads them (docs/apps/Q-Mintership+.md →
 * Reads). Only for Minter Admins, only while Decisions, History or a poll's
 * page is open; Home reuses what Decisions read and reads nothing itself.
 *
 * - **Searches:** `searchsimple?service=DOCUMENT_PRIVATE&identifier=<prefix>&prefix=true&reverse=true`,
 *   one per prefix (polls, votes, comments, shares), 100 a page. Decisions
 *   reads at most 3 pages, records created in the last 62 days (a poll lasts
 *   at most 30 days and stays listed 31 days after it ends). History and an
 *   older poll's own page read all time, at most 10 pages (PollScope).
 * - **Bodies** only from names whose owner is a current Minter Admin who can
 *   sign: `/arbitrary/DOCUMENT_PRIVATE/{name}/{identifier}?encoding=base64`,
 *   then Hub's `DECRYPT_DATA { encryptedData }` (no dialog), each once per
 *   (viewer, name, identifier, updated) for the session. One that isn't
 *   encrypted to the viewer (Hub's "unable to decrypt") is remembered as
 *   locked and skipped quietly; one that isn't on the node yet, or that Hub
 *   didn't decrypt for another reason (its wallet locked), is tried again
 *   after 2, 4, 8 and then every 15 minutes, or at once on Retry or Refresh.
 *   A body slower than a few seconds counts on the next read.
 * - **What is read:** every poll; votes only for polls that are listed (or
 *   might be, through a share); shares only where something is missing for
 *   the viewer (rules/adminPolls.ts needsShareRead). Comment bodies wait
 *   until a thread is opened.
 * - **Public keys** of the Minter Admins, for encrypting a write: read once
 *   per session (`/addresses/publickey/{a}`), only when something is written.
 *
 * Refreshed every minute while a view that shows them is open and visible.
 */
import { qortal } from '../qortal/client';
import { base58Decode } from '../qortal/base58';
import { isHubNotDecryptable, isHubTimeout } from '../utils/hubErrors';
import { getNameOwner } from './accounts';
import {
  ADMIN_POLL_SERVICE,
  POLL_COMMENT_PREFIX,
  POLL_PREFIX,
  SHARE_PREFIX,
  VOTE_PREFIX,
  fromData64,
  parseShare,
  type PollRecord,
} from './adminPollRecords';
import {
  adminPollsKey,
  closedPollsKey,
  onePollKey,
  pollDecryptRetries,
  retryPollDecrypts,
} from './adminPollKeys';
import { getText, seg } from './core';
import { getAdmins } from './group';
import { QdnDeletedError, fetchQdnText, mapLimit, quick, searchQdn } from './qdn';
import { fetchQuery, peekQuery } from './query';
import type { AccountInfo } from './types';
import {
  SEARCH_LOOKBACK_MS,
  groupPollRows,
  isPollOpen,
  isPollShown,
  needsShareRead,
  pollRowTime,
  resolvePoll,
  trustedName,
  validShares,
  type BodyRead,
  type PollContext,
  type PollRow,
  type PollSources,
  type ReadRow,
} from '../rules/adminPolls';

/** Pages of 100 rows read at most per prefix, newest first. */
export const ADMIN_POLL_PAGES = 3;
/** The same over all time (History, an older poll's page): 1,000 rows per prefix. */
export const ALL_TIME_POLL_PAGES = 10;
/** History lists this many closed polls, and this many more per Show more. */
export const POLL_HISTORY_PAGE = 10;

/**
 * Which polls a read is for:
 * - `listed`: Decisions, Home and a poll's page: open, or ended in the last 31 days;
 * - `closed`: History: the `count` that ended most recently, of all time;
 * - `poll`: the page of a poll that is no longer listed: that one, of all time.
 * Only the polls kept have their votes and shares read and decrypted.
 */
export type PollScope =
  { kind: 'listed' } | { kind: 'closed'; count: number } | { kind: 'poll'; id: string };

const LISTED: PollScope = { kind: 'listed' };

/** The read store's key for a scope (data/adminPollKeys.ts). */
export function pollScopeKey(viewer: string, scope: PollScope): string {
  return scope.kind === 'closed'
    ? closedPollsKey(viewer, scope.count)
    : scope.kind === 'poll'
      ? onePollKey(viewer, scope.id)
      : adminPollsKey(viewer);
}
const HOUR = 3_600_000;
const MISS_FIRST_MS = 2 * 60_000;
const MISS_MAX_MS = 15 * 60_000;

export interface AdminPollsData {
  viewer: string;
  /** Current Minter Admins who can sign, in Core's order. */
  signers: string[];
  /** Names seen, and their owners (null: no owner or not found). */
  publishers: Record<string, string | null>;
  /** One per poll that can be listed. */
  sources: PollSources[];
  /** A search hit its ceiling (shown, never silent). */
  truncated: boolean;
  /** Polls whose body Hub didn't decrypt this time (not "not encrypted to you"): said, with Retry. */
  undecrypted: number;
  /** History: more closed polls than `count` (Show more). */
  more?: boolean;
  loadedAt: number;
}

export { adminPollsKey };

/** The context the pure rules need, from what the loader read. */
export function pollContext(data: AdminPollsData, now = Date.now()): PollContext {
  return {
    now,
    signers: data.signers,
    publisherOf: (name) => data.publishers[name] ?? null,
    viewer: data.viewer,
    truncated: data.truncated,
  };
}

/**
 * Bodies not on the node yet, or that Hub didn't decrypt (`hub`, with the
 * Retry count then), by key, so a refresh doesn't ask for them each minute.
 */
const misses = new Map<string, { until: number; wait: number; hub?: number }>();

/** Tests start with nothing remembered. */
export function resetAdminPollMisses(): void {
  misses.clear();
}

export { retryPollDecrypts };

/** DECRYPT_DATA failed, but not because the body isn't encrypted to the viewer. */
class HubDidNotDecrypt extends Error {}

/**
 * One encrypted body, decrypted with the viewer's key, kept for the session
 * per version. Never throws: what went wrong is the status. Only Hub's own
 * "unable to decrypt" makes a body locked; when Hub fails otherwise (its
 * wallet locked, outside Hub) the body is unavailable this time and tried
 * again after 2, 4, 8 and then every 15 minutes, or at once on a Retry.
 */
export function readPollBody(viewer: string, row: PollRow): Promise<BodyRead> {
  const key = `adminpollbody:${viewer}:${row.name}:${row.identifier}:${pollRowTime(row)}`;
  const miss = misses.get(key);
  const hubMiss = miss?.hub !== undefined;
  // A Retry since Hub failed asks again now; a background refresh waits.
  if (miss && Date.now() < miss.until && (!hubMiss || miss.hub === pollDecryptRetries()))
    return Promise.resolve(
      hubMiss ? { status: 'unavailable', hub: true } : { status: 'unavailable' }
    );
  const backOff = (hub: boolean) => {
    const wait = miss ? Math.min(miss.wait * 2, MISS_MAX_MS) : MISS_FIRST_MS;
    misses.set(key, {
      until: Date.now() + wait,
      wait,
      ...(hub ? { hub: pollDecryptRetries() } : {}),
    });
  };
  return fetchQuery<BodyRead>(
    key,
    async () => {
      let encrypted: string;
      try {
        encrypted = await fetchQdnText(ADMIN_POLL_SERVICE, row.name, row.identifier, {
          encoding: 'base64',
        });
      } catch (error) {
        if (error instanceof QdnDeletedError) return { status: 'invalid' };
        backOff(false);
        throw error;
      }
      misses.delete(key);
      let plain: unknown;
      try {
        plain = await qortal({ action: 'DECRYPT_DATA', encryptedData: encrypted.trim() });
      } catch (error) {
        // Hub busy (its 30 s limit): ask again on the next read.
        if (isHubTimeout(error)) throw error;
        // Not encrypted to this viewer: skipped quietly from now on.
        if (isHubNotDecryptable(error)) return { status: 'locked' };
        // Anything else can work later: not kept.
        backOff(true);
        throw new HubDidNotDecrypt();
      }
      try {
        return { status: 'ok', value: fromData64(String(plain)) };
      } catch {
        return { status: 'invalid' };
      }
    },
    { ttlMs: Number.POSITIVE_INFINITY }
  ).catch((error): BodyRead =>
    error instanceof HubDidNotDecrypt
      ? { status: 'unavailable', hub: true }
      : { status: 'unavailable' }
  );
}

/** Read rows' bodies, 6 at a time; a slow one is 'unavailable' this time. */
function readRows(viewer: string, rows: readonly PollRow[]): Promise<ReadRow[]> {
  return mapLimit([...rows], 6, async (row): Promise<ReadRow> => {
    const result = await quick(readPollBody(viewer, row));
    return { row, body: result.value ?? { status: 'unavailable' } };
  });
}

const EMPTY = (viewer: string, signers: string[]): AdminPollsData => ({
  viewer,
  signers,
  publishers: {},
  sources: [],
  truncated: false,
  undecrypted: 0,
  loadedAt: Date.now(),
});

/**
 * The Minter Admin polls of `scope` the viewer can read, with what is needed
 * to show them. Key `adminpolls:list:<viewer>` (listed),
 * `adminpolls:closed:<viewer>:<count>` or `adminpolls:poll:<viewer>:<id>`.
 */
export function loadAdminPolls(
  viewer: string,
  options: { force?: boolean; scope?: PollScope } = {}
): Promise<AdminPollsData> {
  const scope = options.scope ?? LISTED;
  return fetchQuery(
    pollScopeKey(viewer, scope),
    async () => {
      const force = options.force;
      const admins = await getAdmins();
      const signers = admins.signers.map((a) => a.member);
      // Nobody else can decrypt them: nothing to read.
      if (!signers.includes(viewer)) return EMPTY(viewer, signers);

      const now = Date.now();
      const listedScope = scope.kind === 'listed';
      // Rounded to the hour, so the searches' own cache keys hold for an hour; all time otherwise.
      const after = listedScope ? Math.floor((now - SEARCH_LOOKBACK_MS) / HOUR) * HOUR : undefined;
      const maxPages = listedScope ? ADMIN_POLL_PAGES : ALL_TIME_POLL_PAGES;
      const search = (identifier: string) =>
        searchQdn({ service: ADMIN_POLL_SERVICE, identifier, after, maxPages }, { force });
      const [polls, votes, comments, shares] = await Promise.all([
        search(POLL_PREFIX),
        search(VOTE_PREFIX),
        search(POLL_COMMENT_PREFIX),
        search(SHARE_PREFIX),
      ]);

      // Who published what: an admin's primary name is known; others are looked up (cached).
      const publishers = new Map<string, string | null>();
      const byPrimary = new Map<string, string>();
      for (const a of admins.signers) if (a.primaryName) byPrimary.set(a.primaryName, a.member);
      const resolve = (names: Iterable<string>) =>
        mapLimit(
          [...new Set(names)].filter((n) => n && !publishers.has(n)),
          6,
          async (name) => {
            const owner = byPrimary.get(name) ?? (await getNameOwner(name).catch(() => null));
            publishers.set(name, owner);
          }
        );
      await resolve(
        [...polls.rows, ...votes.rows, ...comments.rows, ...shares.rows].map((r) => r.name)
      );
      const truncated = [polls, votes, comments, shares].some((r) => r.truncated);
      const ctx: PollContext = {
        now,
        signers,
        publisherOf: (name) => publishers.get(name) ?? null,
        viewer,
        truncated,
      };
      const fromAdmin = (rows: readonly PollRow[]) =>
        rows.filter((row) => trustedName(row.name, ctx) !== null);

      const groups = groupPollRows({
        polls: polls.rows,
        votes: votes.rows,
        shares: shares.rows,
        comments: comments.rows,
      });
      const unread = (rows: PollRow[]): ReadRow[] =>
        rows.map((row) => ({ row, body: { status: 'unavailable' } }));
      // Reads every row of one kind across the polls at once (6 at a time).
      const readAll = async (
        list: PollSources[],
        pick: (src: PollSources) => ReadRow[],
        put: (src: PollSources, reads: ReadRow[]) => void
      ) => {
        const rows = list.flatMap((src) => fromAdmin(pick(src).map((r) => r.row)));
        const reads = new Map(
          (await readRows(viewer, rows)).map((r) => [`${r.row.name}\n${r.row.identifier}`, r])
        );
        for (const src of list)
          put(
            src,
            fromAdmin(pick(src).map((r) => r.row)).map(
              (row) => reads.get(`${row.name}\n${row.identifier}`) as ReadRow
            )
          );
      };

      // 1. The polls themselves.
      const sources: PollSources[] = [...groups].map(([pollId, g]) => ({
        pollId,
        polls: unread(g.polls),
        votes: unread(g.votes),
        shares: unread(g.shares),
        comments: g.comments,
      }));
      // A poll's own page: only that one is read.
      const candidates =
        scope.kind === 'poll' ? sources.filter((src) => src.pollId === scope.id) : sources;
      await readAll(
        candidates,
        (src) => src.polls,
        (src, reads) => (src.polls = reads)
      );

      // 2. Votes, for the polls of the scope, or that might be through a share.
      const inScope = (poll: PollRecord) =>
        scope.kind === 'listed'
          ? isPollShown(poll, now)
          : scope.kind === 'closed'
            ? !isPollOpen(poll, now)
            : true;
      const maybeShown = (src: PollSources) => {
        const direct = resolvePoll({ ...src, shares: [] }, ctx);
        if (direct) return inScope(direct.poll);
        return fromAdmin(src.shares.map((s) => s.row)).length > 0;
      };
      let wanted = candidates.filter(maybeShown);
      // History: the `count` that ended last. One readable only through a share has no end
      // until its share is read: those few are read too, and the page is cut once they are.
      let more = false;
      if (scope.kind === 'closed') {
        const endOf = new Map<PollSources, number>();
        for (const src of wanted) {
          const direct = resolvePoll({ ...src, shares: [] }, ctx);
          if (direct) endOf.set(src, direct.poll.endsAt);
        }
        const known = wanted
          .filter((src) => endOf.has(src))
          .sort((a, b) => (endOf.get(b) as number) - (endOf.get(a) as number));
        more = known.length > scope.count;
        wanted = [...known.slice(0, scope.count), ...wanted.filter((src) => !endOf.has(src))];
      }
      await readAll(
        wanted,
        (src) => src.votes,
        (src, reads) => (src.votes = reads)
      );

      // 3. Shares, where something is missing for the viewer.
      const sharing = wanted.filter((src) => needsShareRead(src, ctx));
      await readAll(
        sharing,
        (src) => src.shares,
        (src, reads) => (src.shares = reads)
      );
      // The names a share speaks of are checked like any publisher.
      const named: string[] = [];
      for (const src of sharing) {
        for (const read of src.shares) {
          if (read.body.status !== 'ok') continue;
          const share = parseShare(read.body.value, read.row.identifier);
          if (!share) continue;
          named.push(share.pollPublisher, ...share.votes.map((v) => v.name));
          named.push(...share.comments.map((c) => c.name));
        }
      }
      await resolve(named);

      // Only what the scope shows (the bodies stay cached either way).
      let listed = wanted.filter((src) => {
        const resolved = resolvePoll(src, ctx, validShares(src, ctx));
        return resolved !== null && inScope(resolved.poll);
      });
      if (scope.kind === 'closed') {
        const end = (src: PollSources) =>
          resolvePoll(src, ctx, validShares(src, ctx))?.poll.endsAt ?? 0;
        listed = listed.sort((a, b) => end(b) - end(a));
        if (listed.length > scope.count) {
          more = true;
          listed = listed.slice(0, scope.count);
        }
      }
      // Polls left out only because Hub didn't decrypt them this time: never an empty list in silence.
      const shown = new Set(listed);
      const hubFailed = (reads: ReadRow[]) =>
        reads.some((r) => r.body.status === 'unavailable' && r.body.hub);
      const undecrypted = candidates.filter(
        (src) => !shown.has(src) && (hubFailed(src.polls) || hubFailed(src.shares))
      ).length;

      return {
        viewer,
        signers,
        publishers: Object.fromEntries(publishers),
        sources: listed,
        truncated,
        undecrypted,
        ...(scope.kind === 'closed' ? { more } : {}),
        loadedAt: Date.now(),
      };
    },
    { ttlMs: 60_000, force: options.force }
  );
}

/** A thread shows this many comments, and this many more per "Show more". */
export const POLL_COMMENTS_PAGE = 20;

/** A body as the thread keeps it: still fetching when it was slower than the wait. */
export type ThreadBody = BodyRead & { fetching?: boolean };

/** Rows as a thread lists them (rules/adminPolls.ts pollCommentRows). */
export interface ThreadRow {
  ref: string;
  name: string;
  identifier: string;
  postedAt: number;
  updatedAt: number;
}

/** One key per thread, page and set of versions, so a new comment reads anew. */
export function pollThreadKey(
  viewer: string,
  pollId: string,
  rows: readonly ThreadRow[],
  limit: number
): string {
  let newest = 0;
  for (const row of rows) newest = Math.max(newest, row.updatedAt);
  return `adminpolls:thread:${viewer}:${pollId}:${limit}:${rows.length}:${newest}`;
}

/**
 * A poll's thread, once opened: the bodies of its newest `limit` comments
 * and of the comments their replies answer (threads are one level deep),
 * decrypted once per version like every poll body. A body slower than the
 * wait shows as fetching until the next read.
 */
export function loadPollThread(
  viewer: string,
  pollId: string,
  rows: readonly ThreadRow[],
  limit: number,
  options: { force?: boolean } = {}
): Promise<Map<string, ThreadBody>> {
  return fetchQuery(
    pollThreadKey(viewer, pollId, rows, limit),
    async () => {
      const bodies = new Map<string, ThreadBody>();
      const read = (list: readonly ThreadRow[]) =>
        mapLimit([...list], 6, async (row) => {
          const result = await quick(
            readPollBody(viewer, {
              name: row.name,
              identifier: row.identifier,
              created: row.postedAt,
              updated: row.updatedAt,
            })
          );
          bodies.set(row.ref, result.value ?? { status: 'unavailable', fetching: true });
        });
      await read(rows.slice(0, limit));
      for (let round = 0; round < 3; round++) {
        const wanted = new Set<string>();
        for (const body of bodies.values()) {
          if (body.status !== 'ok') continue;
          const replyTo = (body.value as { replyTo?: unknown } | null)?.replyTo;
          if (typeof replyTo === 'string') wanted.add(replyTo);
        }
        const parents = rows.filter((r) => wanted.has(r.identifier) && !bodies.has(r.ref));
        if (!parents.length) break;
        await read(parents);
      }
      return bodies;
    },
    { ttlMs: 60_000, force: options.force }
  );
}

/** A base58 public key: 32 bytes. */
function isPublicKey(value: string): boolean {
  try {
    return base58Decode(value).length === 32;
  } catch {
    return false;
  }
}

/**
 * An account's public key (`GET /addresses/publickey/{a}`), read once per
 * session; null for an account that has none on chain. A key already in an
 * account read is used without asking again.
 */
export function getPublicKey(address: string): Promise<string | null> {
  return fetchQuery(
    `publickey:${address}`,
    async () => {
      const known = peekQuery<AccountInfo>(`account:${address}`)?.publicKey;
      if (known && isPublicKey(known)) return known;
      const text = (await getText(`/addresses/publickey/${seg(address)}`)).trim();
      return text !== 'false' && isPublicKey(text) ? text : null;
    },
    { ttlMs: Number.POSITIVE_INFINITY }
  );
}

export interface EncryptionTargets {
  /** The addresses a write is encrypted to: every current Minter Admin who can sign and has a key. */
  readers: string[];
  /** Their public keys (the writer's own included), for PUBLISH_QDN_RESOURCE. */
  publicKeys: string[];
}

/**
 * Who a write is encrypted to, read fresh: every current Minter Admin who
 * can sign (MINTER's null owner left out), plus the writer's own key. An
 * admin whose account has no public key can't be encrypted to and is left
 * out (they can be shared with later). Throws when a key can't be read.
 * `force: false` reuses an admin list read fresh a moment ago (a write's guard).
 */
export async function encryptionTargets(
  writer: { address: string; publicKey: string },
  options: { force?: boolean } = {}
): Promise<EncryptionTargets> {
  const admins = await getAdmins({ force: options.force ?? true });
  const signers = admins.signers.map((a) => a.member);
  const keys = await mapLimit(signers, 6, async (address) =>
    address === writer.address ? writer.publicKey : getPublicKey(address)
  );
  const readers: string[] = [];
  const publicKeys: string[] = [];
  signers.forEach((address, i) => {
    const key = keys[i];
    if (!key) return;
    readers.push(address);
    publicKeys.push(key);
  });
  if (!readers.includes(writer.address)) readers.push(writer.address);
  if (!publicKeys.includes(writer.publicKey)) publicKeys.push(writer.publicKey);
  return { readers, publicKeys };
}
