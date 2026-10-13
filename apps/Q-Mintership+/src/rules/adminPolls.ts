/**
 * Minter Admin polls, pure (data/adminPolls.ts reads and decrypts, the
 * Decisions screens show). Advisory only: nothing here changes anything on
 * chain, and a result has no pass or fail.
 *
 * - **Trust:** a record counts only when the name it was published under
 *   belongs to a current Minter Admin who can sign (MINTER's null owner left
 *   out), checked at the time of reading. The publisher always comes from
 *   the QDN row, never from a body. A share's copy is taken as that admin's
 *   copy: its asker, voters and commenters must be current admins too.
 * - **The poll:** per id, the earliest poll row from a current admin (a
 *   later one with the same id under another name is not this poll). Its
 *   own body when the viewer can read it; otherwise the newest share's copy,
 *   shown as "Shared by <name>". Bodies that can't be decrypted are skipped.
 * - **Votes:** Yes, No or Neutral. Per voter name, the latest version counts
 *   only if it was published by the poll's end (the QDN row's updated time,
 *   else created); per admin, the latest that counts. Votes the viewer can't
 *   read come from shares; a vote the viewer can read wins a tie.
 * - **Readers:** the poll's and every share's; current admins outside them
 *   can be shared with ("Share with N Minter Admins added since").
 * - **Lists:** open polls first (soonest end first), then those that ended
 *   in the last 31 days (latest first).
 */
import {
  DAY_MS,
  POLL_VOTES,
  parsePollAt,
  parsePollComment,
  parsePollRecordIdentifier,
  parseShare,
  parseVote,
  type PollCommentRecord,
  type PollRecord,
  type PollVote,
  type ShareComment,
  type ShareRecord,
} from '../data/adminPollRecords';
import type { CommentRecord } from '../data/commentRecords';
import type { CommentBody, CommentRow } from '../data/commentThread';

/** Allowance for clocks between the app that wrote a body and the node that took it. */
export const CLOCK_SLACK_MS = 10 * 60_000;
/** Closed polls stay listed this long after they end. */
export const CLOSED_SHOWN_MS = 31 * DAY_MS;
/**
 * How far back the searches reach: a poll that ended 31 days ago was asked at
 * most 30 days (and a day of slack) before that.
 */
export const SEARCH_LOOKBACK_MS = (31 + 31) * DAY_MS;

/** A QDN search row, as these rules need it. */
export interface PollRow {
  name: string;
  identifier: string;
  created: number;
  updated?: number;
  latestSignature?: string;
}

/** A body as the loader got it: decrypted JSON, or why not. */
export type BodyRead =
  | { status: 'ok'; value: unknown }
  /** Not encrypted to the viewer (or not decryptable): skipped quietly. */
  | { status: 'locked' }
  /** Not on the node yet, or the read was too slow this time. */
  | { status: 'unavailable' }
  /** Deleted, or not what it should be. */
  | { status: 'invalid' };

export interface ReadRow {
  row: PollRow;
  body: BodyRead;
}

/** Everything read about one poll id. Rows not read (yet) are left out of the read lists. */
export interface PollSources {
  pollId: string;
  polls: ReadRow[];
  votes: ReadRow[];
  shares: ReadRow[];
  /** Comment rows: their bodies are read when the thread opens. */
  comments: PollRow[];
}

export interface PollContext {
  now: number;
  /** Current Minter Admins who can sign (null owner left out), in Core's order. */
  signers: readonly string[];
  /** The owner of a name, as the loader resolved it (null: unknown or no owner). */
  publisherOf: (name: string) => string | null;
  /** The signed-in admin. */
  viewer: string;
}

export interface Publisher {
  name: string;
  address: string;
}

export interface CountedVote extends Publisher {
  vote: PollVote;
  /** When this version was published (the QDN row's updated time, else created). */
  at: number;
  /** Read by the viewer, or taken from a share. */
  via: 'direct' | 'share';
}

export interface PollShareInfo extends Publisher {
  sharedAt: number;
  readers: string[];
  /** The share row's newest time. */
  at: number;
}

export interface ShareCommentCopy extends ShareComment {
  /** The admin whose share carried it. */
  sharedBy: string;
}

export interface AdminPollView {
  id: string;
  poll: PollRecord;
  /** Who asked: the poll row's name (or the share's word for it), a current Minter Admin. */
  publisher: Publisher;
  /** When it was published (its row's first time, or the copy's createdAt). */
  postedAt: number;
  /** Shown from a share: the viewer can't read the poll itself. */
  sharedBy: Publisher | null;
  shares: PollShareInfo[];
  open: boolean;
  /** The votes that count: one per admin. */
  votes: CountedVote[];
  /** Latest versions published after the end: not counted. */
  late: CountedVote[];
  counts: Record<PollVote, number>;
  myVote: CountedVote | null;
  /** Everyone it (or a share of it) was encrypted to. */
  readers: string[];
  /** Current Minter Admins none of those copies were encrypted to. */
  missing: string[];
  /** Its comments' rows from current Minter Admins, newest first. */
  commentRows: CommentRow[];
  /** Comments as shares carried them (for the ones the viewer can't read). */
  shareComments: ShareCommentCopy[];
}

/** The newest time of a row. */
export function pollRowTime(row: Pick<PollRow, 'created' | 'updated'>): number {
  return row.updated ?? row.created;
}

/** The current Minter Admin a name belongs to, or null. */
export function trustedName(
  name: string,
  ctx: Pick<PollContext, 'signers' | 'publisherOf'>
): string | null {
  const address = ctx.publisherOf(name);
  return address && ctx.signers.includes(address) ? address : null;
}

function trusted(row: PollRow, ctx: PollContext): Publisher | null {
  const address = trustedName(row.name, ctx);
  return address ? { name: row.name, address } : null;
}

/** Group search rows by poll id (each list keeps only identifiers of its own kind). */
export function groupPollRows(rows: {
  polls: readonly PollRow[];
  votes: readonly PollRow[];
  shares: readonly PollRow[];
  comments: readonly PollRow[];
}): Map<string, { polls: PollRow[]; votes: PollRow[]; shares: PollRow[]; comments: PollRow[] }> {
  const groups = new Map<
    string,
    { polls: PollRow[]; votes: PollRow[]; shares: PollRow[]; comments: PollRow[] }
  >();
  const add = (list: readonly PollRow[], kind: 'poll' | 'vote' | 'share' | 'comment') => {
    for (const row of list) {
      const parsed = parsePollRecordIdentifier(row.identifier);
      if (!parsed || parsed.kind !== kind || typeof row.name !== 'string' || !row.name) continue;
      let group = groups.get(parsed.pollId);
      if (!group) {
        group = { polls: [], votes: [], shares: [], comments: [] };
        groups.set(parsed.pollId, group);
      }
      const key =
        kind === 'poll'
          ? 'polls'
          : kind === 'vote'
            ? 'votes'
            : kind === 'share'
              ? 'shares'
              : 'comments';
      group[key].push(row);
    }
  };
  add(rows.polls, 'poll');
  add(rows.votes, 'vote');
  add(rows.shares, 'share');
  add(rows.comments, 'comment');
  return groups;
}

/** A poll body fits its own row: asked when the row says (a day earlier at most). */
export function askedInTime(poll: Pick<PollRecord, 'createdAt'>, rowCreated: number): boolean {
  return poll.createdAt <= rowCreated + CLOCK_SLACK_MS && poll.createdAt >= rowCreated - DAY_MS;
}

/** A share's copy fits its share: asked before it was shared. */
export function copiedInTime(poll: Pick<PollRecord, 'createdAt'>, shareCreated: number): boolean {
  return poll.createdAt <= shareCreated + CLOCK_SLACK_MS;
}

/** The poll row that counts for an id: the earliest one from a current Minter Admin. */
export function pollRowFor(
  src: Pick<PollSources, 'polls'>,
  ctx: PollContext
): (ReadRow & { publisher: Publisher }) | null {
  let best: (ReadRow & { publisher: Publisher }) | null = null;
  for (const read of src.polls) {
    const publisher = trusted(read.row, ctx);
    if (!publisher) continue;
    if (
      !best ||
      read.row.created < best.row.created ||
      (read.row.created === best.row.created && read.row.name < best.row.name)
    )
      best = { ...read, publisher };
  }
  return best;
}

/** The poll's own body, when the viewer could read it and it is valid. */
function directPoll(src: PollSources, ctx: PollContext): PollRecord | null {
  const row = pollRowFor(src, ctx);
  if (!row || row.body.status !== 'ok') return null;
  const poll = parsePollAt(row.body.value, row.row.identifier);
  return poll && askedInTime(poll, row.row.created) ? poll : null;
}

export interface ValidShare {
  publisher: Publisher;
  row: PollRow;
  record: ShareRecord;
}

/**
 * The shares that count, newest first: from a current Minter Admin, readable
 * and valid, about a poll whose asker is a current admin and, when the poll's
 * own row is known, the same name.
 */
export function validShares(src: PollSources, ctx: PollContext): ValidShare[] {
  const pollRow = pollRowFor(src, ctx);
  const shares: ValidShare[] = [];
  for (const read of src.shares) {
    const publisher = trusted(read.row, ctx);
    if (!publisher || read.body.status !== 'ok') continue;
    const record = parseShare(read.body.value, read.row.identifier);
    if (!record || record.pollId !== src.pollId) continue;
    if (!trustedName(record.pollPublisher, ctx)) continue;
    if (pollRow && record.pollPublisher !== pollRow.row.name) continue;
    if (!copiedInTime(record.poll, read.row.created)) continue;
    shares.push({ publisher, row: read.row, record });
  }
  return shares.sort(
    (a, b) => pollRowTime(b.row) - pollRowTime(a.row) || (a.row.name < b.row.name ? -1 : 1)
  );
}

/** Where a poll comes from: its own body, or the newest share's copy. Null when neither counts. */
export function resolvePoll(
  src: PollSources,
  ctx: PollContext,
  shares: ValidShare[] = validShares(src, ctx)
): {
  poll: PollRecord;
  publisher: Publisher;
  postedAt: number;
  sharedBy: Publisher | null;
} | null {
  const pollRow = pollRowFor(src, ctx);
  const direct = directPoll(src, ctx);
  if (direct && pollRow)
    return {
      poll: direct,
      publisher: pollRow.publisher,
      postedAt: pollRow.row.created,
      sharedBy: null,
    };
  const newest = shares[0];
  if (!newest) return null;
  const askedBy = trustedName(newest.record.pollPublisher, ctx) as string;
  return {
    poll: newest.record.poll,
    publisher: { name: newest.record.pollPublisher, address: askedBy },
    postedAt: pollRow?.row.created ?? newest.record.poll.createdAt,
    sharedBy: newest.publisher,
  };
}

/** Every vote known for a poll: read directly, or carried by a share (from current admins only). */
export function voteEntries(
  src: PollSources,
  ctx: PollContext,
  shares: ValidShare[] = validShares(src, ctx)
): CountedVote[] {
  const entries: CountedVote[] = [];
  for (const read of src.votes) {
    const publisher = trusted(read.row, ctx);
    if (!publisher || read.body.status !== 'ok') continue;
    const record = parseVote(read.body.value, read.row.identifier);
    if (!record || record.pollId !== src.pollId) continue;
    entries.push({ ...publisher, vote: record.vote, at: pollRowTime(read.row), via: 'direct' });
  }
  for (const share of shares) {
    for (const vote of share.record.votes) {
      const address = trustedName(vote.name, ctx);
      if (!address) continue;
      entries.push({ name: vote.name, address, vote: vote.vote, at: vote.updated, via: 'share' });
    }
  }
  return entries;
}

function newer(a: CountedVote, b: CountedVote): boolean {
  if (a.at !== b.at) return a.at > b.at;
  if (a.via !== b.via) return a.via === 'direct';
  return a.name < b.name;
}

/**
 * The votes that count: per voter name its latest version, which counts only
 * if it was published by `endsAt`; per admin, the latest of those. Returns
 * them oldest first, and the latest versions that came too late.
 */
export function countVotes(
  entries: readonly CountedVote[],
  endsAt: number
): { counted: CountedVote[]; late: CountedVote[] } {
  const byName = new Map<string, CountedVote>();
  for (const entry of entries) {
    const current = byName.get(entry.name);
    if (!current || newer(entry, current)) byName.set(entry.name, entry);
  }
  const late: CountedVote[] = [];
  const byAdmin = new Map<string, CountedVote>();
  for (const entry of byName.values()) {
    if (entry.at > endsAt) {
      late.push(entry);
      continue;
    }
    const current = byAdmin.get(entry.address);
    if (!current || newer(entry, current)) byAdmin.set(entry.address, entry);
  }
  const order = (a: CountedVote, b: CountedVote) => a.at - b.at || (a.name < b.name ? -1 : 1);
  return { counted: [...byAdmin.values()].sort(order), late: late.sort(order) };
}

/** Yes / No / Neutral counts. */
export function tallyVotes(votes: readonly Pick<CountedVote, 'vote'>[]): Record<PollVote, number> {
  const counts = Object.fromEntries(POLL_VOTES.map((v) => [v, 0])) as Record<PollVote, number>;
  for (const v of votes) counts[v.vote] += 1;
  return counts;
}

/** Everyone a poll and its shares were encrypted to. */
export function pollReaders(poll: Pick<PollRecord, 'readers'>, shares: readonly ValidShare[]) {
  const all = new Set(poll.readers);
  for (const share of shares) for (const address of share.record.readers) all.add(address);
  return [...all];
}

/** Current signers outside `readers`, in the signers' order. */
export function missingReaders(signers: readonly string[], readers: readonly string[]): string[] {
  const covered = new Set(readers);
  return signers.filter((address) => !covered.has(address));
}

/** A poll's comment rows from current Minter Admins, each once (its newest), newest first. */
export function pollCommentRows(
  pollId: string,
  rows: readonly PollRow[],
  ctx: PollContext
): CommentRow[] {
  const byRef = new Map<string, CommentRow>();
  for (const row of rows) {
    const parsed = parsePollRecordIdentifier(row.identifier);
    if (!parsed || parsed.kind !== 'comment' || parsed.pollId !== pollId) continue;
    if (!trusted(row, ctx)) continue;
    const ref = `${row.name}\n${row.identifier}`;
    const updatedAt = pollRowTime(row);
    const existing = byRef.get(ref);
    if (existing && existing.updatedAt >= updatedAt) continue;
    byRef.set(ref, {
      ref,
      name: row.name,
      identifier: row.identifier,
      key: pollId,
      postedAt: row.created,
      updatedAt,
      version: updatedAt,
    });
  }
  return [...byRef.values()].sort(
    (a, b) => b.postedAt - a.postedAt || (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0)
  );
}

/** Comments carried by shares, from current Minter Admins, each once (the newest copy). */
export function shareCommentCopies(shares: readonly ValidShare[], ctx: PollContext) {
  const byRef = new Map<string, ShareCommentCopy>();
  for (const share of shares) {
    for (const comment of share.record.comments) {
      if (!trustedName(comment.name, ctx)) continue;
      const ref = `${comment.name}\n${comment.identifier}`;
      const current = byRef.get(ref);
      if (!current || comment.updatedAt > current.updatedAt)
        byRef.set(ref, { ...comment, sharedBy: share.publisher.name });
    }
  }
  return [...byRef.values()];
}

/** One poll as the viewer sees it, or null when nothing about it counts. */
export function assemblePoll(src: PollSources, ctx: PollContext): AdminPollView | null {
  const shares = validShares(src, ctx);
  const resolved = resolvePoll(src, ctx, shares);
  if (!resolved) return null;
  const { poll } = resolved;
  const { counted, late } = countVotes(voteEntries(src, ctx, shares), poll.endsAt);
  const readers = pollReaders(poll, shares);
  return {
    id: src.pollId,
    poll,
    publisher: resolved.publisher,
    postedAt: resolved.postedAt,
    sharedBy: resolved.sharedBy,
    shares: shares.map((s) => ({
      ...s.publisher,
      sharedAt: s.record.sharedAt,
      readers: s.record.readers,
      at: pollRowTime(s.row),
    })),
    open: isPollOpen(poll, ctx.now),
    votes: counted,
    late,
    counts: tallyVotes(counted),
    myVote: counted.find((v) => v.address === ctx.viewer) ?? null,
    readers,
    missing: missingReaders(ctx.signers, readers),
    commentRows: pollCommentRows(src.pollId, src.comments, ctx),
    shareComments: shareCommentCopies(shares, ctx),
  };
}

/** Voting is open until the end. */
export function isPollOpen(poll: Pick<PollRecord, 'endsAt'>, now: number): boolean {
  return now < poll.endsAt;
}

/** Listed: open, or ended in the last 31 days. */
export function isPollShown(poll: Pick<PollRecord, 'endsAt'>, now: number): boolean {
  return isPollOpen(poll, now) || now - poll.endsAt <= CLOSED_SHOWN_MS;
}

/** Open polls first, the soonest end first; then closed ones, the latest end first. */
export function sortPolls<
  T extends { poll: Pick<PollRecord, 'endsAt'>; open: boolean; id: string },
>(views: readonly T[]): T[] {
  return [...views].sort((a, b) => {
    if (a.open !== b.open) return a.open ? -1 : 1;
    const byEnd = a.open ? a.poll.endsAt - b.poll.endsAt : b.poll.endsAt - a.poll.endsAt;
    return byEnd || (a.id < b.id ? -1 : 1);
  });
}

/** Every listed poll, in order. */
export function assemblePolls(sources: readonly PollSources[], ctx: PollContext): AdminPollView[] {
  const views: AdminPollView[] = [];
  for (const src of sources) {
    const view = assemblePoll(src, ctx);
    if (view && isPollShown(view.poll, ctx.now)) views.push(view);
  }
  return sortPolls(views);
}

/**
 * Whether the loader should read this poll's shares: the viewer can't read
 * the poll itself, its readers leave out a current admin (to know whether a
 * share already covers them), or a vote from a current admin couldn't be read.
 */
export function needsShareRead(src: PollSources, ctx: PollContext): boolean {
  if (!src.shares.some((read) => trusted(read.row, ctx))) return false;
  const poll = directPoll(src, ctx);
  if (!poll) return true;
  if (missingReaders(ctx.signers, poll.readers).length) return true;
  return src.votes.some((read) => trusted(read.row, ctx) && read.body.status !== 'ok');
}

/** Open polls the viewer hasn't voted on (and isn't voting on from this device right now). */
export function pollsWaitingForVote(
  views: readonly AdminPollView[],
  voting: ReadonlySet<string> = new Set()
): AdminPollView[] {
  return views.filter((v) => v.open && !v.myVote && !voting.has(v.id));
}

// ---- a poll's comment thread -------------------------------------------------------

/** A poll comment (or a share's copy) in the shape the public comment thread shows. */
export function toCommentRecord(
  pollId: string,
  comment: Pick<PollCommentRecord, 'text' | 'replyTo' | 'edited' | 'deleted'>
): CommentRecord {
  const record: CommentRecord = { v: 1, key: pollId, text: comment.deleted ? '' : comment.text };
  if (comment.replyTo) record.replyTo = comment.replyTo;
  if (comment.deleted) record.deleted = true;
  else if (comment.edited) record.edited = true;
  return record;
}

/**
 * The rows and bodies a poll's thread shows (data/commentThread.ts
 * buildThreads): each comment the viewer read, or the newest copy a share
 * carried when that is newer or the viewer can't read it. One the viewer
 * can't read and no share carries is left out. Rows not read yet stay
 * without a body (and aren't shown) unless a share carried them.
 */
export function pollThreadSources(input: {
  pollId: string;
  rows: readonly CommentRow[];
  bodies: ReadonlyMap<string, BodyRead & { fetching?: boolean }>;
  copies: readonly ShareCommentCopy[];
}): { rows: CommentRow[]; bodies: Map<string, CommentBody> } {
  const copies = new Map(input.copies.map((c) => [`${c.name}\n${c.identifier}`, c]));
  const rows: CommentRow[] = [];
  const bodies = new Map<string, CommentBody>();
  const fromCopy = (copy: ShareCommentCopy): CommentBody => ({
    status: 'ok',
    record: toCommentRecord(input.pollId, copy),
  });
  const listed = new Set<string>();
  for (const row of input.rows) {
    listed.add(row.ref);
    const copy = copies.get(row.ref);
    const body = input.bodies.get(row.ref);
    let shown: CommentBody | null = null;
    if (body?.status === 'ok') {
      const record = parsePollComment(body.value, row.identifier);
      if (record && record.pollId === input.pollId) {
        shown =
          copy && copy.updatedAt > row.updatedAt
            ? fromCopy(copy)
            : { status: 'ok', record: toCommentRecord(input.pollId, record) };
      } else shown = copy ? fromCopy(copy) : { status: 'invalid' };
    } else if (copy) shown = fromCopy(copy);
    else if (body?.status === 'unavailable')
      shown = { status: 'unavailable', fetching: Boolean(body.fetching) };
    else if (body) shown = { status: 'invalid' };
    rows.push(row);
    if (shown) bodies.set(row.ref, shown);
  }
  for (const [ref, copy] of copies) {
    if (listed.has(ref)) continue;
    rows.push({
      ref,
      name: copy.name,
      identifier: copy.identifier,
      key: input.pollId,
      postedAt: copy.postedAt,
      updatedAt: copy.updatedAt,
      version: `share:${copy.updatedAt}`,
    });
    bodies.set(ref, fromCopy(copy));
  }
  rows.sort((a, b) => b.postedAt - a.postedAt || (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));
  return { rows, bodies };
}
