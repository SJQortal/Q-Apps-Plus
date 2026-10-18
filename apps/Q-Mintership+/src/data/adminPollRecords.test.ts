import { describe, expect, it } from 'vitest';
import { fakeAddress } from '../../e2e/world.mjs';
import {
  ADMIN_POLL_SERVICE,
  DAY_MS,
  DETAILS_MAX,
  DURATION_DEFAULT_DAYS,
  QUESTION_MAX,
  QUESTION_MIN,
  READERS_MAX,
  SHARE_COMMENTS_MAX,
  SHARE_VOTES_MAX,
  buildDeletedPollComment,
  buildPoll,
  buildPollComment,
  buildShare,
  buildVote,
  fromData64,
  isDuration,
  isPollId,
  normaliseQuestion,
  parsePoll,
  parsePollAt,
  parsePollComment,
  parsePollRecordIdentifier,
  parseReaders,
  parseShare,
  parseVote,
  pollCommentIdentifier,
  pollCommentSearchPrefix,
  pollEnd,
  pollIdentifier,
  pollInputProblems,
  randomPollId,
  shareIdentifier,
  voteIdentifier,
  DEFAULT_ANSWERS,
  pollAnswers,
  type PollRecord,
} from './adminPollRecords';
import { toData64 } from './records';

const A = fakeAddress('poll-a');
const B = fakeAddress('poll-b');
const C = fakeAddress('poll-c');
const ID = 'k3x9m2pq';
const T0 = 1_791_000_000_000;

function poll(over: Partial<PollRecord> = {}): PollRecord {
  return {
    v: 1,
    id: ID,
    question: 'Should only level 5+ minters become Minter Admins?',
    durationDays: 7,
    createdAt: T0,
    endsAt: T0 + 7 * DAY_MS,
    endHeight: 2_765_800,
    readers: [A, B],
    ...over,
  };
}

const commentId = (cid = 'abc123', pollId = ID) => `qmp-admincomment-${pollId}-${cid}`;

describe('identifiers', () => {
  it('builds one per record kind, within QDN’s 64 characters', () => {
    expect(pollIdentifier(ID)).toBe(`qmp-adminpoll-${ID}`);
    expect(voteIdentifier(ID)).toBe(`qmp-adminvote-${ID}`);
    expect(shareIdentifier(ID)).toBe(`qmp-adminshare-${ID}`);
    expect(pollCommentIdentifier(ID, 'zz9a01')).toBe(`qmp-admincomment-${ID}-zz9a01`);
    expect(pollCommentSearchPrefix(ID)).toBe(`qmp-admincomment-${ID}-`);
    for (const identifier of [
      pollIdentifier(ID),
      voteIdentifier(ID),
      shareIdentifier(ID),
      pollCommentIdentifier(ID),
    ])
      expect(identifier.length).toBeLessThanOrEqual(64);
    expect(ADMIN_POLL_SERVICE).toBe('DOCUMENT_PRIVATE');
  });

  it('a new comment gets a random 6-character id', () => {
    const identifier = pollCommentIdentifier(ID);
    expect(identifier).toMatch(new RegExp(`^qmp-admincomment-${ID}-[a-z0-9]{6}$`));
  });

  it('refuses a malformed poll id or comment id', () => {
    for (const bad of ['', 'short', 'UPPERCAS', 'k3x9m2pq1', 'k3x9-2pq', ' k3x9m2p'])
      expect(() => pollIdentifier(bad)).toThrow('Not a poll.');
    expect(() => voteIdentifier('nope')).toThrow();
    expect(() => shareIdentifier('nope')).toThrow();
    expect(() => pollCommentIdentifier(ID, 'ABC123')).toThrow(/6 lowercase/);
    expect(() => pollCommentIdentifier(ID, 'abc12')).toThrow(/6 lowercase/);
  });

  it('reads the kind and the poll of an identifier, and nothing else', () => {
    expect(parsePollRecordIdentifier(`qmp-adminpoll-${ID}`)).toEqual({ kind: 'poll', pollId: ID });
    expect(parsePollRecordIdentifier(`qmp-adminvote-${ID}`)).toEqual({ kind: 'vote', pollId: ID });
    expect(parsePollRecordIdentifier(`qmp-adminshare-${ID}`)).toEqual({
      kind: 'share',
      pollId: ID,
    });
    expect(parsePollRecordIdentifier(commentId('zz9a01'))).toEqual({
      kind: 'comment',
      pollId: ID,
      cid: 'zz9a01',
    });
    for (const bad of [
      null,
      42,
      `qmp-adminpoll-${ID}x`,
      `qmp-adminpoll-${ID.toUpperCase()}`,
      `qmp-adminvote-${ID}-abc123`,
      `qmp-admincomment-${ID}`,
      `qmp-admincomment-${ID}-abc12`,
      `qmp-admincomment-${ID}-abc123-x`,
      `qmp-comment-${ID}-abc123`,
      `xqmp-adminpoll-${ID}`,
      'qmp-adminpoll-'.padEnd(70, 'a'),
    ])
      expect(parsePollRecordIdentifier(bad)).toBeNull();
  });

  it('random poll ids are 8 lowercase letters or digits, skipping biased bytes', () => {
    for (let i = 0; i < 20; i++) expect(isPollId(randomPollId())).toBe(true);
    // Bytes 252–255 would favour the first four characters: they are skipped.
    let call = 0;
    const id = randomPollId((bytes) => {
      call++;
      bytes.fill(call === 1 ? 255 : 0);
      if (call === 1) bytes[3] = 1;
      return bytes;
    });
    expect(id).toBe('baaaaaaa');
    expect(isPollId('k3x9m2pq')).toBe(true);
    expect(isPollId('K3X9M2PQ')).toBe(false);
    expect(isPollId(12345678)).toBe(false);
  });
});

describe('a poll someone is writing', () => {
  it('one line, plain: whitespace collapses, control and bidi characters go', () => {
    expect(normaliseQuestion('  Should   we\n\tdo this?  ')).toBe('Should we do this?');
    expect(normaliseQuestion('Yes ‮ no\u0007')).toBe('Yes no');
  });

  it('the question is 10–200 characters, details up to 2,000, 1–30 whole days', () => {
    const ok = { question: 'x'.repeat(QUESTION_MIN), durationDays: 1 };
    expect(pollInputProblems(ok)).toEqual([]);
    expect(
      pollInputProblems({ ...ok, question: 'x'.repeat(QUESTION_MAX), durationDays: 30 })
    ).toEqual([]);
    expect(pollInputProblems({ ...ok, question: '  short  q ' })).toEqual([
      'Write a question of at least 10 characters.',
    ]);
    expect(pollInputProblems({ ...ok, question: 'x'.repeat(QUESTION_MAX + 1) })).toEqual([
      'Keep the question under 200 characters.',
    ]);
    expect(pollInputProblems({ ...ok, details: 'd'.repeat(DETAILS_MAX) })).toEqual([]);
    expect(pollInputProblems({ ...ok, details: 'd'.repeat(DETAILS_MAX + 1) })).toEqual([
      'Keep the details under 2,000 characters.',
    ]);
    for (const durationDays of [0, 31, 1.5, Number.NaN, -7])
      expect(pollInputProblems({ ...ok, durationDays })).toEqual([
        'Pick a duration of 1 to 30 days.',
      ]);
    expect(pollInputProblems({ question: '', details: null, durationDays: 0 })).toHaveLength(2);
    expect(DURATION_DEFAULT_DAYS).toBe(7);
    expect(isDuration(7)).toBe(true);
    expect(isDuration('7')).toBe(false);
  });
});

describe('pollEnd: from the measured block time', () => {
  const clock = { height: 2_757_500, timestamp: T0 - 30_000, msPerBlock: 72_900 };

  it('whole blocks rounded up; endsAt on a block, its height from the tip', () => {
    const { endsAt, endHeight } = pollEnd(clock, 7, T0);
    const blocks = Math.ceil((7 * DAY_MS) / 72_900); // 8,297
    expect(blocks).toBe(8297);
    expect(endsAt).toBe(T0 + blocks * 72_900);
    expect(endsAt - T0).toBeGreaterThanOrEqual(7 * DAY_MS);
    expect(endsAt - T0).toBeLessThan(7 * DAY_MS + 72_900);
    // The tip is 30 s behind the moment it was asked: still the same block count from it.
    expect(endHeight).toBe(2_757_500 + Math.round((endsAt - clock.timestamp) / 72_900));
    expect(endHeight).toBe(2_757_500 + 8297);
  });

  it('a slower chain ends at a lower height but the same time', () => {
    const slow = pollEnd({ ...clock, msPerBlock: 90_000 }, 1, T0);
    expect(slow.endsAt).toBe(T0 + 960 * 90_000);
    expect(slow.endHeight).toBe(2_757_500 + 960);
  });

  it('refuses a duration out of range or no block time', () => {
    expect(() => pollEnd(clock, 0, T0)).toThrow(/1 to 30 days/);
    expect(() => pollEnd(clock, 31, T0)).toThrow(/1 to 30 days/);
    expect(() => pollEnd({ ...clock, msPerBlock: 0 }, 7, T0)).toThrow(/block time/);
  });
});

describe('parsePoll', () => {
  it('accepts a valid poll, normalised, and checks its id against where it was read', () => {
    const body = { ...poll(), question: '  Should only level 5+   minters become Minter Admins? ' };
    expect(parsePoll(body)).toEqual(poll());
    expect(parsePoll(body, ID)).toEqual(poll());
    expect(parsePoll(body, 'zzzzzzzz')).toBeNull();
    expect(parsePollAt(body, pollIdentifier(ID))).toEqual(poll());
    expect(parsePollAt(body, pollIdentifier('zzzzzzzz'))).toBeNull();
    expect(parsePollAt(body, voteIdentifier(ID))).toBeNull();
  });

  it('keeps details, drops empty ones, and refuses long or non-text ones', () => {
    expect(parsePoll({ ...poll(), details: '  Some\r\ncontext  ' })?.details).toBe('Some\ncontext');
    expect(parsePoll({ ...poll(), details: '   ' })).not.toHaveProperty('details');
    expect(parsePoll({ ...poll(), details: 'd'.repeat(DETAILS_MAX + 1) })).toBeNull();
    expect(parsePoll({ ...poll(), details: 42 })).toBeNull();
  });

  it('refuses anything malformed', () => {
    const bad: unknown[] = [
      null,
      'text',
      [],
      { ...poll(), v: 2 },
      { ...poll(), id: 'BAD' },
      { ...poll(), question: 'too short' },
      { ...poll(), question: 'x'.repeat(QUESTION_MAX + 1) },
      { ...poll(), question: 42 },
      { ...poll(), durationDays: 0 },
      { ...poll(), durationDays: 31 },
      { ...poll(), durationDays: 7.5 },
      { ...poll(), createdAt: '1' },
      { ...poll(), endsAt: T0 },
      { ...poll(), endsAt: T0 - 1 },
      { ...poll(), endsAt: T0 + 8 * DAY_MS + 1 },
      { ...poll(), endHeight: 0 },
      { ...poll(), readers: [] },
      { ...poll(), readers: 'everyone' },
      { ...poll(), readers: [A, 'not-an-address'] },
    ];
    for (const body of bad) expect(parsePoll(body)).toBeNull();
    // A day of slack on the duration is allowed (a slow tip), no more.
    expect(parsePoll({ ...poll(), endsAt: T0 + 8 * DAY_MS })).not.toBeNull();
  });

  it('readers: addresses only, each once, at most 100', () => {
    expect(parseReaders([A, B, A])).toEqual([A, B]);
    expect(
      parseReaders(Array.from({ length: READERS_MAX }, (_, i) => fakeAddress(`r${i}`)))
    ).toHaveLength(READERS_MAX);
    expect(
      parseReaders(Array.from({ length: READERS_MAX + 1 }, (_, i) => fakeAddress(`r${i}`)))
    ).toBeNull();
    expect(parseReaders(null)).toBeNull();
  });
});

describe('votes', () => {
  it('Yes, No or Neutral, about the poll its identifier names', () => {
    for (const vote of ['yes', 'no', 'neutral'] as const) {
      expect(buildVote(ID, vote)).toEqual({ v: 1, pollId: ID, vote });
      expect(parseVote({ v: 1, pollId: ID, vote }, voteIdentifier(ID))).toEqual({
        v: 1,
        pollId: ID,
        vote,
      });
    }
    expect(parseVote({ v: 1, pollId: ID, vote: 'maybe' }, voteIdentifier(ID))).toBeNull();
    expect(parseVote({ v: 1, pollId: 'zzzzzzzz', vote: 'yes' }, voteIdentifier(ID))).toBeNull();
    expect(parseVote({ v: 1, pollId: ID, vote: 'yes' }, pollIdentifier(ID))).toBeNull();
    expect(parseVote({ v: 2, pollId: ID, vote: 'yes' }, voteIdentifier(ID))).toBeNull();
    expect(parseVote(['yes'], voteIdentifier(ID))).toBeNull();
    expect(() => buildVote(ID, 'maybe' as never)).toThrow('A vote is one of the poll’s answers.');
    expect(() => buildVote('bad', 'yes')).toThrow('Not a poll.');
  });
});

describe('comments on a poll', () => {
  const me = commentId('abc123');
  const other = commentId('def456');

  it('plain text up to 1,000 characters; a reply answers another comment on the same poll', () => {
    expect(
      buildPollComment({ pollId: ID, text: '  Agreed.\r\n\n\n\nSee qortal://APP/Q-Tube ' })
    ).toEqual({
      v: 1,
      pollId: ID,
      text: 'Agreed.\n\nSee qortal://APP/Q-Tube',
    });
    expect(buildPollComment({ pollId: ID, text: 'Yes', replyTo: other, edited: true })).toEqual({
      v: 1,
      pollId: ID,
      text: 'Yes',
      replyTo: other,
      edited: true,
    });
    expect(() => buildPollComment({ pollId: ID, text: '  ' })).toThrow('Write something first.');
    expect(() => buildPollComment({ pollId: ID, text: 'x'.repeat(1001) })).toThrow(/1,000/);
    expect(() =>
      buildPollComment({ pollId: ID, text: 'Hi', replyTo: commentId('abc123', 'zzzzzzzz') })
    ).toThrow('That reply has nothing to answer.');
    expect(() => buildPollComment({ pollId: 'bad', text: 'Hi' })).toThrow('Not a poll.');
  });

  it('a deletion keeps the place and the reply it was', () => {
    expect(buildDeletedPollComment({ pollId: ID, replyTo: other })).toEqual({
      v: 1,
      pollId: ID,
      text: '',
      deleted: true,
      replyTo: other,
    });
    expect(buildDeletedPollComment({ pollId: ID, replyTo: 'qmp-comment-x' })).not.toHaveProperty(
      'replyTo'
    );
  });

  it('parses what it builds, and refuses what doesn’t fit its identifier', () => {
    const record = buildPollComment({ pollId: ID, text: 'Fine by me', replyTo: other });
    expect(parsePollComment(record, me)).toEqual(record);
    const deleted = buildDeletedPollComment({ pollId: ID });
    expect(parsePollComment({ ...deleted, text: 'ignored' }, me)).toEqual(deleted);
    const bad: unknown[] = [
      { ...record, pollId: 'zzzzzzzz' },
      { ...record, v: 2 },
      { ...record, text: '' },
      { ...record, text: 'x'.repeat(1001) },
      { ...record, text: 7 },
      { ...record, replyTo: me },
      { ...record, replyTo: commentId('abc123', 'zzzzzzzz') },
      { ...record, edited: 'yes' },
      { ...record, deleted: false },
      null,
    ];
    for (const body of bad) expect(parsePollComment(body, me)).toBeNull();
    expect(parsePollComment(record, voteIdentifier(ID))).toBeNull();
  });
});

describe('shares', () => {
  const share = (over: Record<string, unknown> = {}) => ({
    v: 1,
    pollId: ID,
    poll: poll(),
    pollPublisher: 'Admin B',
    votes: [
      { name: 'Admin B', vote: 'yes', updated: T0 + 1000 },
      { name: 'Admin C', vote: 'no', updated: T0 + 2000 },
    ],
    comments: [
      {
        name: 'Admin C',
        identifier: commentId('aaaaaa'),
        postedAt: T0 + 3000,
        updatedAt: T0 + 3000,
        text: 'Hmm.',
      },
    ],
    readers: [A, B, C],
    sharedAt: T0 + 5000,
    ...over,
  });

  it('round-trips: a poll copy, its votes and comments, and who it was encrypted to', () => {
    const parsed = parseShare(share(), shareIdentifier(ID));
    expect(parsed).toEqual(share());
    const built = buildShare({
      poll: poll(),
      pollPublisher: 'Admin B',
      votes: share().votes as never,
      comments: share().comments as never,
      readers: [A, B, C, A],
      sharedAt: T0 + 5000,
    });
    expect(built).toEqual(share());
  });

  it('refuses a copy of another poll, a malformed poll, or missing readers', () => {
    expect(parseShare(share({ pollId: 'zzzzzzzz' }), shareIdentifier(ID))).toBeNull();
    expect(parseShare(share({ poll: poll({ id: 'zzzzzzzz' }) }), shareIdentifier(ID))).toBeNull();
    expect(
      parseShare(share({ poll: { ...poll(), question: 'no' } }), shareIdentifier(ID))
    ).toBeNull();
    expect(parseShare(share({ readers: [] }), shareIdentifier(ID))).toBeNull();
    expect(parseShare(share({ pollPublisher: '' }), shareIdentifier(ID))).toBeNull();
    expect(parseShare(share({ sharedAt: 'now' }), shareIdentifier(ID))).toBeNull();
    expect(parseShare(share({ votes: 'all' }), shareIdentifier(ID))).toBeNull();
    expect(parseShare(share(), pollIdentifier(ID))).toBeNull();
    expect(() =>
      buildShare({
        poll: poll(),
        pollPublisher: '',
        votes: [],
        comments: [],
        readers: [A],
        sharedAt: T0,
      })
    ).toThrow(/isn’t complete/);
  });

  it('drops malformed votes and comments, keeps each voter’s newest, caps the lists', () => {
    const parsed = parseShare(
      share({
        votes: [
          { name: 'Admin B', vote: 'yes', updated: T0 + 1000 },
          { name: 'Admin B', vote: 'no', updated: T0 + 9000 },
          { name: 'Admin B', vote: 'neutral', updated: T0 + 5000 },
          { name: 'Admin D', vote: 'maybe', updated: T0 },
          { name: '', vote: 'yes', updated: T0 },
          { name: 'Admin E', vote: 'yes' },
        ],
        comments: [
          {
            name: 'Admin C',
            identifier: commentId('bbbbbb', 'zzzzzzzz'),
            postedAt: T0,
            updatedAt: T0,
            text: 'Another poll',
          },
          {
            name: 'Admin C',
            identifier: commentId('cccccc'),
            postedAt: T0 + 10,
            updatedAt: T0,
            text: 'Edited before it was posted',
          },
          {
            name: 'Admin C',
            identifier: commentId('dddddd'),
            postedAt: T0,
            updatedAt: T0 + 50,
            text: 'ignored',
            deleted: true,
          },
        ],
      }),
      shareIdentifier(ID)
    );
    expect(parsed?.votes).toEqual([{ name: 'Admin B', vote: 'no', updated: T0 + 9000 }]);
    expect(parsed?.comments).toEqual([
      {
        name: 'Admin C',
        identifier: commentId('dddddd'),
        postedAt: T0,
        updatedAt: T0 + 50,
        text: '',
        deleted: true,
      },
    ]);
    const many = parseShare(
      share({
        votes: Array.from({ length: SHARE_VOTES_MAX + 10 }, (_, i) => ({
          name: `Voter ${i}`,
          vote: 'yes',
          updated: T0 + i,
        })),
        comments: Array.from({ length: SHARE_COMMENTS_MAX + 10 }, (_, i) => ({
          name: `Writer ${i}`,
          identifier: commentId('eeeeee'),
          postedAt: T0 + i,
          updatedAt: T0 + i,
          text: `Comment ${i}`,
        })),
      }),
      shareIdentifier(ID)
    );
    expect(many?.votes).toHaveLength(SHARE_VOTES_MAX);
    expect(many?.comments).toHaveLength(SHARE_COMMENTS_MAX);
  });
});

describe('buildPoll', () => {
  it('builds what readers accept, normalised, readers each once', () => {
    const built = buildPoll({
      id: ID,
      question: '  Should only level 5+ minters become Minter Admins? ',
      details: '  Context here.  ',
      durationDays: 7,
      createdAt: T0,
      endsAt: T0 + 7 * DAY_MS,
      endHeight: 2_765_800,
      readers: [A, B, A],
    });
    expect(built).toEqual({ ...poll(), details: 'Context here.' });
    expect(parsePoll(built, ID)).toEqual(built);
  });

  it('throws on a problem, in plain words', () => {
    const base = {
      id: ID,
      question: 'Should only level 5+ minters become Minter Admins?',
      durationDays: 7,
      createdAt: T0,
      endsAt: T0 + 7 * DAY_MS,
      endHeight: 2_765_800,
      readers: [A],
    };
    expect(() => buildPoll({ ...base, question: 'short' })).toThrow(/at least 10/);
    expect(() => buildPoll({ ...base, durationDays: 31 })).toThrow(/1 to 30 days/);
    expect(() => buildPoll({ ...base, readers: [] })).toThrow(/isn’t complete/);
    expect(() => buildPoll({ ...base, id: 'BAD' })).toThrow(/isn’t complete/);
  });
});

describe('fromData64', () => {
  it('reads back UTF-8 JSON published as data64', () => {
    const value = { v: 1, text: 'Zoë says “hi” ΑΩ 🙂' };
    expect(fromData64(toData64(value))).toEqual(value);
    expect(() => fromData64('not base64!')).toThrow();
    expect(() => fromData64(btoa('\xff\xfe'))).toThrow();
  });
});

describe('a poll’s own answers (Simon, 2026-10-18)', () => {
  const custom = [
    { id: 'yes', label: 'Approve', tone: 'green' as const },
    { id: 'no', label: 'Reject', tone: 'red' as const },
    { id: 'neutral', label: 'Abstain', tone: 'neutral' as const },
    { id: 'opt4', label: 'Wait a month', tone: 'neutral' as const },
  ];
  const base = {
    id: ID,
    question: 'Should only level 5+ minters become Minter Admins?',
    durationDays: 7,
    createdAt: T0,
    endsAt: T0 + 7 * DAY_MS,
    endHeight: 2_765_800,
    readers: [A, B],
  };

  it('writes answers only when they differ from Yes, No and Neutral', () => {
    expect(buildPoll(base).answers).toBeUndefined();
    expect(buildPoll({ ...base, answers: DEFAULT_ANSWERS }).answers).toBeUndefined();
    expect(pollAnswers(buildPoll(base))).toEqual(DEFAULT_ANSWERS);
    const built = buildPoll({
      ...base,
      answers: [{ ...custom[0], label: '  Approve  ' }, ...custom.slice(1)],
    });
    expect(built.answers).toEqual(custom);
    expect(parsePoll(JSON.parse(JSON.stringify(built)), ID)).toEqual(built);
  });

  it('reads a poll without answers as Yes, No and Neutral (every earlier poll)', () => {
    expect(pollAnswers(parsePoll(poll(), ID)!)).toEqual(DEFAULT_ANSWERS);
  });

  it('turns down answers that can’t be told apart, or too few, too many, or odd colours', () => {
    const bad = (answers: unknown) => parsePoll({ ...poll(), answers }, ID);
    expect(bad([custom[0]])).toBeNull();
    expect(
      bad([
        ...custom,
        { id: 'opt5', label: 'E', tone: 'red' },
        { id: 'opt6', label: 'F', tone: 'red' },
        { id: 'opt4', label: 'G', tone: 'red' },
      ])
    ).toBeNull();
    expect(bad([custom[0], { ...custom[1], label: 'approve' }])).toBeNull();
    expect(bad([custom[0], { ...custom[1], id: 'yes' }])).toBeNull();
    expect(bad([custom[0], { ...custom[1], tone: 'blue' }])).toBeNull();
    expect(bad([custom[0], { ...custom[1], id: 'opt9' }])).toBeNull();
    expect(bad([custom[0], { ...custom[1], label: '   ' }])).toBeNull();
    expect(() => buildPoll({ ...base, answers: [custom[0]] })).toThrow(/at least 2 answers/);
  });

  it('takes a vote for an added answer, as its id', () => {
    expect(buildVote(ID, 'opt4')).toEqual({ v: 1, pollId: ID, vote: 'opt4' });
    expect(parseVote({ v: 1, pollId: ID, vote: 'opt4' }, voteIdentifier(ID))?.vote).toBe('opt4');
    expect(parseVote({ v: 1, pollId: ID, vote: 'opt9' }, voteIdentifier(ID))).toBeNull();
  });
});
