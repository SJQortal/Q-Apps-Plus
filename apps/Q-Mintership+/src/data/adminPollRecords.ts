/**
 * Minter Admin polls (docs/apps/Q-Mintership+.md → Data contract): a question
 * for the Minter Admins, their votes and comments, and copies an admin shares
 * with Minter Admins added since. Advisory only: nothing on chain follows
 * from a result. The data is additive, with its own prefixes; the original
 * app never reads or writes it.
 *
 * Every record is QDN service DOCUMENT_PRIVATE (Core accepts only encrypted
 * data there, with no size cap), published under the writer's registered
 * name, and encrypted by Hub (PUBLISH_QDN_RESOURCE with `encrypt: true`) to
 * the public keys of every current Minter Admin who can sign (MINTER's null
 * owner left out) plus the writer's own:
 *
 *   Poll     qmp-adminpoll-<id>
 *            { v: 1, id, question, details?, durationDays, createdAt, endsAt, endHeight, readers }
 *   Vote     qmp-adminvote-<pollId>, one per admin (republished to change it)
 *            { v: 1, pollId, vote: 'yes' | 'no' | 'neutral' }
 *   Comment  qmp-admincomment-<pollId>-<cid>
 *            { v: 1, pollId, text, replyTo?, edited?, deleted? }
 *   Share    qmp-adminshare-<pollId>, one per sharing admin
 *            { v: 1, pollId, poll, pollPublisher, votes, comments, readers, sharedAt }
 *
 * `id` is 8 and `cid` 6 lowercase letters or digits. Anyone can see that a
 * record exists (its QDN row: name, identifier, time); only the Minter
 * Admins it was encrypted to can read what it says. Nothing in a body is
 * trusted on its own: the publisher comes from the QDN row and must be a
 * Minter Admin when it is read (rules/adminPolls.ts).
 */
import { isAddress } from './accounts';
import {
  COMMENT_MAX,
  commentTextProblems,
  normaliseCommentText,
  randomCommentId,
} from './commentRecords';

export const ADMIN_POLL_SERVICE = 'DOCUMENT_PRIVATE';
export const POLL_PREFIX = 'qmp-adminpoll-';
export const VOTE_PREFIX = 'qmp-adminvote-';
export const POLL_COMMENT_PREFIX = 'qmp-admincomment-';
export const SHARE_PREFIX = 'qmp-adminshare-';

export const QUESTION_MIN = 10;
export const QUESTION_MAX = 200;
export const DETAILS_MAX = 2000;
export const DURATION_MIN_DAYS = 1;
export const DURATION_MAX_DAYS = 30;
export const DURATION_DEFAULT_DAYS = 7;
/** A comment on a poll, in characters (as public comments). */
export const POLL_COMMENT_MAX = COMMENT_MAX;
/** More addresses than MINTER has admin rows; keeps a tampered list bounded. */
export const READERS_MAX = 100;
export const SHARE_VOTES_MAX = 100;
export const SHARE_COMMENTS_MAX = 300;
/** Qortal names are at most 40 characters. */
export const NAME_MAX = 40;
/** QDN identifiers are at most 64 characters. */
export const IDENTIFIER_MAX = 64;
export const DAY_MS = 86_400_000;

export type PollVote = 'yes' | 'no' | 'neutral';
export const POLL_VOTES: readonly PollVote[] = ['yes', 'no', 'neutral'];

export interface PollRecord {
  v: 1;
  id: string;
  question: string;
  details?: string;
  durationDays: number;
  /** When it was asked (ms). */
  createdAt: number;
  /** When voting ends (ms), from the measured block time. */
  endsAt: number;
  /** The block it ends at, estimated from the measured block time (informational). */
  endHeight: number;
  /** The addresses it was encrypted to. */
  readers: string[];
}

export interface VoteRecord {
  v: 1;
  pollId: string;
  vote: PollVote;
}

export interface PollCommentRecord {
  v: 1;
  pollId: string;
  /** Plain text, 1–1000 characters; empty when `deleted`. */
  text: string;
  /** The identifier of the comment this one answers. */
  replyTo?: string;
  edited?: true;
  deleted?: true;
}

/** A vote as the sharing admin read it: its publisher's name and its QDN time. */
export interface ShareVote {
  name: string;
  vote: PollVote;
  /** The vote row's updated time (else created), ms. */
  updated: number;
}

/** A comment as the sharing admin read it. */
export interface ShareComment {
  name: string;
  identifier: string;
  postedAt: number;
  updatedAt: number;
  text: string;
  replyTo?: string;
  edited?: true;
  deleted?: true;
}

export interface ShareRecord {
  v: 1;
  pollId: string;
  /** The poll's body as the sharing admin read it. */
  poll: PollRecord;
  /** The name the poll was published under. */
  pollPublisher: string;
  votes: ShareVote[];
  comments: ShareComment[];
  /** The addresses this copy was encrypted to. */
  readers: string[];
  sharedAt: number;
}

// ---- identifiers ----------------------------------------------------------------

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const POLL_ID_RE = /^[a-z0-9]{8}$/;
const POLL_IDENT_RE = /^qmp-adminpoll-([a-z0-9]{8})$/;
const VOTE_IDENT_RE = /^qmp-adminvote-([a-z0-9]{8})$/;
const SHARE_IDENT_RE = /^qmp-adminshare-([a-z0-9]{8})$/;
const COMMENT_IDENT_RE = /^qmp-admincomment-([a-z0-9]{8})-([a-z0-9]{6})$/;

export function isPollId(value: unknown): value is string {
  return typeof value === 'string' && POLL_ID_RE.test(value);
}

function defaultRandom(bytes: Uint8Array): Uint8Array {
  return crypto.getRandomValues(bytes);
}

/** Eight random lowercase letters and digits (crypto.getRandomValues; `random` for tests). */
export function randomPollId(random: (bytes: Uint8Array) => Uint8Array = defaultRandom): string {
  let id = '';
  while (id.length < 8) {
    // 252 = 7 × 36: bytes above it are skipped, so every character is as likely.
    for (const byte of random(new Uint8Array(16))) {
      if (byte < 252 && id.length < 8) id += ID_ALPHABET[byte % ID_ALPHABET.length];
    }
  }
  return id;
}

function requirePollId(pollId: string): void {
  if (!isPollId(pollId)) throw new Error('Not a poll.');
}

export function pollIdentifier(id: string): string {
  requirePollId(id);
  return `${POLL_PREFIX}${id}`;
}

export function voteIdentifier(pollId: string): string {
  requirePollId(pollId);
  return `${VOTE_PREFIX}${pollId}`;
}

export function shareIdentifier(pollId: string): string {
  requirePollId(pollId);
  return `${SHARE_PREFIX}${pollId}`;
}

/** A new comment's identifier (a random 6-character `cid` unless given). */
export function pollCommentIdentifier(pollId: string, cid: string = randomCommentId()): string {
  requirePollId(pollId);
  if (!/^[a-z0-9]{6}$/.test(cid)) throw new Error('A comment id is 6 lowercase letters or digits.');
  return `${POLL_COMMENT_PREFIX}${pollId}-${cid}`;
}

/** The search prefix for every comment on one poll. */
export function pollCommentSearchPrefix(pollId: string): string {
  requirePollId(pollId);
  return `${POLL_COMMENT_PREFIX}${pollId}-`;
}

export type PollRecordKind = 'poll' | 'vote' | 'comment' | 'share';

export interface ParsedPollIdentifier {
  kind: PollRecordKind;
  pollId: string;
  /** A comment's own id. */
  cid?: string;
}

/** What an identifier of these records is, and which poll it belongs to; null for any other. */
export function parsePollRecordIdentifier(identifier: unknown): ParsedPollIdentifier | null {
  if (typeof identifier !== 'string' || identifier.length > IDENTIFIER_MAX) return null;
  let m = POLL_IDENT_RE.exec(identifier);
  if (m) return { kind: 'poll', pollId: m[1] };
  m = VOTE_IDENT_RE.exec(identifier);
  if (m) return { kind: 'vote', pollId: m[1] };
  m = SHARE_IDENT_RE.exec(identifier);
  if (m) return { kind: 'share', pollId: m[1] };
  m = COMMENT_IDENT_RE.exec(identifier);
  if (m) return { kind: 'comment', pollId: m[1], cid: m[2] };
  return null;
}

function idOfKind(identifier: unknown, kind: PollRecordKind): string | null {
  const parsed = parsePollRecordIdentifier(identifier);
  return parsed && parsed.kind === kind ? parsed.pollId : null;
}

// ---- text -------------------------------------------------------------------------

// Control characters and the bidi overrides that could make a question read
// differently from what it says (as in comments).
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARS = /[\u0000-\u001f\u007f‪-‮⁦-⁩]/g;

/** A question as it is shown and published: one line, plain, single spaces. */
export function normaliseQuestion(value: string): string {
  return value.replace(/\s+/g, ' ').replace(UNSAFE_CHARS, '').replace(/ {2,}/g, ' ').trim();
}

/** Details as they are shown and published: plain text, line breaks kept. */
export function normaliseDetails(value: string): string {
  return normaliseCommentText(value);
}

export interface PollInput {
  question: string;
  details?: string | null;
  durationDays: number;
}

export function isDuration(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= DURATION_MIN_DAYS &&
    value <= DURATION_MAX_DAYS
  );
}

/** Problems with a poll someone is writing, in plain words (empty when it is fine). */
export function pollInputProblems(input: PollInput): string[] {
  const problems: string[] = [];
  const question = normaliseQuestion(input.question);
  if (question.length < QUESTION_MIN)
    problems.push(`Write a question of at least ${QUESTION_MIN} characters.`);
  if (question.length > QUESTION_MAX)
    problems.push(`Keep the question under ${QUESTION_MAX} characters.`);
  if (normaliseDetails(input.details ?? '').length > DETAILS_MAX)
    problems.push(`Keep the details under ${DETAILS_MAX.toLocaleString('en-US')} characters.`);
  if (!isDuration(input.durationDays))
    problems.push(`Pick a duration of ${DURATION_MIN_DAYS} to ${DURATION_MAX_DAYS} days.`);
  return problems;
}

// ---- the end of a poll --------------------------------------------------------------

export interface PollClock {
  /** The chain tip. */
  height: number;
  /** The tip block's timestamp (ms). */
  timestamp: number;
  /** The measured block time (ms). */
  msPerBlock: number;
}

/**
 * When a poll asked at `createdAt` for `durationDays` ends: whole blocks at
 * the measured block time (rounded up), so `endsAt` falls on a block's
 * estimated time, and that block's height estimated from the tip.
 */
export function pollEnd(
  clock: PollClock,
  durationDays: number,
  createdAt: number
): { endsAt: number; endHeight: number } {
  if (!isDuration(durationDays))
    throw new Error(`Pick a duration of ${DURATION_MIN_DAYS} to ${DURATION_MAX_DAYS} days.`);
  if (!(clock.msPerBlock > 0)) throw new Error('No block time to count with.');
  const blocks = Math.ceil((durationDays * DAY_MS) / clock.msPerBlock);
  const endsAt = Math.round(createdAt + blocks * clock.msPerBlock);
  const endHeight = clock.height + Math.round((endsAt - clock.timestamp) / clock.msPerBlock);
  return { endsAt, endHeight };
}

// ---- parsing (bodies read from QDN) ------------------------------------------------

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isName(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= NAME_MAX;
}

/** A list of addresses: every entry an address, 1–100 of them, each once. Null otherwise. */
export function parseReaders(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (!value.every(isAddress)) return null;
  const unique = [...new Set(value as string[])];
  return unique.length <= READERS_MAX ? unique : null;
}

/**
 * Validate a poll body. `pollId`, when given, must be its id (the identifier
 * it was read under, or the share that carries it). Null when it is not a
 * valid v1 poll.
 */
export function parsePoll(body: unknown, pollId?: string): PollRecord | null {
  if (!isObject(body) || body.v !== 1 || !isPollId(body.id)) return null;
  if (pollId !== undefined && body.id !== pollId) return null;
  if (typeof body.question !== 'string') return null;
  const question = normaliseQuestion(body.question);
  if (question.length < QUESTION_MIN || question.length > QUESTION_MAX) return null;
  let details: string | undefined;
  if (body.details !== undefined) {
    if (typeof body.details !== 'string') return null;
    const clean = normaliseDetails(body.details);
    if (clean.length > DETAILS_MAX) return null;
    details = clean || undefined;
  }
  if (!isDuration(body.durationDays)) return null;
  if (!isTime(body.createdAt) || !isTime(body.endsAt) || !isTime(body.endHeight)) return null;
  if (body.endsAt <= body.createdAt) return null;
  if (body.endsAt - body.createdAt > (body.durationDays + 1) * DAY_MS) return null;
  const readers = parseReaders(body.readers);
  if (!readers) return null;
  const record: PollRecord = {
    v: 1,
    id: body.id,
    question,
    durationDays: body.durationDays,
    createdAt: body.createdAt,
    endsAt: body.endsAt,
    endHeight: body.endHeight,
    readers,
  };
  if (details) record.details = details;
  return record;
}

/** Validate a poll body against the identifier it was read under. */
export function parsePollAt(body: unknown, identifier: string): PollRecord | null {
  const pollId = idOfKind(identifier, 'poll');
  return pollId ? parsePoll(body, pollId) : null;
}

export function isPollVote(value: unknown): value is PollVote {
  return value === 'yes' || value === 'no' || value === 'neutral';
}

/** Validate a vote body against its identifier. */
export function parseVote(body: unknown, identifier: string): VoteRecord | null {
  const pollId = idOfKind(identifier, 'vote');
  if (!pollId || !isObject(body) || body.v !== 1 || body.pollId !== pollId) return null;
  if (!isPollVote(body.vote)) return null;
  return { v: 1, pollId, vote: body.vote };
}

/** A reply's target: another comment on the same poll. */
function isReplyTarget(value: unknown, pollId: string, own?: string): value is string {
  if (typeof value !== 'string' || value === own) return false;
  const parsed = parsePollRecordIdentifier(value);
  return parsed?.kind === 'comment' && parsed.pollId === pollId;
}

/** The comment fields both a comment body and a share's copy carry; null when invalid. */
function commentFields(
  b: Record<string, unknown>,
  pollId: string,
  identifier: string
): Pick<PollCommentRecord, 'text' | 'replyTo' | 'edited' | 'deleted'> | null {
  if (b.deleted !== undefined && b.deleted !== true) return null;
  if (b.edited !== undefined && b.edited !== true) return null;
  let replyTo: string | undefined;
  if (b.replyTo !== undefined) {
    if (!isReplyTarget(b.replyTo, pollId, identifier)) return null;
    replyTo = b.replyTo;
  }
  const fields: Pick<PollCommentRecord, 'text' | 'replyTo' | 'edited' | 'deleted'> = { text: '' };
  if (replyTo) fields.replyTo = replyTo;
  if (b.deleted === true) {
    fields.deleted = true;
    return fields;
  }
  if (typeof b.text !== 'string') return null;
  const text = normaliseCommentText(b.text);
  if (!text || text.length > POLL_COMMENT_MAX) return null;
  fields.text = text;
  if (b.edited === true) fields.edited = true;
  return fields;
}

/** Validate a comment body against its identifier. */
export function parsePollComment(body: unknown, identifier: string): PollCommentRecord | null {
  const parsed = parsePollRecordIdentifier(identifier);
  if (!parsed || parsed.kind !== 'comment' || !isObject(body) || body.v !== 1) return null;
  if (body.pollId !== parsed.pollId) return null;
  const fields = commentFields(body, parsed.pollId, identifier);
  return fields ? { v: 1, pollId: parsed.pollId, ...fields } : null;
}

function parseShareVote(value: unknown): ShareVote | null {
  if (!isObject(value) || !isName(value.name) || !isPollVote(value.vote)) return null;
  if (!isTime(value.updated)) return null;
  return { name: value.name, vote: value.vote, updated: value.updated };
}

function parseShareComment(value: unknown, pollId: string): ShareComment | null {
  if (!isObject(value) || !isName(value.name) || typeof value.identifier !== 'string') return null;
  const parsed = parsePollRecordIdentifier(value.identifier);
  if (!parsed || parsed.kind !== 'comment' || parsed.pollId !== pollId) return null;
  if (!isTime(value.postedAt) || !isTime(value.updatedAt) || value.updatedAt < value.postedAt)
    return null;
  const fields = commentFields(value, pollId, value.identifier);
  if (!fields) return null;
  return {
    name: value.name,
    identifier: value.identifier,
    postedAt: value.postedAt,
    updatedAt: value.updatedAt,
    ...fields,
  };
}

/**
 * Validate a share body against its identifier. Its poll must be a valid
 * poll with the same id; malformed votes and comments in it are dropped
 * (each voter once, their newest), the lists capped.
 */
export function parseShare(body: unknown, identifier: string): ShareRecord | null {
  const pollId = idOfKind(identifier, 'share');
  if (!pollId || !isObject(body) || body.v !== 1 || body.pollId !== pollId) return null;
  const poll = parsePoll(body.poll, pollId);
  if (!poll || !isName(body.pollPublisher) || !isTime(body.sharedAt)) return null;
  const readers = parseReaders(body.readers);
  if (!readers) return null;
  if (!Array.isArray(body.votes) || !Array.isArray(body.comments)) return null;
  const votes = new Map<string, ShareVote>();
  for (const raw of body.votes.slice(0, SHARE_VOTES_MAX)) {
    const vote = parseShareVote(raw);
    const current = vote ? votes.get(vote.name) : undefined;
    if (vote && (!current || vote.updated > current.updated)) votes.set(vote.name, vote);
  }
  const comments = new Map<string, ShareComment>();
  for (const raw of body.comments.slice(0, SHARE_COMMENTS_MAX)) {
    const comment = parseShareComment(raw, pollId);
    const key = comment ? `${comment.name}\n${comment.identifier}` : '';
    const current = comments.get(key);
    if (comment && (!current || comment.updatedAt > current.updatedAt)) comments.set(key, comment);
  }
  return {
    v: 1,
    pollId,
    poll,
    pollPublisher: body.pollPublisher,
    votes: [...votes.values()],
    comments: [...comments.values()],
    readers,
    sharedAt: body.sharedAt,
  };
}

// ---- building (records to publish) ---------------------------------------------------

export interface PollBuildInput extends PollInput {
  id: string;
  createdAt: number;
  endsAt: number;
  endHeight: number;
  readers: string[];
}

/** The poll to publish. Throws when the input has problems. */
export function buildPoll(input: PollBuildInput): PollRecord {
  const problems = pollInputProblems(input);
  if (problems.length) throw new Error(problems.join(' '));
  const record: PollRecord = {
    v: 1,
    id: input.id,
    question: normaliseQuestion(input.question),
    durationDays: input.durationDays,
    createdAt: input.createdAt,
    endsAt: input.endsAt,
    endHeight: input.endHeight,
    readers: [...new Set(input.readers)],
  };
  const details = normaliseDetails(input.details ?? '');
  if (details) record.details = details;
  // The same checks a reader makes, so nothing goes out that readers would drop.
  if (!parsePoll(record, input.id)) throw new Error('This poll isn’t complete. Try again.');
  return record;
}

export function buildVote(pollId: string, vote: PollVote): VoteRecord {
  requirePollId(pollId);
  if (!isPollVote(vote)) throw new Error('A vote is Yes, No or Neutral.');
  return { v: 1, pollId, vote };
}

export interface PollCommentInput {
  pollId: string;
  text: string;
  /** The identifier of the comment this one answers. */
  replyTo?: string | null;
  /** True when it replaces an earlier version. */
  edited?: boolean;
}

/** The comment to publish. Throws when the input has problems. */
export function buildPollComment(input: PollCommentInput): PollCommentRecord {
  requirePollId(input.pollId);
  const problems = commentTextProblems(input.text);
  if (problems.length) throw new Error(problems.join(' '));
  const record: PollCommentRecord = {
    v: 1,
    pollId: input.pollId,
    text: normaliseCommentText(input.text),
  };
  if (input.replyTo) {
    if (!isReplyTarget(input.replyTo, input.pollId))
      throw new Error('That reply has nothing to answer.');
    record.replyTo = input.replyTo;
  }
  if (input.edited) record.edited = true;
  return record;
}

/** What a deleted comment is republished as: its place and its replies stay. */
export function buildDeletedPollComment(input: {
  pollId: string;
  replyTo?: string | null;
}): PollCommentRecord {
  requirePollId(input.pollId);
  const record: PollCommentRecord = { v: 1, pollId: input.pollId, text: '', deleted: true };
  if (input.replyTo && isReplyTarget(input.replyTo, input.pollId)) record.replyTo = input.replyTo;
  return record;
}

export interface ShareBuildInput {
  poll: PollRecord;
  pollPublisher: string;
  votes: ShareVote[];
  comments: ShareComment[];
  readers: string[];
  sharedAt: number;
}

/** The copy to share. Throws when it isn't one a reader would accept. */
export function buildShare(input: ShareBuildInput): ShareRecord {
  const record: ShareRecord = {
    v: 1,
    pollId: input.poll.id,
    poll: input.poll,
    pollPublisher: input.pollPublisher,
    votes: input.votes.slice(0, SHARE_VOTES_MAX),
    comments: [...input.comments]
      .sort((a, b) => b.postedAt - a.postedAt)
      .slice(0, SHARE_COMMENTS_MAX),
    readers: [...new Set(input.readers)],
    sharedAt: input.sharedAt,
  };
  if (!parseShare(record, shareIdentifier(input.poll.id)))
    throw new Error('This copy isn’t complete. Try again.');
  return record;
}

// ---- encoding ---------------------------------------------------------------------

/** UTF-8 JSON from base64 (what DECRYPT_DATA gives back). Throws on anything else. */
export function fromData64(data64: string): unknown {
  const binary = atob(data64.trim());
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
