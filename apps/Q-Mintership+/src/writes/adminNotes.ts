/**
 * Writes for the Minter Admins only (data/adminNoteRecords.ts): the note a
 * proposer adds to their decision or nomination, and a Minter Admin's
 * comment (post, reply, edit, delete) that only the Minter Admins read.
 * Each is one PUBLISH_QDN_RESOURCE through Hub, service DOCUMENT_PRIVATE,
 * encrypted to every current Minter Admin who can sign plus the writer
 * (0.01 QORT), as a Minter Admin poll's records are; the screens explain it
 * first in a HubStepDialog.
 *
 * Before Hub opens: the writer is still a Minter Admin (read fresh) and
 * publishes under a registered name of their own; the admins' public keys
 * are read (each once per session); the runner checks the fee against the
 * confirmed balance and Core's 25-unconfirmed limit. Once Hub sends it, it
 * shows at once (state/adminNotes.ts, state/comments.ts) until QDN lists it.
 */
import { getNameOwner } from '../data/accounts';
import {
  adminNoteIdentifier,
  buildAdminComment,
  buildAdminNote,
  buildDeletedAdminComment,
  newAdminCommentIdentifier,
  type AdminCommentRecord,
  type AdminNoteRecord,
} from '../data/adminNoteRecords';
import { encryptionTargets, type EncryptionTargets } from '../data/adminPolls';
import { commentRef } from '../data/commentRecords';
import { invalidate } from '../data/query';
import { setPendingAdminNote } from '../state/adminNotes';
import { addOptimisticComment } from '../state/comments';
import { errorMessage } from '../utils/hubErrors';
import type { CommentTargetRef, CommentWrite } from './comments';
import { isMinterAdmin } from './guards';
import { publishEncryptedRequest } from './hubActions';
import { runWrite, type Signer, type WriteOutcome, type WriteStage } from './runner';

/** A Minter Admin and the registered name they publish under. */
export interface AdminWriter extends Signer {
  name: string | null;
}

const blocked = (reason: string): WriteOutcome => ({ status: 'blocked', reason });

/** Before any of these writes: a signed-in Minter Admin (read fresh) with a registered name of their own. */
export async function guardAdminWriter(
  writer: AdminWriter,
  name: string | null = writer.name
): Promise<string | null> {
  if (!writer.address || !writer.publicKey) return 'Sign in to Hub first.';
  if (!(await isMinterAdmin(writer.address)))
    return 'Only Minter Admins can write for the Minter Admins only.';
  if (!name) return 'This is published under your registered name, and your account has none yet.';
  const owner = await getNameOwner(name);
  if (owner !== writer.address) return `The name ${name} belongs to another account.`;
  return null;
}

/**
 * Check, read who to encrypt to, build the record, then one encrypted
 * PUBLISH_QDN_RESOURCE through the runner.
 */
async function publishForAdmins<R extends AdminNoteRecord | AdminCommentRecord>(spec: {
  writer: AdminWriter;
  /** The name it goes under (an edit keeps its comment's). */
  name?: string;
  identifier: string;
  build: () => R;
  onStage?: (stage: WriteStage) => void;
}): Promise<{ outcome: WriteOutcome; record: R | null; targets: EncryptionTargets | null }> {
  const { writer, identifier, onStage } = spec;
  const name = spec.name ?? writer.name;
  onStage?.('checking');
  let record: R;
  try {
    record = spec.build();
  } catch (error) {
    return {
      outcome: blocked(error instanceof Error ? error.message : String(error)),
      record: null,
      targets: null,
    };
  }
  try {
    const problem = await guardAdminWriter(writer, name);
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
  let targets: EncryptionTargets;
  try {
    // The guard has just read the admins fresh: the same list.
    targets = await encryptionTargets(writer, { force: false });
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
  const outcome = await runWrite({
    request: publishEncryptedRequest(name as string, identifier, record, targets.publicKeys),
    signer: writer,
    match: (tx) => tx.type === 'ARBITRARY' && tx.identifier === identifier,
    onStage,
  });
  if (outcome.status === 'sent' || outcome.status === 'unknown')
    invalidate(`balance:${writer.address}`);
  return { outcome, record, targets };
}

export interface AdminNoteWrite {
  outcome: WriteOutcome;
  identifier: string;
  /** How many Minter Admins it was encrypted to (0 when it never got that far). */
  readers: number;
}

/**
 * The proposer's note for the Minter Admins on `key` (a decision's, or a
 * nominee's address for a nomination): published under their name; again
 * with `edited` to replace it.
 */
export async function publishAdminNote(
  writer: AdminWriter,
  key: string,
  text: string,
  options: { edited?: boolean } = {},
  onStage?: (stage: WriteStage) => void
): Promise<AdminNoteWrite> {
  let identifier: string;
  try {
    identifier = adminNoteIdentifier(key);
  } catch (error) {
    return { outcome: blocked((error as Error).message), identifier: '', readers: 0 };
  }
  const { outcome, record, targets } = await publishForAdmins({
    writer,
    identifier,
    build: () => buildAdminNote({ key, text, edited: options.edited }),
    onStage,
  });
  if (outcome.status === 'sent' && record && writer.name) {
    setPendingAdminNote({
      identifier,
      key,
      name: writer.name,
      author: writer.address,
      text: record.text,
    });
    invalidate('adminnotes:');
  }
  return { outcome, identifier, readers: targets?.readers.length ?? 0 };
}

function markComment(name: string, identifier: string, record: AdminCommentRecord): void {
  addOptimisticComment({
    ref: commentRef(name, identifier),
    name,
    identifier,
    key: record.key,
    record,
    adminOnly: true,
  });
}

/** A comment for the Minter Admins only about `key`; `replyTo` makes it a reply (to either kind). */
export async function postAdminComment(
  writer: AdminWriter,
  input: { key: string; text: string; replyTo?: string | null },
  onStage?: (stage: WriteStage) => void
): Promise<CommentWrite> {
  let identifier: string;
  try {
    identifier = newAdminCommentIdentifier(input.key);
  } catch (error) {
    return { outcome: blocked((error as Error).message), identifier: '' };
  }
  const { outcome, record } = await publishForAdmins({
    writer,
    identifier,
    build: () => buildAdminComment(input),
    onStage,
  });
  if (outcome.status === 'sent' && record && writer.name)
    markComment(writer.name, identifier, record);
  return { outcome, identifier };
}

async function republish(
  writer: AdminWriter,
  comment: CommentTargetRef,
  build: () => AdminCommentRecord,
  onStage?: (stage: WriteStage) => void
): Promise<CommentWrite> {
  const { outcome, record } = await publishForAdmins({
    writer,
    name: comment.name,
    identifier: comment.identifier,
    build,
    onStage,
  });
  if (outcome.status === 'sent' && record) markComment(comment.name, comment.identifier, record);
  return { outcome, identifier: comment.identifier };
}

/** Replace a Minter Admins' comment's text (the same identifier, marked edited, encrypted again). */
export function editAdminComment(
  writer: AdminWriter,
  comment: CommentTargetRef,
  text: string,
  onStage?: (stage: WriteStage) => void
): Promise<CommentWrite> {
  return republish(
    writer,
    comment,
    () => buildAdminComment({ key: comment.key, text, replyTo: comment.replyTo, edited: true }),
    onStage
  );
}

/** Replace a Minter Admins' comment with "Deleted" (its place and its replies stay). */
export function deleteAdminComment(
  writer: AdminWriter,
  comment: CommentTargetRef,
  onStage?: (stage: WriteStage) => void
): Promise<CommentWrite> {
  return republish(
    writer,
    comment,
    () => buildDeletedAdminComment({ key: comment.key, replyTo: comment.replyTo }),
    onStage
  );
}
