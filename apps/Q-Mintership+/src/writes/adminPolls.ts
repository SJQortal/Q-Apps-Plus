/**
 * Minter Admin poll writes (docs/apps/Q-Mintership+.md → Data contract):
 * ask, vote (republished to change it), comment (edit, delete) and share
 * with Minter Admins added since. Each is one PUBLISH_QDN_RESOURCE through
 * Hub, service DOCUMENT_PRIVATE, encrypted to every current Minter Admin who
 * can sign plus the writer (0.01 QORT), which the screens explain first in
 * a HubStepDialog. Advisory only: nothing on chain follows from a poll.
 *
 * Before Hub opens: the writer is still a Minter Admin (read fresh), has a
 * registered name of their own, the poll is one they can read and, for a
 * vote, still open for more than a few minutes by the later of the device's
 * clock and the chain tip's time; the runner checks the fee against the confirmed balance
 * and Core's 25-unconfirmed limit. The admins' public keys are read fresh
 * (each key once per session). Once Hub sends it, the write shows at once
 * (state/adminPolls.ts). These are the flows the testnet calls too
 * (writes/flows.ts re-exports them).
 */
import { getNameOwner } from '../data/accounts';
import {
  buildDeletedPollComment,
  buildPoll,
  buildPollComment,
  buildShare,
  buildVote,
  isPollVote,
  pollAnswers,
  type PollAnswer,
  parsePollRecordIdentifier,
  pollCommentIdentifier,
  pollEnd,
  pollIdentifier,
  pollInputProblems,
  randomPollId,
  shareIdentifier,
  voteIdentifier,
  type PollCommentRecord,
  type PollInput,
  type PollRecord,
  type PollVote,
  type ShareComment,
  type ShareRecord,
  type ShareVote,
  type VoteRecord,
} from '../data/adminPollRecords';
import {
  adminPollsKey,
  encryptionTargets,
  loadAdminPolls,
  pollContext,
  readPollBody,
  type EncryptionTargets,
} from '../data/adminPolls';
import { getChainNow } from '../data/chain';
import { mapLimit } from '../data/qdn';
import { invalidate } from '../data/query';
import {
  VOTE_CUTOFF_MS,
  assemblePoll,
  chainBoundNow,
  needsShareRead,
  pollRowTime,
  pollThreadSources,
  trustedName,
  voteTooLate,
  type AdminPollView,
  type BodyRead,
  type PollContext,
  type PollSources,
} from '../rules/adminPolls';
import {
  setPendingPoll,
  setPendingPollComment,
  setPendingShare,
  setPendingVote,
} from '../state/adminPolls';
import { errorMessage } from '../utils/hubErrors';
import { isMinterAdmin } from './guards';
import { publishEncryptedRequest } from './hubActions';
import { runWrite, type Signer, type WriteOutcome, type WriteStage } from './runner';

/** A Minter Admin and the registered name they publish under. */
export interface PollAuthor extends Signer {
  name: string | null;
}

export interface PollWrite {
  outcome: WriteOutcome;
  /** The record's identifier; empty when it never got that far. */
  identifier: string;
}

const blocked = (reason: string): WriteOutcome => ({ status: 'blocked', reason });

/** Before any poll write: a signed-in Minter Admin (read fresh) with a registered name of their own. */
export async function guardPollAuthor(
  author: PollAuthor,
  name: string | null = author.name
): Promise<string | null> {
  if (!author.address || !author.publicKey) return 'Sign in to Hub first.';
  if (!(await isMinterAdmin(author.address)))
    return 'Only Minter Admins can take part in Minter Admin polls.';
  if (!name)
    return 'Minter Admin polls are published under your registered name, and your account has none yet.';
  const owner = await getNameOwner(name);
  if (owner !== author.address) return `The name ${name} belongs to another account.`;
  return null;
}

/** Voting ends at the poll's end: a vote published later doesn't count. */
export function guardPollOpen(poll: Pick<PollRecord, 'endsAt'>, now = Date.now()): string | null {
  return now < poll.endsAt ? null : 'This poll has ended: a vote can’t count any more.';
}

/**
 * Before a vote: the poll is open, and not about to close, by the later of
 * the device's clock and the chain tip's time (`tipTimestamp`).
 */
export function guardVoteInTime(
  poll: Pick<PollRecord, 'endsAt'>,
  tipTimestamp: number,
  deviceNow = Date.now()
): string | null {
  const now = Math.max(deviceNow, tipTimestamp);
  const late = voteTooLate(poll, now);
  if (late === 'ended') return guardPollOpen(poll, now);
  if (late === 'closing')
    return `This poll ends in under ${VOTE_CUTOFF_MS / 60_000} minutes: a vote published now could arrive after the end, and wouldn’t count.`;
  return null;
}

/** The newest time of the author's own vote on this poll, as the view has it (0: none). */
function ownVoteAt(view: AdminPollView, address: string): number {
  let at = 0;
  for (const v of [...view.votes, ...view.late, ...view.unread])
    if (v.address === address) at = Math.max(at, v.at);
  return at;
}

/** A poll as the author reads it (the shared list read; `force`: read fresh), and what it came from. */
async function readPoll(
  author: Signer,
  pollId: string,
  options: { force?: boolean } = {}
): Promise<{ view: AdminPollView; src: PollSources; ctx: PollContext } | null> {
  const data = await loadAdminPolls(author.address, options);
  const src = data.sources.find((s) => s.pollId === pollId);
  if (!src) return null;
  const ctx = pollContext(data);
  const view = assemblePoll(src, ctx);
  return view ? { view, src, ctx } : null;
}

/** A poll as the author reads it now (the shared list read), or null. */
export async function findPoll(author: Signer, pollId: string): Promise<AdminPollView | null> {
  return (await readPoll(author, pollId))?.view ?? null;
}

const INCOMPLETE_COPY =
  'Some of its votes or comments haven’t reached your node yet, so the copy would leave them out. Try again in a minute.';

/** A share this recent that the author can't read yet may be one made a moment ago. */
const RECENT_SHARE_MS = 60 * 60_000;

const NOT_READABLE = 'This poll isn’t among the Minter Admin polls you can read.';

/** The reads a poll write changes: the list, and the balance that paid for it. */
function invalidatePollReads(author: Signer): void {
  invalidate(adminPollsKey(author.address));
  invalidate(`balance:${author.address}`);
}

/**
 * The common path: check, read who to encrypt to, build the record, then
 * one PUBLISH_QDN_RESOURCE (encrypt: true) through the runner.
 */
async function publishEncrypted<
  R extends PollRecord | VoteRecord | PollCommentRecord | ShareRecord,
>(spec: {
  author: PollAuthor;
  /** The name it goes under (an edit keeps its comment's). */
  name?: string;
  identifier: string;
  guard?: () => Promise<string | null> | string | null;
  build: (targets: EncryptionTargets) => Promise<R> | R;
  onStage?: (stage: WriteStage) => void;
}): Promise<{ outcome: WriteOutcome; record: R | null; targets: EncryptionTargets | null }> {
  const { author, identifier, onStage } = spec;
  const name = spec.name ?? author.name;
  onStage?.('checking');
  let targets: EncryptionTargets;
  let record: R;
  try {
    const problem =
      (await guardPollAuthor(author, name)) ?? (spec.guard ? await spec.guard() : null);
    if (problem) return { outcome: blocked(problem), record: null, targets: null };
  } catch (error) {
    return {
      outcome: {
        status: 'failed',
        message: errorMessage(error, 'Could not check the current state. Try again.'),
      },
      record: null,
      targets: null,
    };
  }
  try {
    // The guard has just read the admins fresh: the same list.
    targets = await encryptionTargets(author, { force: false });
  } catch {
    return {
      outcome: {
        status: 'failed',
        message:
          'Couldn’t read the Minter Admins’ public keys on your node. Try again in a moment.',
      },
      record: null,
      targets: null,
    };
  }
  try {
    record = await spec.build(targets);
  } catch (error) {
    return {
      outcome: blocked(error instanceof Error ? error.message : String(error)),
      record: null,
      targets,
    };
  }
  const outcome = await runWrite({
    request: publishEncryptedRequest(name as string, identifier, record, targets.publicKeys),
    signer: author,
    match: (tx) => tx.type === 'ARBITRARY' && tx.identifier === identifier,
    onStage,
  });
  if (outcome.status === 'sent' || outcome.status === 'unknown') invalidatePollReads(author);
  return { outcome, record, targets };
}

export interface AskInput {
  question: string;
  details?: string | null;
  durationDays: number;
  /** Its answers (Yes, No and Neutral when left out). */
  answers?: readonly PollAnswer[] | null;
}

/**
 * Ask the Minter Admins: a new poll, encrypted to every current Minter
 * Admin who can sign. Its end comes from the measured block time.
 */
export async function publishAdminPoll(
  author: PollAuthor,
  input: AskInput,
  onStage?: (stage: WriteStage) => void
): Promise<PollWrite & { pollId: string; poll: PollRecord | null }> {
  const problems = pollInputProblems(input as PollInput);
  const pollId = randomPollId();
  const identifier = pollIdentifier(pollId);
  if (problems.length)
    return { outcome: blocked(problems.join(' ')), identifier: '', pollId, poll: null };
  const { outcome, record } = await publishEncrypted({
    author,
    identifier,
    build: async (targets) => {
      const clock = await getChainNow({ force: true });
      // Readers check it against the poll row's time, which the node sets.
      const createdAt = chainBoundNow(clock.timestamp);
      const end = pollEnd(clock, input.durationDays, createdAt);
      return buildPoll({ ...input, id: pollId, createdAt, ...end, readers: targets.readers });
    },
    onStage,
  });
  const poll = record as PollRecord | null;
  if (outcome.status === 'sent' && poll && author.name)
    setPendingPoll(pollId, {
      poll,
      publisher: { name: author.name, address: author.address },
      status: 'confirming',
      at: Date.now(),
    });
  return { outcome, identifier, pollId, poll };
}

/**
 * Vote one of the poll's answers (Yes, No or Neutral unless it gives its
 * own; republishing the same identifier changes it: only the latest vote
 * counts, if it is published by the poll's end).
 */
export async function voteAdminPoll(
  author: PollAuthor,
  pollId: string,
  vote: PollVote,
  onStage?: (stage: WriteStage) => void
): Promise<PollWrite> {
  if (!isPollVote(vote))
    return { outcome: blocked('A vote is one of the poll’s answers.'), identifier: '' };
  let identifier: string;
  try {
    identifier = voteIdentifier(pollId);
  } catch (error) {
    return { outcome: blocked((error as Error).message), identifier: '' };
  }
  setPendingVote(pollId, { vote, status: 'sending', at: Date.now() });
  // The author's vote QDN showed before this one: this one settles once a newer one shows.
  let after = 0;
  const { outcome } = await publishEncrypted({
    author,
    identifier,
    guard: async () => {
      const view = await findPoll(author, pollId);
      if (!view) return NOT_READABLE;
      if (!pollAnswers(view.poll).some((a) => a.id === vote))
        return 'That isn’t one of this poll’s answers.';
      after = ownVoteAt(view, author.address);
      const tip = await getChainNow({ force: true });
      return guardVoteInTime(view.poll, tip.timestamp);
    },
    build: () => buildVote(pollId, vote),
    onStage,
  });
  if (outcome.status === 'sent')
    setPendingVote(pollId, { vote, status: 'confirming', at: Date.now(), after });
  else if (outcome.status === 'unknown')
    setPendingVote(pollId, { vote, status: 'failed', at: Date.now(), message: outcome.message });
  else setPendingVote(pollId, null);
  return { outcome, identifier };
}

function markComment(name: string, identifier: string, record: PollCommentRecord): void {
  const ref = `${name}\n${identifier}`;
  setPendingPollComment(ref, {
    ref,
    name,
    identifier,
    pollId: record.pollId,
    record,
    at: Date.now(),
  });
}

/** Comment on a poll (a reply when `replyTo` names another comment on it). */
export async function commentAdminPoll(
  author: PollAuthor,
  pollId: string,
  input: { text: string; replyTo?: string | null },
  onStage?: (stage: WriteStage) => void
): Promise<PollWrite> {
  let identifier: string;
  let record: PollCommentRecord;
  try {
    record = buildPollComment({ pollId, text: input.text, replyTo: input.replyTo });
    identifier = pollCommentIdentifier(pollId);
  } catch (error) {
    return { outcome: blocked((error as Error).message), identifier: '' };
  }
  const { outcome } = await publishEncrypted({
    author,
    identifier,
    guard: async () => ((await findPoll(author, pollId)) ? null : NOT_READABLE),
    build: () => record,
    onStage,
  });
  if (outcome.status === 'sent' && author.name) markComment(author.name, identifier, record);
  return { outcome, identifier };
}

/** The comment an edit or a deletion is about. */
export interface PollCommentRef {
  /** The name it was published under (it must be the author's). */
  name: string;
  identifier: string;
  replyTo?: string | null;
}

async function republishComment(
  author: PollAuthor,
  comment: PollCommentRef,
  make: (pollId: string) => PollCommentRecord,
  onStage?: (stage: WriteStage) => void
): Promise<PollWrite> {
  const parsed = parsePollRecordIdentifier(comment.identifier);
  if (!parsed || parsed.kind !== 'comment')
    return { outcome: blocked('That isn’t a comment on a poll.'), identifier: '' };
  let record: PollCommentRecord;
  try {
    record = make(parsed.pollId);
  } catch (error) {
    return { outcome: blocked((error as Error).message), identifier: '' };
  }
  const { outcome } = await publishEncrypted({
    author,
    name: comment.name,
    identifier: comment.identifier,
    build: () => record,
    onStage,
  });
  if (outcome.status === 'sent') markComment(comment.name, comment.identifier, record);
  return { outcome, identifier: comment.identifier };
}

/** Replace a comment's text (the same identifier, marked edited). */
export function editAdminPollComment(
  author: PollAuthor,
  comment: PollCommentRef,
  text: string,
  onStage?: (stage: WriteStage) => void
): Promise<PollWrite> {
  return republishComment(
    author,
    comment,
    (pollId) => buildPollComment({ pollId, text, replyTo: comment.replyTo, edited: true }),
    onStage
  );
}

/** Replace a comment with "Deleted" (its place and its replies stay). */
export function deleteAdminPollComment(
  author: PollAuthor,
  comment: PollCommentRef,
  onStage?: (stage: WriteStage) => void
): Promise<PollWrite> {
  return republishComment(
    author,
    comment,
    (pollId) => buildDeletedPollComment({ pollId, replyTo: comment.replyTo }),
    onStage
  );
}

/**
 * What a share carries: the poll as the viewer reads it, each voter's latest
 * vote the viewer knows, with its row's time (late ones too), and every
 * comment the viewer can read or a share carried to them. Readers use a copy
 * only where they can't read the row of that same version themselves.
 * `unavailable`: the votes and comments of current admins that the viewer
 * could read but that aren't on their node yet (or Hub didn't decrypt this
 * time), which the copy would leave out for good. Ones not encrypted to the
 * viewer can't be in any copy of theirs.
 */
export async function shareCopy(
  viewer: string,
  view: AdminPollView,
  src: Pick<PollSources, 'votes'>
): Promise<{ votes: ShareVote[]; comments: ShareComment[]; unavailable: number }> {
  const votes: ShareVote[] = [];
  for (const v of [...view.votes, ...view.late])
    if (v.vote) votes.push({ name: v.name, vote: v.vote, updated: v.at });
  const unknown = new Set(
    [...view.unread, ...view.late].filter((v) => v.vote === null).map((v) => v.name)
  );
  let unavailable = src.votes.filter(
    (r) => unknown.has(r.row.name) && r.body.status === 'unavailable'
  ).length;
  const reads = await mapLimit(view.commentRows, 6, async (row) => ({
    ref: row.ref,
    body: await readPollBody(viewer, {
      name: row.name,
      identifier: row.identifier,
      created: row.postedAt,
      updated: row.updatedAt,
    }),
  }));
  const { rows, bodies } = pollThreadSources({
    pollId: view.id,
    rows: view.commentRows,
    bodies: new Map<string, BodyRead>(reads.map((r) => [r.ref, r.body])),
    copies: view.shareComments,
  });
  const comments: ShareComment[] = [];
  for (const row of rows) {
    const body = bodies.get(row.ref);
    if (body?.status === 'unavailable') unavailable += 1;
    if (body?.status !== 'ok') continue;
    const r = body.record;
    comments.push({
      name: row.name,
      identifier: row.identifier,
      postedAt: row.postedAt,
      updatedAt: row.updatedAt,
      text: r.text,
      ...(r.replyTo ? { replyTo: r.replyTo } : {}),
      ...(r.edited ? { edited: true as const } : {}),
      ...(r.deleted ? { deleted: true as const } : {}),
    });
  }
  return { votes, comments, unavailable };
}

/**
 * Share a poll with the Minter Admins added since: a copy of it, its votes
 * and comments as the author reads them, encrypted to every current Minter
 * Admin who can sign. Readers see it as shared by the author.
 */
export async function shareAdminPoll(
  author: PollAuthor,
  pollId: string,
  onStage?: (stage: WriteStage) => void
): Promise<PollWrite & { readers: string[] }> {
  let identifier: string;
  try {
    identifier = shareIdentifier(pollId);
  } catch (error) {
    return { outcome: blocked((error as Error).message), identifier: '', readers: [] };
  }
  let view: AdminPollView | null = null;
  let src: PollSources | null = null;
  let after = 0;
  const { outcome, targets } = await publishEncrypted({
    author,
    identifier,
    guard: async () => {
      // Read fresh, as every write guard does: another admin may have shared it a moment ago.
      const read = await readPoll(author, pollId, { force: true });
      if (!read) return NOT_READABLE;
      view = read.view;
      src = read.src;
      after = view.shares.find((s) => s.address === author.address)?.at ?? 0;
      // (Its shares are read only where something is missing: otherwise none to wait for.)
      const tip = await getChainNow({ force: true });
      const pending =
        needsShareRead(read.src, read.ctx) &&
        read.src.shares.some(
          (r) =>
            trustedName(r.row.name, read.ctx) !== null &&
            r.body.status === 'unavailable' &&
            pollRowTime(r.row) > tip.timestamp - RECENT_SHARE_MS
        );
      return pending
        ? 'This poll was shared a moment ago, and that copy hasn’t reached your node yet. Try again in a minute: it may already cover everyone.'
        : null;
    },
    build: async (fresh) => {
      const found = view as AdminPollView | null;
      const from = src as PollSources | null;
      if (!found || !from) throw new Error(NOT_READABLE);
      const covered = new Set(found.readers);
      if (fresh.readers.every((a) => covered.has(a)))
        throw new Error('Every Minter Admin can already read this poll.');
      const { votes, comments, unavailable } = await shareCopy(author.address, found, from);
      // A copy is for good: one that leaves out what is only slow to arrive isn't worth its fee.
      if (unavailable) throw new Error(INCOMPLETE_COPY);
      return buildShare({
        poll: found.poll,
        pollPublisher: found.publisher.name,
        votes,
        comments,
        readers: fresh.readers,
        sharedAt: Date.now(),
      });
    },
    onStage,
  });
  const readers = targets?.readers ?? [];
  if (outcome.status === 'sent')
    setPendingShare(pollId, { readers, status: 'confirming', at: Date.now(), after });
  return { outcome, identifier, readers };
}
