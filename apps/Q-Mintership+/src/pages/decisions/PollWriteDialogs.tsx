/**
 * The vote and share dialogs of a poll card, for the polls section and a
 * poll's own page: the one that was opened stays mounted while it closes,
 * and focus goes back to its card.
 */
import { useState } from 'react';
import type { PollVote } from '../../data/adminPollRecords';
import { shareAdminPoll, voteAdminPoll, type PollAuthor } from '../../writes/adminPolls';
import { SharePollDialog, VotePollDialog } from './AdminPollDialogs';
import { adminPollCardId, type ShownPoll } from './adminPollUi';

export type PollDialog =
  | { kind: 'vote'; view: ShownPoll; vote: PollVote; changing: boolean }
  | { kind: 'share'; view: ShownPoll };

export function PollWriteDialogs({
  dialog,
  author,
  admins,
  onClose,
}: {
  dialog: PollDialog | null;
  author: PollAuthor;
  /** How many Minter Admins can sign now. */
  admins: number;
  onClose: () => void;
}) {
  const [shown, setShown] = useState<PollDialog | null>(dialog);
  if (dialog && dialog !== shown) setShown(dialog);
  const current = dialog ?? shown;
  if (!current) return null;
  const pollId = current.view.id;
  const returnFocus = () => document.getElementById(adminPollCardId(pollId));
  if (current.kind === 'vote')
    return (
      <VotePollDialog
        open={Boolean(dialog)}
        onClose={onClose}
        view={current.view}
        vote={current.vote}
        changing={current.changing}
        author={author}
        admins={admins}
        publish={(onStage) => voteAdminPoll(author, pollId, current.vote, onStage)}
        returnFocus={returnFocus}
      />
    );
  return (
    <SharePollDialog
      open={Boolean(dialog)}
      onClose={onClose}
      view={current.view}
      author={author}
      admins={admins}
      publish={(onStage) => shareAdminPoll(author, pollId, onStage)}
      returnFocus={returnFocus}
    />
  );
}
