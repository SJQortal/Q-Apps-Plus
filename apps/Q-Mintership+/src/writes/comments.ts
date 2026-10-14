/**
 * Comment writes: post (or reply), edit, delete, and a Minter Admin hiding a
 * comment for everyone or showing it again. Each one is a single
 * PUBLISH_QDN_RESOURCE through Hub (0.01 QORT) that screens explain first in
 * a HubStepDialog. Before Hub opens, the runner checks the fee against the
 * confirmed balance and Core's 25-unconfirmed limit, and these guards check
 * that the name is the signer's (and, for a hide, that the signer is still
 * a Minter Admin). Once Hub sends it, the comment shows at once
 * (state/comments.ts) until QDN lists it.
 *
 * `postComment` posts one comment from anywhere in the app: a key
 * (data/commentRecords.ts: a decision's or a nominee's) and the text.
 */
import { getNameOwner } from '../data/accounts';
import {
  buildComment,
  buildDeletedComment,
  buildHide,
  commentRef,
  hideIdentifier,
  newCommentIdentifier,
  type CommentRecord,
} from '../data/commentRecords';
import { getAdmins } from '../data/group';
import { addOptimisticComment, addOptimisticHide } from '../state/comments';
import { publishCommentRequest } from './hubActions';
import { runWrite, type Signer, type WriteOutcome, type WriteStage } from './runner';

/** A signed-in account and the registered name it publishes under. */
export interface CommentAuthor extends Signer {
  name: string;
}

export interface CommentWrite {
  outcome: WriteOutcome;
  /** The comment's identifier (for a hide, the hide record's); empty when it never got that far. */
  identifier: string;
}

/** The comment an edit, a deletion or a hide is about. */
export interface CommentTargetRef {
  /** The name it was published under. */
  name: string;
  identifier: string;
  key: string;
  /** Kept on an edit or a deletion, so a reply stays a reply. */
  replyTo?: string | null;
}

/** The publishing name must be the signer's. */
export async function guardCommentName(
  signer: Signer,
  name: string | null | undefined
): Promise<string | null> {
  if (!name) return 'Commenting needs a registered name on your account.';
  const owner = await getNameOwner(name);
  if (owner !== signer.address) return `The name ${name} belongs to another account.`;
  return null;
}

/** Only a Minter Admin, checked now, may hide a comment for everyone. */
export async function guardHideComment(signer: CommentAuthor): Promise<string | null> {
  const admins = await getAdmins({ force: true });
  if (!admins.signers.some((a) => a.member === signer.address))
    return 'Only Minter Admins can hide a comment for everyone.';
  return guardCommentName(signer, signer.name);
}

function blocked(error: unknown): CommentWrite {
  return {
    outcome: { status: 'blocked', reason: error instanceof Error ? error.message : String(error) },
    identifier: '',
  };
}

async function publish(
  signer: Signer,
  name: string,
  identifier: string,
  record: CommentRecord,
  key: string,
  onStage?: (stage: WriteStage) => void
): Promise<CommentWrite> {
  const outcome = await runWrite({
    request: publishCommentRequest(name, identifier, record),
    signer,
    precheck: () => guardCommentName(signer, name),
    match: (tx) => tx.type === 'ARBITRARY' && tx.identifier === identifier,
    onStage,
  });
  if (outcome.status === 'sent')
    addOptimisticComment({ ref: commentRef(name, identifier), name, identifier, key, record });
  return { outcome, identifier };
}

/**
 * Post one comment about `key` under the author's name; `replyTo` makes it a
 * reply. Shown at once once Hub sends it.
 */
export async function postComment(
  author: CommentAuthor,
  input: { key: string; text: string; replyTo?: string | null },
  onStage?: (stage: WriteStage) => void
): Promise<CommentWrite> {
  let identifier: string;
  let record: CommentRecord;
  try {
    record = buildComment({ key: input.key, text: input.text, replyTo: input.replyTo });
    identifier = newCommentIdentifier(input.key);
  } catch (error) {
    return blocked(error);
  }
  return publish(author, author.name, identifier, record, input.key, onStage);
}

/** Replace a comment's text (the same identifier, marked edited). */
export async function editComment(
  signer: Signer,
  comment: CommentTargetRef,
  text: string,
  onStage?: (stage: WriteStage) => void
): Promise<CommentWrite> {
  let record: CommentRecord;
  try {
    record = buildComment({ key: comment.key, text, replyTo: comment.replyTo, edited: true });
  } catch (error) {
    return blocked(error);
  }
  return publish(signer, comment.name, comment.identifier, record, comment.key, onStage);
}

/** Replace a comment with "Deleted" (its place and its replies stay). */
export async function deleteComment(
  signer: Signer,
  comment: CommentTargetRef,
  onStage?: (stage: WriteStage) => void
): Promise<CommentWrite> {
  let record: CommentRecord;
  try {
    record = buildDeletedComment({ key: comment.key, replyTo: comment.replyTo });
  } catch (error) {
    return blocked(error);
  }
  return publish(signer, comment.name, comment.identifier, record, comment.key, onStage);
}

/** A Minter Admin hides a comment for everyone (`hidden`), or shows it again. */
export async function setCommentHidden(
  admin: CommentAuthor,
  comment: Pick<CommentTargetRef, 'name' | 'identifier' | 'key'>,
  hidden: boolean,
  onStage?: (stage: WriteStage) => void
): Promise<CommentWrite> {
  let identifier: string;
  let record;
  try {
    identifier = hideIdentifier(comment.key, comment.name, comment.identifier);
    record = buildHide({
      commentName: comment.name,
      commentIdentifier: comment.identifier,
      hidden,
    });
  } catch (error) {
    return blocked(error);
  }
  const outcome = await runWrite({
    request: publishCommentRequest(admin.name, identifier, record),
    signer: admin,
    precheck: () => guardHideComment(admin),
    match: (tx) => tx.type === 'ARBITRARY' && tx.identifier === identifier,
    onStage,
  });
  if (outcome.status === 'sent')
    addOptimisticHide(commentRef(comment.name, comment.identifier), hidden);
  return { outcome, identifier };
}
