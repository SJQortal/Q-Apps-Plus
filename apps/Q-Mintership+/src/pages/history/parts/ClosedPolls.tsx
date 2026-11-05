/**
 * The closed Minter Admin polls for History's timeline (Simon, 2026-10-23:
 * "i want minter admin polls to show in history like all the other polls"):
 * loaded only for Minter Admins, so nobody else downloads or reads any of
 * it. Reads the polls that ended in History's period (data/adminPolls.ts,
 * PollScope `closed`) and hands them up as rows; renders nothing itself.
 */
import { useEffect, useMemo } from 'react';
import { HISTORY_POLL_CEILING, type PollScope } from '../../../data/adminPolls';
import { pollAnswers } from '../../../data/adminPollRecords';
import {
  countsText,
  undecryptedText,
  voteLabel,
  type ShownPoll,
} from '../../decisions/adminPollUi';
import { useAdminPolls } from '../../decisions/useAdminPolls';
import type { TimelinePoll } from './TimelineList';

export interface ClosedPollsState {
  /** Null while the first read is on its way. */
  polls: TimelinePoll[] | null;
  error: unknown;
  /** "1 more poll couldn't be decrypted just now.", or null. */
  undecrypted: string | null;
  /** More closed in the period than one read takes (HISTORY_POLL_CEILING). */
  more: boolean;
  retry: () => void;
}

function toRow(view: ShownPoll): TimelinePoll {
  return {
    id: view.id,
    question: view.poll.question,
    at: view.poll.endsAt,
    askedBy: view.publisher.address,
    result: countsText(view.counts, pollAnswers(view.poll)),
    mine: view.myVote
      ? `You voted ${voteLabel(view.poll, view.myVote.vote)}`
      : view.myLate
        ? 'Your vote came after the end'
        : null,
  };
}

export default function ClosedPolls({
  viewer,
  since,
  onChange,
}: {
  viewer: string;
  /** The period's start (ms): polls that ended since then. */
  since: number;
  onChange: (state: ClosedPollsState) => void;
}) {
  const scope = useMemo<PollScope>(
    () => ({ kind: 'closed', since, count: HISTORY_POLL_CEILING }),
    [since]
  );
  const { query, views, undecrypted, retry } = useAdminPolls(viewer, true, scope);
  const polls = useMemo(() => views?.map(toRow) ?? null, [views]);
  const error = !views && query.isError ? query.error : null;
  const more = Boolean(query.data?.more);
  const note = undecrypted ? undecryptedText(undecrypted) : null;
  useEffect(() => {
    onChange({ polls, error, undecrypted: note, more, retry });
  }, [onChange, polls, error, note, more, retry]);
  return null;
}
