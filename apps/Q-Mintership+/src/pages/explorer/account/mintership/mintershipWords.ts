/**
 * The Mintership tab's words: plain, short and factual, every count with
 * what it counts out of, partial reads saying how far they got. Evidence,
 * never a verdict. Names are never put inside these strings: the screen
 * shows each one isolated (`<bdi>`), next to the words.
 */
import type { NominationState } from '../../../../rules/nomination';
import { OUTCOME_LABEL } from '../../../../rules/outcome';
import type { NominationRound } from '../../../../rules/rounds';
import type { AdminActivity } from '../../../../rules/activity';
import type { AnswersRead } from '../../../../data/explorer/answers';
import type { PollVotes } from '../../../../data/explorer/legacyBy';
import { formatCount, formatDate, plural } from '../../../../utils/format';

/** The one line for an account with nothing in MINTER, its records or its votes. */
export const NOTHING_IN_MINTER = 'Not in MINTER. No nominations, records or votes found.';

/** What was looked through before saying NOTHING_IN_MINTER. */
export function nothingChecked(scanned: number, total: number): string {
  const cards =
    scanned >= total
      ? `all ${formatCount(total)} original-app cards`
      : `the newest ${formatCount(scanned)} of ${formatCount(total)} original-app cards`;
  return `Checked their MINTER history, nominations, Q-Mintership+ records and original-app posts under any of their names, and ${cards} for ones about them.`;
}

/** Under the MINTER profile link: what that page is for. */
export const PROFILE_HINT = 'Nominate, support or decide on the MINTER profile';

/** "Also checked, nothing found: supports, Considering marks." (empty for nothing). */
export function alsoChecked(items: readonly string[]): string {
  return items.length ? `Also checked, nothing found: ${items.join(', ')}.` : '';
}

/**
 * The lead of the line that says which names had records, before the names
 * themselves: "Found under 2 of their 3 names:", "Found under their only
 * name:", "Nothing under any of their 3 names." Null with no names at all.
 */
export function namesLead(withRecords: number, names: number, truncated: boolean): string | null {
  if (names === 0) return null;
  const total = truncated
    ? `the first ${formatCount(names)} of their names`
    : names === 1
      ? 'their only name'
      : `their ${formatCount(names)} names`;
  if (withRecords === 0)
    return names === 1 && !truncated
      ? 'Nothing under their only name.'
      : `Nothing under any of ${total}.`;
  if (names === 1 && !truncated) return 'Found under their only name:';
  return `Found under ${formatCount(withRecords)} of ${total}:`;
}

/** Records are published under a name: an account with none has none. */
export const NO_NAME_RECORDS =
  'No registered name. Records are published under a name, so there are none to find.';

/** The words for a nomination's state, without colour (the app's own states). */
export const NOMINATION_STATE_WORDS: Record<NominationState, string> = {
  waiting: 'waiting for a Minter Admin',
  signing: 'collecting approvals',
  approved: 'approved, waiting for them to join',
  joined: 'joined MINTER',
  expired: 'expired',
  rejected: 'rejected',
  lapsed: 'no Minter Admin approved it in time',
  blocked: 'banned: the ban must be lifted first',
};

/**
 * Their rounds in one line: "2 rounds. The latest, round 2, started on
 * 3 Mar 2026 (block 2,700,000): Approved." Null without rounds.
 */
export function roundsLine(rounds: readonly NominationRound[]): string | null {
  const latest = rounds[0];
  if (!latest) return null;
  const block =
    latest.startedHeight !== null ? ` (block ${formatCount(latest.startedHeight)})` : '';
  const count = rounds.length === 1 ? 'One round' : plural(rounds.length, 'round');
  const which = rounds.length === 1 ? 'It' : `The latest, round ${latest.number},`;
  return `${count}. ${which} started on ${formatDate(latest.startedAt)}${block}: ${OUTCOME_LABEL[latest.outcome]}.`;
}

/** Their current or latest nomination's state: "Their nomination is collecting approvals." */
export function nominationLine(state: NominationState, open: boolean): string {
  return open
    ? `Their nomination is ${NOMINATION_STATE_WORDS[state]}.`
    : `Their latest nomination: ${NOMINATION_STATE_WORDS[state]}.`;
}

/** "87%", or a dash. */
function percent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

/**
 * Activity's figures for one Minter Admin, from its cached report:
 * "Participation 80%: 12 of 15 decisions answered (11 approved, 1
 * rejected), 3 missed."
 */
export function activityLine(row: AdminActivity): string {
  if (!row.eligible) return 'No decisions were open to them in this window.';
  return (
    `Participation ${percent(row.participation)}: ${formatCount(row.answered)} of ` +
    `${plural(row.eligible, 'decision')} answered (${formatCount(row.signed)} approved, ` +
    `${formatCount(row.rejected)} rejected), ${formatCount(row.missed)} missed.`
  );
}

/** "From Activity's last 30 days." */
export function activitySource(days: number): string {
  return `From Activity's last ${days} days.`;
}

/**
 * What the answers read so far say: "Their newest 500 answers read so far.
 * 480 of them on MINTER decisions: 470 approved, 10 rejected."
 */
export function answersSummary(read: AnswersRead): string {
  const total = read.approvals.length;
  if (!total) return read.done ? 'No answers on chain.' : 'No answers read yet.';
  const approved = read.answers.filter((a) => a.approval).length;
  const rejected = read.answers.length - approved;
  const scope = read.done
    ? `All ${plural(total, 'answer')} they gave.`
    : `Their newest ${plural(total, 'answer')} read so far.`;
  const minter = read.answers.length
    ? ` ${formatCount(read.answers.length)} of them on MINTER decisions: ${formatCount(approved)} approved, ${formatCount(rejected)} rejected.`
    : ' None of them on MINTER decisions.';
  return `${scope}${minter}`;
}

/** The answers that aren't listed, and why, in plain words (empty when none). */
export function answersLeftOut(read: AnswersRead): string[] {
  const lines: string[] = [];
  if (read.leftOut)
    lines.push(
      `Left out: ${plural(read.leftOut, 'answer')} on transactions that aren't MINTER decisions.`
    );
  if (read.unmatched)
    lines.push(
      `Not matched: ${plural(read.unmatched, 'answer')} older than the newest ${formatCount(read.decisionsRead)} MINTER decisions read.`
    );
  return lines;
}

/**
 * "36 votes in 34 original-app polls: 30 Yes, 6 No." with what the read
 * covers (a vote can be cast again in the same poll).
 */
export function pollVotesSummary(votes: PollVotes): string {
  const listed = votes.votes.length;
  const polls = new Set(votes.votes.map((v) => v.pollName)).size;
  const yes = votes.votes.filter((v) => v.answer === 'yes').length;
  const no = votes.votes.filter((v) => v.answer === 'no').length;
  const other = listed - yes - no;
  const scope = votes.truncated ? ' (in their newest 100 poll votes)' : '';
  if (!listed) return `No votes in the original app's nomination or admin polls${scope}.`;
  const parts = [`${formatCount(yes)} Yes`, `${formatCount(no)} No`];
  if (other) parts.push(`${formatCount(other)} other or unread`);
  return `${plural(listed, 'vote')} in ${plural(polls, 'original-app poll')}${scope}: ${parts.join(', ')}.`;
}

/** The votes that are only counted (empty when none). */
export function pollVotesCounted(votes: PollVotes): string[] {
  const lines: string[] = [];
  if (votes.adminBoard)
    lines.push(
      `${plural(votes.adminBoard, 'vote')} on encrypted admin board cards' polls (counted only).`
    );
  if (votes.other)
    lines.push(`${plural(votes.other, 'vote')} on other apps' polls (counted only).`);
  return lines;
}
