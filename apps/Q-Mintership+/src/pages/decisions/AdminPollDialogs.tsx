/**
 * The Hub step for each Minter Admin poll write, explained before Hub
 * opens: what is published, that it is encrypted to the Minter Admins, under
 * which name, and the fee. One PUBLISH_QDN_RESOURCE each (service
 * DOCUMENT_PRIVATE, Hub shows "isEncrypted: true").
 */
import { Box, Typography } from '@mui/material';
import { HubStepDialog } from '../../components/common/HubStepDialog';
import { PersonInline } from '../../components/common/Person';
import type { PollVote } from '../../data/adminPollRecords';
import type { AdminPollView } from '../../rules/adminPolls';
import { formatDateTime, plural } from '../../utils/format';
import type { PollAuthor, PollWrite } from '../../writes/adminPolls';
import type { WriteStage } from '../../writes/runner';
import { ADVISORY, VOTE_LABEL, encryptedCheck, encryptedTo } from './adminPollUi';

type Publish = (onStage: (stage: WriteStage) => void) => Promise<PollWrite>;
type ReturnFocus = () => HTMLElement | null;

const LATER =
  'It shows here now, and for the other Minter Admins once QDN has it, usually within a minute or two.';

function Question({ text }: { text: string }) {
  return (
    <Box
      component="blockquote"
      sx={{
        m: 0,
        pl: 1.5,
        borderLeft: 3,
        borderColor: 'divider',
        fontWeight: 600,
        overflowWrap: 'anywhere',
      }}
    >
      {text}
    </Box>
  );
}

export function VotePollDialog({
  open,
  onClose,
  view,
  vote,
  changing,
  author,
  admins,
  publish,
  returnFocus,
}: {
  open: boolean;
  onClose: () => void;
  view: AdminPollView;
  vote: PollVote;
  /** The viewer had voted already: this replaces it. */
  changing: boolean;
  author: PollAuthor;
  /** How many Minter Admins it is encrypted to. */
  admins: number;
  publish: Publish;
  returnFocus?: ReturnFocus;
}) {
  const label = VOTE_LABEL[vote];
  return (
    <HubStepDialog
      open={open}
      onClose={onClose}
      returnFocus={returnFocus}
      title={changing ? `Change your vote to ${label}` : `Vote ${label}`}
      intro={
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Question text={view.poll.question} />
          <Typography>
            Your vote: <b>{label}</b>.{' '}
            {changing
              ? 'It replaces your earlier vote: only your latest vote counts.'
              : 'You can change it until the poll ends: only your latest vote counts.'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Votes published after {formatDateTime(view.poll.endsAt)} don’t count.{' '}
            {encryptedTo(admins)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {ADVISORY}
          </Typography>
        </Box>
      }
      steps={[
        {
          action: 'PUBLISH_QDN_RESOURCE',
          title: `Publish your vote, encrypted to the ${plural(admins, 'Minter Admin')}`,
          check: encryptedCheck(author.name ?? '', 'qmp-adminvote-'),
          feeTxType: 'ARBITRARY',
        },
      ]}
      run={async (report) => ({ outcome: (await publish((stage) => report(0, stage))).outcome })}
      successTitle={changing ? 'Vote changed' : 'Vote published'}
      successText={<Typography variant="body2">{LATER}</Typography>}
    />
  );
}

export function SharePollDialog({
  open,
  onClose,
  view,
  author,
  admins,
  publish,
  returnFocus,
}: {
  open: boolean;
  onClose: () => void;
  view: AdminPollView;
  author: PollAuthor;
  /** How many Minter Admins can sign now (the copy is encrypted to all of them). */
  admins: number;
  publish: Publish;
  returnFocus?: ReturnFocus;
}) {
  const added = view.missing;
  return (
    <HubStepDialog
      open={open}
      onClose={onClose}
      returnFocus={returnFocus}
      title="Share with Minter Admins added since"
      intro={
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Question text={view.poll.question} />
          <Typography component="div">
            {plural(added.length, 'Minter Admin')} can’t read this poll yet:{' '}
            {added.map((address, i) => (
              <span key={address}>
                {i > 0 ? (i === added.length - 1 ? ' and ' : ', ') : ''}
                <PersonInline address={address} />
              </span>
            ))}
            .
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This publishes a copy of the poll with its votes and comments as you can read them,
            encrypted to all {plural(admins, 'current Minter Admin')}. They see it as shared by you,{' '}
            {author.name}. Votes and comments published from now on reach them anyway.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {ADVISORY}
          </Typography>
        </Box>
      }
      steps={[
        {
          action: 'PUBLISH_QDN_RESOURCE',
          title: `Publish the copy, encrypted to the ${plural(admins, 'Minter Admin')}`,
          check: encryptedCheck(author.name ?? '', 'qmp-adminshare-'),
          feeTxType: 'ARBITRARY',
        },
      ]}
      run={async (report) => ({ outcome: (await publish((stage) => report(0, stage))).outcome })}
      successTitle="Shared"
      successText={<Typography variant="body2">{LATER}</Typography>}
    />
  );
}

export type PollCommentMode = 'post' | 'reply' | 'edit';

const COMMENT_TITLE: Record<PollCommentMode, string> = {
  post: 'Post your comment',
  reply: 'Post your reply',
  edit: 'Save your edit',
};

export function PollCommentDialog({
  open,
  onClose,
  mode,
  text,
  name,
  replyingTo,
  admins,
  publish,
  onSent,
  returnFocus,
}: {
  open: boolean;
  onClose: () => void;
  mode: PollCommentMode;
  text: string;
  /** The name it is published under. */
  name: string;
  replyingTo?: string | null;
  admins: number;
  publish: Publish;
  onSent: () => void;
  returnFocus?: ReturnFocus;
}) {
  return (
    <HubStepDialog
      open={open}
      onClose={onClose}
      returnFocus={returnFocus}
      title={COMMENT_TITLE[mode]}
      intro={
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {replyingTo ? (
            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
              Replying to {replyingTo}
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
            {mode === 'edit'
              ? 'The new version replaces your comment, marked “edited”.'
              : `Published under your name, ${name}.`}{' '}
            {encryptedTo(admins)}
          </Typography>
        </Box>
      }
      steps={[
        {
          action: 'PUBLISH_QDN_RESOURCE',
          title:
            mode === 'edit'
              ? 'Publish the new version, encrypted'
              : `Publish your ${mode === 'reply' ? 'reply' : 'comment'}, encrypted`,
          check: encryptedCheck(name, 'qmp-admincomment-'),
          feeTxType: 'ARBITRARY',
        },
      ]}
      run={async (report) => ({ outcome: (await publish((stage) => report(0, stage))).outcome })}
      successTitle={
        mode === 'edit'
          ? 'Edit published'
          : mode === 'reply'
            ? 'Reply published'
            : 'Comment published'
      }
      successText={<Typography variant="body2">{LATER}</Typography>}
      onSuccess={onSent}
    />
  );
}

export function DeletePollCommentDialog({
  open,
  onClose,
  name,
  publish,
  returnFocus,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  publish: Publish;
  returnFocus?: ReturnFocus;
}) {
  return (
    <HubStepDialog
      open={open}
      onClose={onClose}
      returnFocus={returnFocus}
      title="Delete your comment"
      intro={
        <Typography>
          It shows as “Deleted” in the same place, so replies to it still make sense. The Minter
          Admins may already have read it.
        </Typography>
      }
      steps={[
        {
          action: 'PUBLISH_QDN_RESOURCE',
          title: 'Publish the deletion, encrypted',
          check: encryptedCheck(name, 'qmp-admincomment-'),
          feeTxType: 'ARBITRARY',
        },
      ]}
      run={async (report) => ({ outcome: (await publish((stage) => report(0, stage))).outcome })}
      successTitle="Comment deleted"
      successText={<Typography variant="body2">{LATER}</Typography>}
    />
  );
}
