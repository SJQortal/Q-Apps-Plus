/**
 * Words for the Minter Admins only, encrypted to them (docs/apps/Q-Mintership+.md →
 * Data contract): additive QDN data with their own prefixes, published the
 * way Minter Admin polls are (service DOCUMENT_PRIVATE, encrypted by Hub to
 * every current Minter Admin who can sign, and the writer). The original
 * app never reads or writes them.
 *
 * Note     identifier `qmp-adminnote-<key>`, published by whoever proposed
 *          the decision (or nominated), under their name: the extra
 *          description only Minter Admins read, beside the public reason.
 *          Republishing it replaces it (an edit).
 *          { v: 1, key, text, edited? }
 * Comment  identifier `qmp-macomment-<key>-<id>`, a Minter Admin's comment
 *          for the Minter Admins only, in the same thread as the public
 *          comments; a comment's own shape (data/commentRecords.ts), and a
 *          reply may answer a public comment or another one of these.
 *          { v: 1, key, text, replyTo?, edited?, deleted? }
 *
 * `key` is a comment key: the first 40 characters of the decision's
 * signature, or the nominee's address for a nomination still waiting for
 * its first approval. `id` is 6 letters or digits.
 *
 * Nothing in a record is trusted on its own: the publisher comes from the
 * QDN search row, the key from the identifier; a note counts only from a
 * name owned by the account that proposed the decision, and a comment only
 * from a name owned by a current Minter Admin, at the time of reading
 * (data/adminNotes.ts).
 */
import { ADMIN_POLL_SERVICE } from './adminPollRecords';
import {
  COMMENT_MAX,
  IDENTIFIER_MAX,
  isCommentKey,
  normaliseCommentText,
  parseCommentIdentifier,
  randomCommentId,
  type CommentRecord,
} from './commentRecords';

export { ADMIN_POLL_SERVICE as ADMIN_NOTE_SERVICE };
/** A note's text as it is shown and published: a comment's rules (plain, trimmed). */
export { normaliseCommentText as normaliseNoteText };

export const ADMIN_NOTE_PREFIX = 'qmp-adminnote-';
export const ADMIN_COMMENT_PREFIX = 'qmp-macomment-';

/** A note for the Minter Admins, in characters (a poll's details are as long). */
export const ADMIN_NOTE_MAX = 2000;

const B58 = '1-9A-HJ-NP-Za-km-z';
const KEY_PART = `[${B58}]{34}|[${B58}]{40}`;
const NOTE_ID_RE = new RegExp(`^${ADMIN_NOTE_PREFIX}(${KEY_PART})$`);
const COMMENT_ID_RE = new RegExp(`^${ADMIN_COMMENT_PREFIX}(${KEY_PART})-([A-Za-z0-9]{6})$`);

export interface AdminNoteRecord {
  v: 1;
  key: string;
  /** Plain text, 1–2000 characters. */
  text: string;
  /** It replaces an earlier version. */
  edited?: true;
}

/** A Minter Admins' comment: the shape of a public one. */
export type AdminCommentRecord = CommentRecord;

/** The note's identifier for `key`. Throws for a key that is neither a decision's nor a nominee's. */
export function adminNoteIdentifier(key: string): string {
  if (!isCommentKey(key)) throw new Error('Not a decision or a nomination.');
  return `${ADMIN_NOTE_PREFIX}${key}`;
}

/** `qmp-adminnote-<key>` → its key, or null. */
export function parseAdminNoteIdentifier(identifier: unknown): { key: string } | null {
  if (typeof identifier !== 'string' || identifier.length > IDENTIFIER_MAX) return null;
  const m = NOTE_ID_RE.exec(identifier);
  return m && isCommentKey(m[1]) ? { key: m[1] } : null;
}

/** `qmp-macomment-<key>-<id>` → its key and id, or null. */
export function parseAdminCommentIdentifier(
  identifier: unknown
): { key: string; id: string } | null {
  if (typeof identifier !== 'string' || identifier.length > IDENTIFIER_MAX) return null;
  const m = COMMENT_ID_RE.exec(identifier);
  return m && isCommentKey(m[1]) ? { key: m[1], id: m[2] } : null;
}

/** The search prefix for every Minter Admins' comment about `key`. */
export function adminCommentSearchPrefix(key: string): string {
  return `${ADMIN_COMMENT_PREFIX}${key}-`;
}

/** A new Minter Admins' comment's identifier. Throws for a key that is neither a decision's nor a nominee's. */
export function newAdminCommentIdentifier(key: string, id: string = randomCommentId()): string {
  if (!isCommentKey(key)) throw new Error('Not a decision or a nomination.');
  if (!/^[A-Za-z0-9]{6}$/.test(id)) throw new Error('A comment id is 6 letters or digits.');
  return `${ADMIN_COMMENT_PREFIX}${key}-${id}`;
}

/** Either kind of comment's identifier: what a reply in the shared thread may answer. */
export function isAnyCommentIdentifier(value: unknown): value is string {
  return parseCommentIdentifier(value) !== null || parseAdminCommentIdentifier(value) !== null;
}

/** Problems with a note someone is writing, in plain words (empty when it is fine). */
export function adminNoteTextProblems(text: string): string[] {
  const clean = normaliseCommentText(text);
  if (!clean) return ['Write something first.'];
  if (clean.length > ADMIN_NOTE_MAX)
    return [`Keep it under ${ADMIN_NOTE_MAX.toLocaleString('en-US')} characters.`];
  return [];
}

/** The note to publish. Throws when the input has problems. */
export function buildAdminNote(input: {
  key: string;
  text: string;
  edited?: boolean;
}): AdminNoteRecord {
  if (!isCommentKey(input.key)) throw new Error('Not a decision or a nomination.');
  const problems = adminNoteTextProblems(input.text);
  if (problems.length) throw new Error(problems.join(' '));
  const record: AdminNoteRecord = { v: 1, key: input.key, text: normaliseCommentText(input.text) };
  if (input.edited) record.edited = true;
  return record;
}

/** Validate a note read from QDN (decrypted). Null when it is not a valid v1 note for `identifier`. */
export function parseAdminNote(body: unknown, identifier: string): AdminNoteRecord | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  const parsed = parseAdminNoteIdentifier(identifier);
  if (b.v !== 1 || !parsed || b.key !== parsed.key || typeof b.text !== 'string') return null;
  if (b.edited !== undefined && b.edited !== true) return null;
  const text = normaliseCommentText(b.text);
  if (!text || text.length > ADMIN_NOTE_MAX) return null;
  const record: AdminNoteRecord = { v: 1, key: parsed.key, text };
  if (b.edited === true) record.edited = true;
  return record;
}

export interface AdminCommentInput {
  key: string;
  text: string;
  /** The identifier of the comment it answers: a public one, or another Minter Admins' one. */
  replyTo?: string | null;
  edited?: boolean;
}

/** The Minter Admins' comment to publish. Throws when the input has problems. */
export function buildAdminComment(input: AdminCommentInput): AdminCommentRecord {
  if (!isCommentKey(input.key)) throw new Error('Not a decision or a nomination.');
  const clean = normaliseCommentText(input.text);
  if (!clean) throw new Error('Write something first.');
  if (clean.length > COMMENT_MAX)
    throw new Error(`Keep it under ${COMMENT_MAX.toLocaleString('en-US')} characters.`);
  const record: AdminCommentRecord = { v: 1, key: input.key, text: clean };
  if (input.replyTo) {
    if (!isAnyCommentIdentifier(input.replyTo))
      throw new Error('That reply has nothing to answer.');
    record.replyTo = input.replyTo;
  }
  if (input.edited) record.edited = true;
  return record;
}

/** What a deleted Minter Admins' comment is republished as: its place and its thread stay. */
export function buildDeletedAdminComment(input: {
  key: string;
  replyTo?: string | null;
}): AdminCommentRecord {
  if (!isCommentKey(input.key)) throw new Error('Not a decision or a nomination.');
  const record: AdminCommentRecord = { v: 1, key: input.key, text: '', deleted: true };
  if (input.replyTo && isAnyCommentIdentifier(input.replyTo)) record.replyTo = input.replyTo;
  return record;
}

/**
 * Validate a Minter Admins' comment read from QDN (decrypted). Null when it
 * is not a valid v1 comment for `identifier`.
 */
export function parseAdminComment(body: unknown, identifier: string): AdminCommentRecord | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (b.v !== 1) return null;
  const parsed = parseAdminCommentIdentifier(identifier);
  if (!parsed || b.key !== parsed.key) return null;
  if (b.deleted !== undefined && b.deleted !== true) return null;
  if (b.edited !== undefined && b.edited !== true) return null;
  let replyTo: string | undefined;
  if (b.replyTo !== undefined) {
    if (!isAnyCommentIdentifier(b.replyTo) || b.replyTo === identifier) return null;
    replyTo = b.replyTo;
  }
  const record: AdminCommentRecord = { v: 1, key: parsed.key, text: '' };
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
