/**
 * What a notification can be about: the account's own shares and comments,
 * looked up once and kept for a while, plus how a comment identifier points
 * back at them.
 *
 * Q-Share keys a share's comments by the last 12 characters of the share's
 * identifier (`qcomment_v1_qshare_<key>_base_<uid>`), and a reply by the last
 * 6 characters of the comment it answers (`…_<key>_reply_<last 6>_<uid>`).
 * That is the original app's scheme: a comment on another share whose
 * identifier ends the same way shows under both, there and here alike.
 */
import { QSHARE_COMMENT_BASE, QSHARE_FILE_BASE } from "../../constants/Identifiers";
import { onQdnSearchesInvalidated, searchQdnAll } from "../qdnSearch";

export const SHARE_KEY_LENGTH = 12;
export const REPLY_KEY_LENGTH = 6;
/** How long the lists of your shares and comments are reused before asking Core again. */
export const ACTIVITY_TTL_MS = 15 * 60_000;

export interface ParsedComment {
  /** Last 12 characters of the share's identifier. */
  key: string;
  /** For a reply: the last 6 characters of the comment it answers. */
  parent?: string;
}

/** The share key and (for a reply) the parent key of a Q-Share comment identifier; null for anything else. */
export function parseCommentIdentifier(identifier: string): ParsedComment | null {
  if (!identifier.startsWith(QSHARE_COMMENT_BASE)) return null;
  const rest = identifier.slice(QSHARE_COMMENT_BASE.length);
  const key = rest.slice(0, SHARE_KEY_LENGTH);
  const tail = rest.slice(SHARE_KEY_LENGTH);
  if (key.length < SHARE_KEY_LENGTH) return null;
  if (tail.startsWith("_base_")) return { key };
  const reply = new RegExp(`^_reply_(.{${REPLY_KEY_LENGTH}})_.`).exec(tail);
  return reply ? { key, parent: reply[1] } : null;
}

export const shareCommentKey = (shareIdentifier: string): string => shareIdentifier.slice(-SHARE_KEY_LENGTH);
export const commentReplyKey = (commentIdentifier: string): string => commentIdentifier.slice(-REPLY_KEY_LENGTH);

export interface OwnShare {
  name: string;
  identifier: string;
  title: string;
  created: number;
}

export interface OwnComment {
  name: string;
  identifier: string;
  created: number;
}

export interface Activity {
  /** Your shares by comment key, newest first. */
  shares: Map<string, OwnShare>;
  /** Your comments (not replies) by reply key, newest first. */
  comments: Map<string, OwnComment>;
  /** False when a list was cut at its page limit. */
  complete: boolean;
}

const cache = new Map<string, { at: number; value: Promise<Activity> }>();
onQdnSearchesInvalidated(() => cache.clear());

/**
 * The shares and comments published by `names`: up to 500 shares and 200
 * comments, newest first, in pages of 100. Reused for ACTIVITY_TTL_MS and
 * dropped whenever the app invalidates its searches (after a publish).
 */
export function loadActivity(names: string[], now = Date.now()): Promise<Activity> {
  const unique = [...new Set(names.filter(Boolean))];
  const key = unique
    .map((n) => n.toLowerCase())
    .sort()
    .join("\n");
  const hit = cache.get(key);
  if (hit && now - hit.at < ACTIVITY_TTL_MS) return hit.value;
  const value = (async (): Promise<Activity> => {
    if (!unique.length) return { shares: new Map(), comments: new Map(), complete: true };
    const [shareRows, commentRows] = await Promise.all([
      searchQdnAll(
        { service: "DOCUMENT", identifier: QSHARE_FILE_BASE, prefix: true, names: unique, includemetadata: true },
        { pageSize: 100, maxPages: 5 }
      ),
      searchQdnAll(
        { service: "BLOG_COMMENT", identifier: QSHARE_COMMENT_BASE, prefix: true, names: unique },
        { pageSize: 100, maxPages: 2 }
      ),
    ]);
    const shares = new Map<string, OwnShare>();
    for (const row of shareRows.rows) {
      const k = shareCommentKey(row.identifier);
      if (!shares.has(k)) {
        shares.set(k, {
          name: row.name,
          identifier: row.identifier,
          title: row.metadata?.title ?? "",
          created: row.created ?? 0,
        });
      }
    }
    const comments = new Map<string, OwnComment>();
    for (const row of commentRows.rows) {
      const parsed = parseCommentIdentifier(row.identifier);
      if (!parsed || parsed.parent) continue;
      const k = commentReplyKey(row.identifier);
      if (!comments.has(k)) comments.set(k, { name: row.name, identifier: row.identifier, created: row.created ?? 0 });
    }
    return { shares, comments, complete: shareRows.complete && commentRows.complete };
  })();
  cache.set(key, { at: now, value });
  // A failed lookup is not kept.
  value.catch(() => {
    if (cache.get(key)?.value === value) cache.delete(key);
  });
  return value;
}

/** For tests. */
export function resetActivity(): void {
  cache.clear();
}
