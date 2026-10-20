/**
 * The Hub step for each comment write, explained before Hub opens (what is
 * published, under which name, and the fee): post, reply, edit, delete,
 * and a Minter Admin's hide or show-again. One PUBLISH_QDN_RESOURCE each.
 * A comment for the Minter Admins only (`adminsOnly`: how many it is
 * encrypted to) says so, and that Hub shows it encrypted.
 */
import { Box, Typography } from '@mui/material';
import type { CommentWrite } from '../../writes/comments';
import type { WriteStage } from '../../writes/runner';
import { HubStepDialog } from '../common/HubStepDialog';
import { MarkedName } from '../common/MarkedName';
import { withMarkedName } from '../common/markedText';
import { encryptedCheck, encryptedTo } from '../common/encryptedWords';

type Publish = (onStage: (stage: WriteStage) => void) => Promise<CommentWrite>;
/** Where focus goes on close when the button that opened the dialog is gone. */
type ReturnFocus = () => HTMLElement | null;

export type PublishMode = 'post' | 'reply' | 'edit';

const TITLE: Record<PublishMode, string> = {
  post: 'Post your comment',
  reply: 'Post your reply',
  edit: 'Save your edit',
};

const STEP: Record<PublishMode, string> = {
  post: 'Publish your comment',
  reply: 'Publish your reply',
  edit: 'Publish the new version',
};

const DONE: Record<PublishMode, string> = {
  post: 'Comment published',
  reply: 'Reply published',
  edit: 'Edit published',
};

function check(name: string, prefix: string): string[] {
  return [
    `The name is ${name}.`,
    'The service is JSON.',
    `The identifier starts with ${prefix}.`,
    'The fee.',
  ];
}

const LATER =
  'It shows here now, and for everyone once QDN has it, usually within a minute or two.';
const LATER_ADMINS =
  'It shows here now, and for the other Minter Admins once QDN has it, usually within a minute or two.';
const ADMIN_PREFIX = 'qmp-macomment-';

export function PublishCommentDialog({
  open,
  onClose,
  mode,
  text,
  name,
  replyingTo,
  adminsOnly = null,
  publish,
  onSent,
  returnFocus,
}: {
  open: boolean;
  onClose: () => void;
  returnFocus?: ReturnFocus;
  mode: PublishMode;
  text: string;
  /** The name it is published under. */
  name: string;
  /** Whose comment a reply answers. */
  replyingTo?: string | null;
  /** For the Minter Admins only: how many it is encrypted to (null: public). */
  adminsOnly?: number | null;
  publish: Publish;
  onSent: () => void;
}) {
  const admins = adminsOnly !== null;
  return (
    <HubStepDialog
      open={open}
      onClose={onClose}
      returnFocus={returnFocus}
      title={admins ? `${TITLE[mode]} for the Minter Admins` : TITLE[mode]}
      intro={
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {replyingTo ? (
            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
              Replying to <MarkedName name={replyingTo} />
            </Typography>
          ) : null}
          <Box
            component="blockquote"
            sx={{
              m: 0,
              pl: 1.5,
              borderLeft: 3,
              borderColor: 'divider',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
            }}
          >
            {text}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {admins ? (
              <>
                {mode === 'edit'
                  ? 'The new version replaces your comment, marked “edited”.'
                  : `Published under your name, ${name}.`}{' '}
                {encryptedTo(adminsOnly ?? 0)}
              </>
            ) : (
              <>
                {mode === 'edit'
                  ? 'The new version replaces your comment for everyone, marked “edited”.'
                  : `It is published on QDN under your name, ${name}, and anyone can read it.`}
              </>
            )}{' '}
            You can edit or delete it later; each change is published the same way, with the same
            fee.
          </Typography>
        </Box>
      }
      steps={[
        {
          action: 'PUBLISH_QDN_RESOURCE',
          title: admins ? `${STEP[mode]}, encrypted` : STEP[mode],
          check: admins ? encryptedCheck(name, ADMIN_PREFIX) : check(name, 'qmp-comment-'),
          feeTxType: 'ARBITRARY',
        },
      ]}
      run={async (report) => ({ outcome: (await publish((stage) => report(0, stage))).outcome })}
      successTitle={DONE[mode]}
      successText={<Typography variant="body2">{admins ? LATER_ADMINS : LATER}</Typography>}
      onSuccess={onSent}
    />
  );
}

export function DeleteCommentDialog({
  open,
  onClose,
  name,
  adminsOnly = null,
  publish,
  returnFocus,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  /** A comment for the Minter Admins only: how many the deletion is encrypted to (null: public). */
  adminsOnly?: number | null;
  publish: Publish;
  returnFocus?: ReturnFocus;
}) {
  const admins = adminsOnly !== null;
  return (
    <HubStepDialog
      open={open}
      onClose={onClose}
      returnFocus={returnFocus}
      title="Delete your comment"
      intro={
        <Typography>
          {admins
            ? 'It shows as “Deleted” in the same place, so replies to it still make sense. The Minter Admins may already have read it.'
            : 'It shows as “Deleted” for everyone, in the same place, so replies to it still make sense. Anyone may already have read or saved what it said.'}
        </Typography>
      }
      steps={[
        {
          action: 'PUBLISH_QDN_RESOURCE',
          title: admins ? 'Publish the deletion, encrypted' : 'Publish the deletion',
          check: admins ? encryptedCheck(name, ADMIN_PREFIX) : check(name, 'qmp-comment-'),
          feeTxType: 'ARBITRARY',
        },
      ]}
      run={async (report) => ({ outcome: (await publish((stage) => report(0, stage))).outcome })}
      confirmLabel="Continue to Hub"
      successTitle="Comment deleted"
      successText={<Typography variant="body2">{admins ? LATER_ADMINS : LATER}</Typography>}
    />
  );
}

export function HideCommentDialog({
  open,
  onClose,
  hide,
  author,
  name,
  publish,
  returnFocus,
}: {
  open: boolean;
  onClose: () => void;
  returnFocus?: ReturnFocus;
  /** True to hide it, false to show it again. */
  hide: boolean;
  /** Who wrote the comment. */
  author: string;
  /** The Minter Admin's name the record is published under. */
  name: string;
  publish: Publish;
}) {
  return (
    <HubStepDialog
      open={open}
      onClose={onClose}
      returnFocus={returnFocus}
      title={hide ? 'Hide this comment for everyone' : 'Show this comment again'}
      intro={
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography sx={{ overflowWrap: 'anywhere' }}>
            {withMarkedName(
              hide
                ? `The comment by ${author} stays on QDN, but everyone sees it folded away as “Hidden by a Minter Admin”, with Show anyway.`
                : `The comment by ${author} shows normally again for everyone.`,
              author
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This publishes a small record under your name that the app reads.{' '}
            {hide ? 'Any Minter Admin can show it again.' : 'It replaces your earlier one.'}
          </Typography>
        </Box>
      }
      steps={[
        {
          action: 'PUBLISH_QDN_RESOURCE',
          title: hide ? 'Publish the hide' : 'Publish the change',
          check: check(name, 'qmp-hide-'),
          feeTxType: 'ARBITRARY',
        },
      ]}
      run={async (report) => ({ outcome: (await publish((stage) => report(0, stage))).outcome })}
      successTitle={hide ? 'Comment hidden' : 'Comment shown again'}
      successText={<Typography variant="body2">{LATER}</Typography>}
    />
  );
}
