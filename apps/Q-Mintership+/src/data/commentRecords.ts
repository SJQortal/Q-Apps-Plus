/**
 * Public comments on decisions and nominations, and the Minter Admins' small
 * "hidden" records (docs/apps/Q-Mintership+.md → Data contract). Both are
 * additive QDN data with their own prefixes: the original app never reads or
 * writes them.
 *
 * Comment  service JSON, identifier `qmp-comment-<key>-<id>`, published by
 *          anyone with a registered name, under that name.
 *          { v: 1, key, text, replyTo?, edited?, deleted? }
 * Hide     service JSON, identifier `qmp-hide-<key>-<id>`, published by a
 *          Minter Admin under their name, to hide one comment for everyone
 *          (or show it again).
 *          { v: 1, commentName, commentIdentifier, hidden }
 *
 * `key` says what a comment is about: the first 40 characters of the
 * transaction signature for a decision, or the nominee's address for a
 * nomination still waiting for its first signature. `id` is 6 letters or
 * digits. An edit or a deletion republishes the same identifier, so the
 * newest version wins; a deleted comment keeps its place (and its replies)
 * and reads "Deleted".
 *
 * Nothing in a record is trusted on its own: the publisher comes from the
 * QDN search row, the key from the identifier, and a hide counts only when
 * the name that published it belongs to a Minter Admin at the time of
 * reading (data/comments.ts).
 */
import { isAddress } from './accounts';
import { isQortalLink, RECORD_SERVICE } from './records';

export { RECORD_SERVICE as COMMENT_SERVICE };

export const COMMENT_PREFIX = 'qmp-comment-';
export const HIDE_PREFIX = 'qmp-hide-';

/** A comment's text, in characters. */
export const COMMENT_MAX = 1000;
/** At most this many `qortal://` links become buttons under a comment. */
export const COMMENT_LINKS_MAX = 5;
/** Characters of a decision's transaction signature in its key. */
export const DECISION_KEY_LENGTH = 40;
/** Qortal names are at most 40 characters. */
export const NAME_MAX = 40;
/** QDN identifiers are at most 64 characters (Core's ArbitraryTransaction). */
export const IDENTIFIER_MAX = 64;

const B58 = '1-9A-HJ-NP-Za-km-z';
const DECISION_KEY_RE = new RegExp(`^[${B58}]{${DECISION_KEY_LENGTH}}$`);
const KEY_PART = `[${B58}]{34}|[${B58}]{${DECISION_KEY_LENGTH}}`;
const COMMENT_ID_RE = new RegExp(`^${COMMENT_PREFIX}(${KEY_PART})-([A-Za-z0-9]{6})$`);
const HIDE_ID_RE = new RegExp(`^${HIDE_PREFIX}(${KEY_PART})-([A-Za-z0-9]{6})$`);
const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export type CommentKeyKind = 'decision' | 'nomination';

export interface CommentRecord {
  v: 1;
  key: string;
  /** Plain text, 1–1000 characters; empty when `deleted`. */
  text: string;
  /** The identifier of the comment this one answers. */
  replyTo?: string;
  edited?: true;
  deleted?: true;
}

export interface HideRecord {
  v: 1;
  commentName: string;
  commentIdentifier: string;
  hidden: boolean;
}

/** A decision's key: the first 40 characters of its transaction signature. */
export function decisionCommentKey(signature: string): string {
  return signature.slice(0, DECISION_KEY_LENGTH);
}

/** A waiting nomination's key: the nominee's address. */
export function nominationCommentKey(nominee: string): string {
  return nominee;
}

/** What a key is about, or null when it is neither a decision's nor a nominee's. */
export function commentKeyKind(key: unknown): CommentKeyKind | null {
  if (typeof key !== 'string') return null;
  if (DECISION_KEY_RE.test(key)) return 'decision';
  if (isAddress(key)) return 'nomination';
  return null;
}

export function isCommentKey(key: unknown): key is string {
  return commentKeyKind(key) !== null;
}

/** The search prefix for every comment about `key` (the dash keeps an address from matching a longer key). */
export function commentSearchPrefix(key: string): string {
  return `${COMMENT_PREFIX}${key}-`;
}

export function hideSearchPrefix(key: string): string {
  return `${HIDE_PREFIX}${key}-`;
}

function parseId(re: RegExp, identifier: unknown): { key: string; id: string } | null {
  if (typeof identifier !== 'string' || identifier.length > IDENTIFIER_MAX) return null;
  const m = re.exec(identifier);
  if (!m || !isCommentKey(m[1])) return null;
  return { key: m[1], id: m[2] };
}

/** `qmp-comment-<key>-<id>` → its key and id, or null. */
export function parseCommentIdentifier(identifier: unknown): { key: string; id: string } | null {
  return parseId(COMMENT_ID_RE, identifier);
}

/** `qmp-hide-<key>-<id>` → its key and id, or null. */
export function parseHideIdentifier(identifier: unknown): { key: string; id: string } | null {
  return parseId(HIDE_ID_RE, identifier);
}

/** Six random letters and digits (crypto.getRandomValues; `random` for tests). */
export function randomCommentId(random: (bytes: Uint8Array) => Uint8Array = defaultRandom): string {
  let id = '';
  while (id.length < 6) {
    // 252 = 7 × 36: bytes above it are skipped, so every character is as likely.
    for (const byte of random(new Uint8Array(12))) {
      if (byte < 252 && id.length < 6) id += ID_ALPHABET[byte % ID_ALPHABET.length];
    }
  }
  return id;
}

function defaultRandom(bytes: Uint8Array): Uint8Array {
  return crypto.getRandomValues(bytes);
}

/** A new comment's identifier. Throws for a key that is neither a decision's nor a nominee's. */
export function newCommentIdentifier(key: string, id: string = randomCommentId()): string {
  if (!isCommentKey(key)) throw new Error('Not a decision or a nomination.');
  if (!/^[A-Za-z0-9]{6}$/.test(id)) throw new Error('A comment id is 6 letters or digits.');
  return `${COMMENT_PREFIX}${key}-${id}`;
}

/** FNV-1a over the UTF-16 code units, as 6 base-36 characters. */
function hash6(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h % 36 ** 6).toString(36).padStart(6, '0');
}

/**
 * The identifier a Minter Admin's hide record for one comment uses. The same
 * admin hiding and showing the same comment republishes one identifier.
 */
export function hideIdentifier(
  key: string,
  commentName: string,
  commentIdentifier: string
): string {
  if (!isCommentKey(key)) throw new Error('Not a decision or a nomination.');
  return `${HIDE_PREFIX}${key}-${hash6(`${commentName}\n${commentIdentifier}`)}`;
}

/** One comment, wherever it is listed: its publisher's name and its identifier. */
export function commentRef(name: string, identifier: string): string {
  return `${name}\n${identifier}`;
}

// Control characters (but line breaks and tabs) and the bidi overrides that
// could make a comment read differently from what it says.
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARS = /[\u0000-\u0008\u000b-\u001f\u007f‪-‮⁦-⁩]/g;

/** A comment's text as it is shown and published: plain, trimmed, at most one blank line in a row. */
export function normaliseCommentText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(UNSAFE_CHARS, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Problems with a comment someone is writing, in plain words (empty when it is fine). */
export function commentTextProblems(text: string): string[] {
  const clean = normaliseCommentText(text);
  if (!clean) return ['Write something first.'];
  if (clean.length > COMMENT_MAX)
    return [`Keep it under ${COMMENT_MAX.toLocaleString('en-US')} characters.`];
  return [];
}

function isCommentName(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= NAME_MAX;
}

/** Validate a comment body read from QDN. Null when it is not a valid v1 comment for `identifier`. */
export function parseComment(body: unknown, identifier: string): CommentRecord | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (b.v !== 1) return null;
  const parsed = parseCommentIdentifier(identifier);
  if (!parsed || b.key !== parsed.key) return null;
  if (b.deleted !== undefined && b.deleted !== true) return null;
  if (b.edited !== undefined && b.edited !== true) return null;
  let replyTo: string | undefined;
  if (b.replyTo !== undefined) {
    if (!parseCommentIdentifier(b.replyTo) || b.replyTo === identifier) return null;
    replyTo = b.replyTo as string;
  }
  const record: CommentRecord = { v: 1, key: parsed.key, text: '' };
  if (replyTo) record.replyTo = replyTo;
  if (b.deleted === true) {
    record.deleted = true;
    return record;
  }
  if (typeof b.text !== 'string') return null;
  const text = normaliseCommentText(b.text);
  if (!text || text.length > COMMENT_MAX) return null;
  record.text = text;
  if (b.edited === true) record.edited = true;
  return record;
}

/** Validate a hide body read from QDN. Null when it is not a valid v1 hide for `identifier`. */
export function parseHide(
  body: unknown,
  identifier: string
): (HideRecord & { key: string }) | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (b.v !== 1 || typeof b.hidden !== 'boolean' || !isCommentName(b.commentName)) return null;
  const own = parseHideIdentifier(identifier);
  const target = parseCommentIdentifier(b.commentIdentifier);
  if (!own || !target || target.key !== own.key) return null;
  return {
    v: 1,
    key: own.key,
    commentName: b.commentName,
    commentIdentifier: b.commentIdentifier as string,
    hidden: b.hidden,
  };
}

export interface CommentInput {
  key: string;
  text: string;
  /** The identifier of the comment this one answers. */
  replyTo?: string | null;
  /** True when it replaces an earlier version. */
  edited?: boolean;
}

/** The comment to publish. Throws when the input has problems. */
export function buildComment(input: CommentInput): CommentRecord {
  if (!isCommentKey(input.key)) throw new Error('Not a decision or a nomination.');
  const problems = commentTextProblems(input.text);
  if (problems.length) throw new Error(problems.join(' '));
  const record: CommentRecord = { v: 1, key: input.key, text: normaliseCommentText(input.text) };
  if (input.replyTo) {
    if (!parseCommentIdentifier(input.replyTo))
      throw new Error('That reply has nothing to answer.');
    record.replyTo = input.replyTo;
  }
  if (input.edited) record.edited = true;
  return record;
}

/** What a deleted comment is republished as: its place and its thread stay. */
export function buildDeletedComment(input: {
  key: string;
  replyTo?: string | null;
}): CommentRecord {
  if (!isCommentKey(input.key)) throw new Error('Not a decision or a nomination.');
  const record: CommentRecord = { v: 1, key: input.key, text: '', deleted: true };
  if (input.replyTo && parseCommentIdentifier(input.replyTo)) record.replyTo = input.replyTo;
  return record;
}

export function buildHide(input: {
  commentName: string;
  commentIdentifier: string;
  hidden: boolean;
}): HideRecord {
  if (!isCommentName(input.commentName)) throw new Error('Not a Qortal name.');
  if (!parseCommentIdentifier(input.commentIdentifier)) throw new Error('Not a comment.');
  return {
    v: 1,
    commentName: input.commentName,
    commentIdentifier: input.commentIdentifier,
    hidden: input.hidden,
  };
}

const TEXT_LINK = /qortal:\/\/[^\s<>"']+/gi;

/** The `qortal://` links in a comment, in order, each once (at most 5), trailing punctuation left out. */
export function commentLinks(text: string): string[] {
  const links: string[] = [];
  for (const m of text.matchAll(TEXT_LINK)) {
    const link = m[0].replace(/[.,;:!?)\]}]+$/, '');
    if (isQortalLink(link) && !links.includes(link)) links.push(link);
    if (links.length >= COMMENT_LINKS_MAX) break;
  }
  return links;
}
