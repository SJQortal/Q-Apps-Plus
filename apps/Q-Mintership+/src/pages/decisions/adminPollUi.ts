/**
 * Words and small decisions for the Minter Admin polls screens, pure: what a
 * vote reads like while it is on its way, when a poll ends, and the polls
 * this device just published, listed before QDN has them.
 */
import { DAY_MS, type PollRecord, type PollVote } from '../../data/adminPollRecords';
import {
  CLOCK_SLACK_MS,
  isPollOpen,
  sortPolls,
  tallyVotes,
  type AdminPollView,
} from '../../rules/adminPolls';
import type { PendingPoll, PendingShare, PendingVote } from '../../state/adminPolls';
import { formatCount, formatDateTime, formatRelative, plural } from '../../utils/format';

export const VOTE_LABEL: Record<PollVote, string> = { yes: 'Yes', no: 'No', neutral: 'Neutral' };

/** Said on every poll and in every step that publishes one. */
export const ADVISORY = 'Advisory: nothing changes on chain from the result.';

export const ADMINS_ONLY = 'This is for Minter Admins only';

/** A poll card's element id, to return focus to it after a dialog. */
export function adminPollCardId(id: string): string {
  return `admin-poll-${id}`;
}

/** What to check in Hub's dialog for an encrypted publish. */
export function encryptedCheck(name: string, prefix: string): string[] {
  return [
    `The name is ${name}.`,
    'The service is DOCUMENT_PRIVATE.',
    `The identifier starts with ${prefix}.`,
    'It says isEncrypted: true.',
    'The fee.',
  ];
}

/** "Encrypted to the 19 Minter Admins: only they can read it. …" */
export function encryptedTo(admins: number): string {
  return `Encrypted to the ${plural(admins, 'Minter Admin')}: only they can read it. Anyone can see that a record was published under your name, not what it says.`;
}

/** "Ends in 5 days · 18 Oct 2026, 14:33", or "Ended 5 days ago · …". */
export function endText(poll: Pick<PollRecord, 'endsAt'>, now: number): string {
  const when = formatDateTime(poll.endsAt);
  return isPollOpen(poll, now)
    ? `Ends ${formatRelative(poll.endsAt, now)} · ${when}`
    : `Ended ${formatRelative(poll.endsAt, now)} · ${when}`;
}

/** "about block 2,765,800". */
export function endBlockText(poll: Pick<PollRecord, 'endHeight'>): string {
  return `about block ${formatCount(poll.endHeight)}`;
}

/** "Yes 3 · No 2 · Neutral 1". */
export function countsText(counts: Record<PollVote, number>): string {
  return (['yes', 'no', 'neutral'] as const)
    .map((v) => `${VOTE_LABEL[v]} ${formatCount(counts[v])}`)
    .join(' · ');
}

/** "14 of 19 Minter Admins haven't voted", or null when everyone has. */
export function notVotedText(voted: number, admins: number): string | null {
  const left = Math.max(0, admins - voted);
  if (!left) return null;
  return `${formatCount(left)} of ${plural(admins, 'Minter Admin')} ${left === 1 ? "hasn't" : "haven't"} voted`;
}

/** On-time votes the viewer can't read: voted, but not in the counts. */
export function unreadText(count: number): string {
  return count === 1
    ? '1 vote you can’t read yet isn’t in these counts.'
    : `${formatCount(count)} votes you can’t read yet aren’t in these counts.`;
}

/** Votes known only from a share's copy (a search stopped before their own records). */
export function unlistedText(count: number): string {
  return count === 1
    ? '1 of these votes is only in a share’s copy: the search stopped before its own record.'
    : `${formatCount(count)} of these votes are only in a share’s copy: the search stopped before their own records.`;
}

/** "Share with 2 Minter Admins added since". */
export function shareLabel(missing: number): string {
  return `Share with ${plural(missing, 'Minter Admin')} added since`;
}

/** "1 Minter Admin poll is waiting for your vote", "3 Minter Admin polls are waiting for your vote". */
export function waitingText(count: number): string {
  return count === 1
    ? '1 Minter Admin poll is waiting for your vote'
    : `${formatCount(count)} Minter Admin polls are waiting for your vote`;
}

/** The pending vote is in what QDN shows now: the same vote, published since. */
export function voteSettled(
  view: Pick<AdminPollView, 'myVote'>,
  pending: Pick<PendingVote, 'vote' | 'at'>
): boolean {
  return Boolean(
    view.myVote &&
    view.myVote.vote === pending.vote &&
    view.myVote.at >= pending.at - CLOCK_SLACK_MS
  );
}

export interface MyVoteView {
  /** The vote shown as the viewer's (on its way, or counted). */
  vote: PollVote | null;
  /** The chip's words, or null when there is no vote. */
  label: string | null;
  /** QDN shows it. */
  settled: boolean;
  /** Being sent right now: no new vote until Hub answers. */
  sending: boolean;
  /** Hub stopped waiting and it hasn't shown up: wait before trying again. */
  failed: boolean;
}

/** The viewer's own vote as the card shows it. */
export function myVoteView(
  view: Pick<AdminPollView, 'myVote' | 'open'>,
  pending: PendingVote | null | undefined
): MyVoteView {
  const counted = view.myVote;
  if (pending && !voteSettled(view, pending)) {
    if (pending.status === 'sending')
      return {
        vote: counted?.vote ?? null,
        label: counted ? `Your vote: ${VOTE_LABEL[counted.vote]} ✓` : null,
        settled: true,
        sending: true,
        failed: false,
      };
    if (pending.status === 'confirming')
      return {
        vote: pending.vote,
        label: `Voted ${VOTE_LABEL[pending.vote]} ✓ (confirming…)`,
        settled: false,
        sending: false,
        failed: false,
      };
    return {
      vote: counted?.vote ?? null,
      label: counted ? `Your vote: ${VOTE_LABEL[counted.vote]} ✓` : null,
      settled: true,
      sending: false,
      failed: true,
    };
  }
  if (!counted) return { vote: null, label: null, settled: true, sending: false, failed: false };
  return {
    vote: counted.vote,
    label: view.open
      ? `Your vote: ${VOTE_LABEL[counted.vote]} ✓`
      : `You voted ${VOTE_LABEL[counted.vote]}`,
    settled: true,
    sending: false,
    failed: false,
  };
}

/** A share from this device is in what QDN shows now. */
export function shareSettled(
  view: Pick<AdminPollView, 'shares'>,
  viewer: string,
  pending: Pick<PendingShare, 'at'>
): boolean {
  return view.shares.some((s) => s.address === viewer && s.at >= pending.at - CLOCK_SLACK_MS);
}

/** A listed poll, or one this device just published that QDN doesn't list yet. */
export type ShownPoll = AdminPollView & { publishing?: boolean };

/**
 * The polls to show: what QDN lists, plus the ones this device published
 * that it doesn't list yet ("Publishing…"), in the list's order.
 */
export function withPublishing(
  views: readonly AdminPollView[],
  pending: Record<string, PendingPoll>,
  signers: readonly string[],
  now: number
): ShownPoll[] {
  const listed = new Set(views.map((v) => v.id));
  const extra: ShownPoll[] = Object.entries(pending)
    .filter(([id, p]) => !listed.has(id) && now - p.poll.endsAt <= 31 * DAY_MS)
    .map(([id, p]) => ({
      id,
      poll: p.poll,
      publisher: p.publisher,
      postedAt: p.poll.createdAt,
      sharedBy: null,
      shares: [],
      open: isPollOpen(p.poll, now),
      votes: [],
      late: [],
      unread: [],
      counts: tallyVotes([]),
      myVote: null,
      myLate: null,
      readers: p.poll.readers,
      missing: signers.filter((a) => !p.poll.readers.includes(a)),
      commentRows: [],
      shareComments: [],
      publishing: true,
    }));
  return extra.length ? sortPolls([...views, ...extra]) : [...views];
}
