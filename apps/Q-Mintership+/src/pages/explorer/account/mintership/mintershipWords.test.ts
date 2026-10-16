/**
 * The Mintership tab's words: counts with what they count out of, partial
 * reads saying how far they got, and no verdicts anywhere.
 */
import { describe, expect, it } from 'vitest';
import type { AdminActivity } from '../../../../rules/activity';
import type { NominationRound } from '../../../../rules/rounds';
import type { AnswersRead } from '../../../../data/explorer/answers';
import type { PollVotes } from '../../../../data/explorer/legacyBy';
import * as words from './mintershipWords';

const round = (number: number, outcome: NominationRound['outcome']): NominationRound => ({
  signature: `r${number}`,
  number,
  outcome,
  firstSigner: null,
  startedAt: Date.UTC(2026, 2, 3),
  startedHeight: 2_700_000,
  decidedHeight: null,
});

const read = (over: Partial<AnswersRead> = {}): AnswersRead => ({
  approvals: [],
  answers: [],
  leftOut: 0,
  unmatched: 0,
  nextOffset: 0,
  done: false,
  stopped: false,
  decisionsRead: 0,
  decisionsCapped: false,
  ...over,
});

describe('Mintership words', () => {
  it('says which names had records, out of how many', () => {
    expect(words.namesLead(2, 3, false)).toBe('Found under 2 of their 3 names:');
    expect(words.namesLead(1, 1, false)).toBe('Found under their only name:');
    expect(words.namesLead(0, 1, false)).toBe('Nothing under their only name.');
    expect(words.namesLead(0, 88, false)).toBe('Nothing under any of their 88 names.');
    expect(words.namesLead(3, 500, true)).toBe('Found under 3 of the first 500 of their names:');
    expect(words.namesLead(0, 0, false)).toBeNull();
  });

  it('sums up the rounds with the latest one’s outcome', () => {
    expect(words.roundsLine([])).toBeNull();
    expect(words.roundsLine([round(1, 'expired')])).toBe(
      'One round. It started on 3 Mar 2026 (block 2,700,000): Expired.'
    );
    expect(words.roundsLine([round(2, 'approved'), round(1, 'expired')])).toBe(
      '2 rounds. The latest, round 2, started on 3 Mar 2026 (block 2,700,000): Approved.'
    );
    expect(words.nominationLine('signing', true)).toBe('Their nomination is collecting approvals.');
    expect(words.nominationLine('expired', false)).toBe('Their latest nomination: expired.');
  });

  it('gives Activity’s figures with their denominators', () => {
    const row = {
      eligible: 15,
      answered: 12,
      signed: 11,
      rejected: 1,
      missed: 3,
      participation: 0.8,
    } as AdminActivity;
    expect(words.activityLine(row)).toBe(
      'Participation 80%: 12 of 15 decisions answered (11 approved, 1 rejected), 3 missed.'
    );
    expect(words.activityLine({ ...row, eligible: 0, participation: null })).toBe(
      'No decisions were open to them in this window.'
    );
    expect(words.activitySource(30)).toBe("From Activity's last 30 days.");
  });

  it('says how far the answers were read, and what was left out', () => {
    const answer = (approval: boolean) =>
      ({ approval }) as unknown as AnswersRead['answers'][number];
    const approvals = Array.from({ length: 5 }, () => ({}) as AnswersRead['approvals'][number]);
    expect(
      words.answersSummary(
        read({ approvals, answers: [answer(true), answer(true), answer(false)] })
      )
    ).toBe(
      'Their newest 5 answers read so far. 3 of them on MINTER decisions: 2 approved, 1 rejected.'
    );
    expect(words.answersSummary(read({ approvals, done: true }))).toBe(
      'All 5 answers they gave. None of them on MINTER decisions.'
    );
    expect(words.answersSummary(read({ done: true }))).toBe('No answers on chain.');
    expect(words.answersLeftOut(read({ leftOut: 1, unmatched: 2, decisionsRead: 3000 }))).toEqual([
      "Left out: 1 answer on transactions that aren't MINTER decisions.",
      'Not matched: 2 answers older than the newest 3,000 MINTER decisions read.',
    ]);
  });

  it('sums up poll votes and what was only counted', () => {
    const votes: PollVotes = {
      votes: [
        { answer: 'yes', pollName: 'a' },
        { answer: 'no', pollName: 'b' },
        { answer: null, pollName: 'b' },
      ] as PollVotes['votes'],
      adminBoard: 2,
      other: 1,
      truncated: true,
    };
    expect(words.pollVotesSummary(votes)).toBe(
      '3 votes in 2 original-app polls (in their newest 100 poll votes): 1 Yes, 1 No, 1 other or unread.'
    );
    expect(words.pollVotesCounted(votes)).toEqual([
      "2 votes on encrypted admin board cards' polls (counted only).",
      "1 vote on other apps' polls (counted only).",
    ]);
    expect(words.pollVotesSummary({ ...votes, votes: [], truncated: false })).toBe(
      "No votes in the original app's nomination or admin polls."
    );
  });

  it('says what was checked before saying there is nothing', () => {
    expect(words.NOTHING_IN_MINTER).toBe('Not in MINTER. No nominations, records or votes found.');
    expect(words.nothingChecked(27, 27)).toMatch(
      /all 27 original-app cards for ones about them\.$/
    );
    expect(words.nothingChecked(40, 421)).toMatch(/the newest 40 of 421 original-app cards/);
    expect(words.alsoChecked(['supports', 'Considering marks'])).toBe(
      'Also checked, nothing found: supports, Considering marks.'
    );
    expect(words.alsoChecked([])).toBe('');
  });

  it('never words a verdict', () => {
    const texts = [
      words.NOTHING_IN_MINTER,
      words.PROFILE_HINT,
      words.NO_NAME_RECORDS,
      ...Object.values(words.NOMINATION_STATE_WORDS),
      words.nothingChecked(1, 2),
      words.answersLeftOut(read({ leftOut: 1, unmatched: 1 })).join(' '),
    ].join(' ');
    expect(texts).not.toMatch(
      /\b(alt|suspicious|same person|fraud|strong|weak|strongest|consolidation)\b/i
    );
  });
});
