/**
 * Replies to someone's comments since a time, for Home's "Since your last
 * visit": one QDN search by the reply marker in the description
 * (data/replyMarkers.ts), `GET /arbitrary/resources/search` (the simple
 * search can't match a description), newest first, at most 20; for a Minter
 * Admin a second one for their comments for the Minter Admins. No bodies are
 * read: the rows say who replied, where (the key in the identifier) and
 * when. Key `replies:<name>:<admin>:<after>`, kept 5 minutes.
 */
import { ADMIN_COMMENT_PREFIX, ADMIN_NOTE_SERVICE } from './adminNoteRecords';
import { COMMENT_PREFIX, COMMENT_SERVICE } from './commentRecords';
import { getJson, query } from './core';
import { fetchQuery } from './query';
import { replyMarker } from './replyMarkers';
import type { QdnRow } from './types';

/** Replies listed at most per search. */
export const REPLIES_MAX = 20;

export interface ReplyRow {
  /** The name that replied. */
  name: string;
  identifier: string;
  /** When it was published (ms). */
  at: number;
  /** A reply for the Minter Admins only. */
  adminOnly: boolean;
}

export function repliesSearchPath(
  name: string,
  service: string,
  prefix: string,
  after: number
): string {
  return `/arbitrary/resources/search?${query({
    service,
    identifier: prefix,
    // With `prefix`, Core matches the identifier and the description from their start.
    description: replyMarker(name),
    prefix: true,
    mode: 'ALL',
    after,
    limit: REPLIES_MAX,
    reverse: true,
  })}`;
}

function rowsOf(body: unknown, adminOnly: boolean, me: string, prefix: string): ReplyRow[] {
  if (!Array.isArray(body)) return [];
  const mine = me.trim().toLowerCase();
  return (body as QdnRow[])
    .filter(
      (row) =>
        row &&
        typeof row.name === 'string' &&
        typeof row.identifier === 'string' &&
        row.identifier.startsWith(prefix) &&
        // One's own replies (to oneself) aren't news.
        row.name.trim().toLowerCase() !== mine
    )
    .map((row) => ({
      name: row.name,
      identifier: row.identifier,
      at: row.created,
      adminOnly,
    }));
}

/**
 * The replies to `name`'s comments published after `after` (ms), newest
 * first; `admin` adds the replies for the Minter Admins. A failed second
 * search leaves those out rather than failing the first.
 */
export function loadRepliesTo(
  name: string,
  after: number,
  options: { admin?: boolean } = {}
): Promise<ReplyRow[]> {
  const admin = Boolean(options.admin);
  return fetchQuery(
    `replies:${name}:${admin}:${after}`,
    async () => {
      const [open, forAdmins] = await Promise.all([
        getJson<unknown>(repliesSearchPath(name, COMMENT_SERVICE, COMMENT_PREFIX, after)),
        admin
          ? getJson<unknown>(
              repliesSearchPath(name, ADMIN_NOTE_SERVICE, ADMIN_COMMENT_PREFIX, after)
            ).catch(() => [])
          : Promise.resolve([]),
      ]);
      return [
        ...rowsOf(open, false, name, COMMENT_PREFIX),
        ...rowsOf(forAdmins, true, name, ADMIN_COMMENT_PREFIX),
      ].sort((a, b) => b.at - a.at);
    },
    { ttlMs: 5 * 60_000 }
  );
}
