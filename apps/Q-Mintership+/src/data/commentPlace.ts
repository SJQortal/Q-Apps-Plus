/**
 * Where a comment was posted, from its identifier alone (reply alerts and
 * Home's replies open `/comments/<name>/<identifier>`). The key in the
 * identifier is a nominee's address (a nomination waiting for its first
 * signature) or the first 40 characters of a decision's signature; a
 * decision's full signature is found among the Decisions queue (cached),
 * then MINTER's decisions, newest first, 100 a page (the Explorer's pages,
 * kept for the session), until one starts with the key. The answer is kept
 * for the session too. Read-only.
 */
import { parseAdminCommentIdentifier } from './adminNoteRecords';
import { commentKeyKind, parseCommentIdentifier } from './commentRecords';
import { loadDecisions } from './decisions';
import { loadMinterDecisionPage } from './explorer/answers';
import { fetchQuery } from './query';

/** MINTER's decisions looked through at most: the newest 1,000. */
export const PLACE_PAGES = 10;

export type CommentPlace =
  | { kind: 'nomination'; address: string }
  | { kind: 'decision'; signature: string }
  /** A decision's comment whose decision wasn't among those read. */
  | { kind: 'unknown'; key: string }
  /** Not a comment's identifier. */
  | { kind: 'invalid' };

/** The key of a public comment or of one for the Minter Admins, or null. */
export function commentKeyOf(identifier: string): string | null {
  return (
    (parseCommentIdentifier(identifier) ?? parseAdminCommentIdentifier(identifier))?.key ?? null
  );
}

/** Where a comment was posted. Key `commentplace:<identifier>`, kept for the session. */
export function findCommentPlace(
  identifier: string,
  options: { force?: boolean } = {}
): Promise<CommentPlace> {
  return fetchQuery(`commentplace:${identifier}`, () => lookUp(identifier), {
    ttlMs: Number.POSITIVE_INFINITY,
    force: options.force,
  });
}

async function lookUp(identifier: string): Promise<CommentPlace> {
  const key = commentKeyOf(identifier);
  if (!key) return { kind: 'invalid' };
  if (commentKeyKind(key) === 'nomination') return { kind: 'nomination', address: key };
  // Most comments are on decisions still waiting: the queue first (a failed read falls through).
  const queue = await loadDecisions().catch(() => null);
  const waiting = queue?.decisions.find((d) => d.signature.startsWith(key));
  if (waiting) return { kind: 'decision', signature: waiting.signature };
  for (let page = 0; page < PLACE_PAGES; page++) {
    const result = await loadMinterDecisionPage(page);
    const hit = result.rows.find((row) => row.signature.startsWith(key));
    if (hit) return { kind: 'decision', signature: hit.signature };
    if (!result.full) break;
  }
  return { kind: 'unknown', key };
}
