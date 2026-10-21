import { describe, expect, it } from 'vitest';
import { fakeAddress } from '../../e2e/world.mjs';
import {
  DAY_MS,
  pollIdentifier,
  shareIdentifier,
  voteIdentifier,
  type PollRecord,
  type PollVote,
} from '../data/adminPollRecords';
import {
  CLOCK_SLACK_MS,
  CLOSED_SHOWN_MS,
  TIP_LEAD_MS,
  VOTE_CUTOFF_MS,
  askedInTime,
  assemblePoll,
  chainBoundNow,
  assemblePolls,
  copiedInTime,
  countVotes,
  groupPollRows,
  isPollOpen,
  isPollShown,
  missingReaders,
  needsShareRead,
  pollCommentRows,
  pollReaders,
  pollRowFor,
  pollThreadSources,
  pollsWaitingForVote,
  resolvePoll,
  shareCommentCopies,
  sortPolls,
  tallyVotes,
  toCommentRecord,
  validShares,
  voteEntries,
  voteTooLate,
  type BodyRead,
  type CountedVote,
  type PollContext,
  type PollRow,
  type PollSources,
  type ReadRow,
} from './adminPolls';

const ID = 'k3x9m2pq';
const T0 = 1_791_000_000_000;
const NOW = T0 + 2 * DAY_MS;

// Admins (who can sign), a former admin, a member, and the null owner.
const ADMINS = ['Avery', 'Bea', 'Cal', 'Dee', 'Eve'] as const;
const ADDR: Record<string, string> = Object.fromEntries(
  [...ADMINS, 'Former', 'Member', 'Second'].map((n) => [n, fakeAddress(`rules-poll-${n}`)])
);
// Dee also owns "Second": two names, one admin.
ADDR.Second = ADDR.Dee;
const SIGNERS = ADMINS.map((n) => ADDR[n]);
const NEW_ADMIN = fakeAddress('rules-poll-new');

const ctx = (over: Partial<PollContext> = {}): PollContext => ({
  now: NOW,
  signers: SIGNERS,
  publisherOf: (name) => ADDR[name] ?? null,
  viewer: ADDR.Avery,
  ...over,
});

const ok = (value: unknown): BodyRead => ({ status: 'ok', value });
const locked: BodyRead = { status: 'locked' };

function poll(over: Partial<PollRecord> = {}): PollRecord {
  return {
    v: 1,
    id: ID,
    question: 'Should only level 5+ minters become Minter Admins?',
    durationDays: 7,
    createdAt: T0,
    endsAt: T0 + 7 * DAY_MS,
    endHeight: 2_765_800,
    readers: SIGNERS,
    ...over,
  };
}

const row = (name: string, identifier: string, created: number, updated?: number): PollRow => ({
  name,
  identifier,
  created,
  ...(updated ? { updated } : {}),
});

const pollRead = (name = 'Bea', body: BodyRead = ok(poll()), created = T0 + 5_000): ReadRow => ({
  row: row(name, pollIdentifier(ID), created),
  body,
});

const voteRead = (name: string, vote: PollVote | string, at: number, body?: BodyRead): ReadRow => ({
  row: row(name, voteIdentifier(ID), T0 + 1000, at),
  body: body ?? ok({ v: 1, pollId: ID, vote }),
});

const share = (over: Record<string, unknown> = {}) => ({
  v: 1,
  pollId: ID,
  poll: poll(),
  pollPublisher: 'Bea',
  votes: [] as Array<{ name: string; vote: string; updated: number }>,
  comments: [] as unknown[],
  readers: [...SIGNERS, NEW_ADMIN],
  sharedAt: T0 + DAY_MS,
  ...over,
});

const shareRead = (name: string, body: unknown = share(), created = T0 + DAY_MS): ReadRow => ({
  row: row(name, shareIdentifier(ID), created),
  body: ok(body),
});

const commentIdent = (cid: string) => `qmp-admincomment-${ID}-${cid}`;

function sources(over: Partial<PollSources> = {}): PollSources {
  return { pollId: ID, polls: [pollRead()], votes: [], shares: [], comments: [], ...over };
}

describe('grouping search rows by poll', () => {
  it('each kind from its own list; malformed identifiers and nameless rows left out', () => {
    const groups = groupPollRows({
      polls: [
        row('Bea', pollIdentifier(ID), T0),
        row('Bea', voteIdentifier(ID), T0),
        row('', pollIdentifier('zzzzzzzz'), T0),
      ],
      votes: [row('Cal', voteIdentifier(ID), T0), row('Cal', 'qmp-adminvote-bad', T0)],
      shares: [row('Dee', shareIdentifier('zzzzzzzz'), T0)],
      comments: [row('Eve', commentIdent('abc123'), T0), row('Eve', pollIdentifier(ID), T0)],
    });
    expect([...groups.keys()].sort()).toEqual([ID, 'zzzzzzzz']);
    const g = groups.get(ID)!;
    expect(g.polls.map((r) => r.name)).toEqual(['Bea']);
    expect(g.votes.map((r) => r.name)).toEqual(['Cal']);
    expect(g.comments.map((r) => r.name)).toEqual(['Eve']);
    expect(groups.get('zzzzzzzz')!.shares).toHaveLength(1);
    expect(groups.get('zzzzzzzz')!.polls).toHaveLength(0);
  });
});

describe('trust: only current Minter Admins’ records count', () => {
  it('a poll from a former admin or a member is not shown, even when readable', () => {
    expect(assemblePoll(sources({ polls: [pollRead('Former')] }), ctx())).toBeNull();
    expect(assemblePoll(sources({ polls: [pollRead('Member')] }), ctx())).toBeNull();
    expect(assemblePoll(sources({ polls: [pollRead('Nobody')] }), ctx())).toBeNull();
  });

  it('the publisher comes from the row: a body can’t claim another asker', () => {
    const view = assemblePoll(sources({ polls: [pollRead('Cal')] }), ctx());
    expect(view?.publisher).toEqual({ name: 'Cal', address: ADDR.Cal });
  });

  it('per id, the earliest poll row from a current admin is the poll', () => {
    const real = pollRead('Bea', ok(poll()), T0 + 1000);
    const copy = pollRead(
      'Cal',
      ok(poll({ question: 'A different question entirely?' })),
      T0 + 2000
    );
    const fake = pollRead('Member', ok(poll({ question: 'Fake question from a member?' })), T0);
    expect(pollRowFor(sources({ polls: [copy, real, fake] }), ctx())?.row.name).toBe('Bea');
    const view = assemblePoll(sources({ polls: [copy, real, fake] }), ctx());
    expect(view?.poll.question).toBe(poll().question);
    // A tie on time goes to the first name.
    const tie = pollRowFor(
      sources({ polls: [pollRead('Cal', ok(poll()), T0), pollRead('Bea', ok(poll()), T0)] }),
      ctx()
    );
    expect(tie?.row.name).toBe('Bea');
  });

  it('votes, shares and comments from anyone but a current admin are ignored', () => {
    const view = assemblePoll(
      sources({
        votes: [voteRead('Member', 'yes', T0 + 10), voteRead('Former', 'no', T0 + 10)],
        shares: [
          shareRead('Member', share({ votes: [{ name: 'Cal', vote: 'yes', updated: T0 }] })),
        ],
        comments: [
          row('Member', commentIdent('abc123'), T0),
          row('Cal', commentIdent('def456'), T0),
        ],
      }),
      ctx()
    );
    expect(view?.votes).toEqual([]);
    expect(view?.shares).toEqual([]);
    expect(view?.commentRows.map((r) => r.name)).toEqual(['Cal']);
  });

  it('the null owner is not a signer, so nothing it published counts', () => {
    const nullOwner = fakeAddress('null-owner');
    const view = assemblePoll(
      sources({ votes: [voteRead('Owner', 'yes', T0 + 10)] }),
      ctx({ publisherOf: (n) => (n === 'Owner' ? nullOwner : (ADDR[n] ?? null)) })
    );
    expect(view?.votes).toEqual([]);
  });
});

describe('times: a body must fit its row', () => {
  it('a poll was asked when its row says (up to 10 minutes later, a day earlier)', () => {
    expect(askedInTime({ createdAt: T0 }, T0)).toBe(true);
    expect(askedInTime({ createdAt: T0 + CLOCK_SLACK_MS }, T0)).toBe(true);
    expect(askedInTime({ createdAt: T0 + CLOCK_SLACK_MS + 1 }, T0)).toBe(false);
    expect(askedInTime({ createdAt: T0 - DAY_MS }, T0)).toBe(true);
    expect(askedInTime({ createdAt: T0 - DAY_MS - 1 }, T0)).toBe(false);
    expect(copiedInTime({ createdAt: T0 + CLOCK_SLACK_MS }, T0)).toBe(true);
    expect(copiedInTime({ createdAt: T0 + CLOCK_SLACK_MS + 1 }, T0)).toBe(false);
    expect(copiedInTime({ createdAt: T0 - 30 * DAY_MS }, T0)).toBe(true);
  });

  it('a poll body that claims another time than its row is not shown', () => {
    const late = pollRead('Bea', ok(poll({ createdAt: T0 + DAY_MS, endsAt: T0 + 8 * DAY_MS })));
    expect(assemblePoll(sources({ polls: [late] }), ctx())).toBeNull();
  });
});

describe('times a write uses: the chain’s, not only the device’s', () => {
  it('a poll is dated by the device clock, kept between the tip and a few minutes past it', () => {
    expect(chainBoundNow(T0, T0 + 30_000)).toBe(T0 + 30_000);
    // A clock 20 minutes fast: no later than the tip and a few minutes.
    expect(chainBoundNow(T0, T0 + 20 * 60_000)).toBe(T0 + TIP_LEAD_MS);
    // A clock an hour slow: the tip's time.
    expect(chainBoundNow(T0, T0 - 3_600_000)).toBe(T0);
    // So its readers keep it: within the slack of the row the node stamps.
    expect(askedInTime({ createdAt: chainBoundNow(T0, T0 + DAY_MS) }, T0)).toBe(true);
  });

  it('no vote is started in the last minutes, nor after the end', () => {
    const END = T0 + 7 * DAY_MS;
    expect(voteTooLate({ endsAt: END }, END - VOTE_CUTOFF_MS)).toBeNull();
    expect(voteTooLate({ endsAt: END }, END - VOTE_CUTOFF_MS + 1)).toBe('closing');
    expect(voteTooLate({ endsAt: END }, END)).toBe('ended');
  });
});

describe('a poll read from a share', () => {
  it('the viewer can’t read the poll: the newest share’s copy, shown as shared by its admin', () => {
    const older = shareRead(
      'Cal',
      share({ poll: poll({ question: 'The older copy of the poll?' }) }),
      T0 + DAY_MS
    );
    const newer = shareRead('Dee', share(), T0 + 2 * DAY_MS);
    const view = assemblePoll(
      sources({ polls: [pollRead('Bea', locked)], shares: [older, newer] }),
      ctx()
    );
    expect(view?.poll).toEqual(poll());
    expect(view?.sharedBy).toEqual({ name: 'Dee', address: ADDR.Dee });
    expect(view?.publisher).toEqual({ name: 'Bea', address: ADDR.Bea });
    expect(view?.postedAt).toBe(T0 + 5_000);
    expect(view?.shares.map((s) => s.name)).toEqual(['Dee', 'Cal']);
  });

  it('works without the poll row too (a search that stopped early)', () => {
    const view = assemblePoll(sources({ polls: [], shares: [shareRead('Cal')] }), ctx());
    expect(view?.sharedBy?.name).toBe('Cal');
    expect(view?.publisher.name).toBe('Bea');
    expect(view?.postedAt).toBe(T0);
  });

  it('ignores a share whose asker isn’t the poll row’s name, or isn’t a current admin', () => {
    const wrongAsker = shareRead('Cal', share({ pollPublisher: 'Dee' }));
    const formerAsker = shareRead('Cal', share({ pollPublisher: 'Former' }));
    expect(
      assemblePoll(sources({ polls: [pollRead('Bea', locked)], shares: [wrongAsker] }), ctx())
    ).toBeNull();
    expect(assemblePoll(sources({ polls: [], shares: [formerAsker] }), ctx())).toBeNull();
    // The asker's own poll row from a former admin: no share brings it back.
    expect(
      assemblePoll(sources({ polls: [pollRead('Former', locked)], shares: [formerAsker] }), ctx())
    ).toBeNull();
  });

  it('ignores a copy asked after it was shared, a share of another poll, and a malformed one', () => {
    const future = shareRead(
      'Cal',
      share({ poll: poll({ createdAt: T0 + 2 * DAY_MS, endsAt: T0 + 9 * DAY_MS }) }),
      T0 + DAY_MS
    );
    const other = { row: row('Cal', shareIdentifier('zzzzzzzz'), T0 + DAY_MS), body: ok(share()) };
    const malformed = shareRead('Cal', { v: 1 });
    const src = sources({ polls: [pollRead('Bea', locked)], shares: [future, other, malformed] });
    expect(validShares(src, ctx())).toEqual([]);
    expect(resolvePoll(src, ctx())).toBeNull();
  });

  it('the viewer’s own read of the poll wins over any share', () => {
    const view = assemblePoll(
      sources({
        shares: [shareRead('Cal', share({ poll: poll({ question: 'A changed copy of it?' }) }))],
      }),
      ctx()
    );
    expect(view?.poll.question).toBe(poll().question);
    expect(view?.sharedBy).toBeNull();
  });

  it('nothing readable: not shown (skipped quietly)', () => {
    expect(assemblePoll(sources({ polls: [pollRead('Bea', locked)] }), ctx())).toBeNull();
    expect(
      assemblePoll(sources({ polls: [pollRead('Bea', { status: 'unavailable' })] }), ctx())
    ).toBeNull();
    expect(assemblePoll(sources({ polls: [pollRead('Bea', ok({ v: 1 }))] }), ctx())).toBeNull();
  });
});

describe('counting votes', () => {
  const END = T0 + 7 * DAY_MS;
  const v = (
    name: string,
    vote: PollVote,
    at: number,
    via: 'direct' | 'share' = 'direct'
  ): CountedVote => ({ name, address: ADDR[name], vote, at, via });

  it('each admin’s latest vote counts', () => {
    const { counted, late } = countVotes(
      [v('Bea', 'yes', T0 + 1), v('Bea', 'no', T0 + 5), v('Cal', 'neutral', T0 + 3)],
      END
    );
    expect(counted).toEqual([v('Cal', 'neutral', T0 + 3), v('Bea', 'no', T0 + 5)]);
    expect(late).toEqual([]);
  });

  it('a latest version published after the end doesn’t count (an older copy doesn’t either)', () => {
    const { counted, late } = countVotes(
      [v('Bea', 'yes', T0 + 1, 'share'), v('Bea', 'no', END + 1), v('Cal', 'yes', END)],
      END
    );
    expect(counted).toEqual([v('Cal', 'yes', END)]);
    expect(late).toEqual([v('Bea', 'no', END + 1)]);
  });

  it('per admin across their names: the latest that counts', () => {
    const { counted } = countVotes(
      [v('Dee', 'yes', T0 + 1), v('Second', 'no', T0 + 9), v('Second', 'no', T0 + 2)],
      END
    );
    expect(counted).toEqual([v('Second', 'no', T0 + 9)]);
    // The later name voted after the end: the other name's vote counts.
    const { counted: c2, late } = countVotes(
      [v('Dee', 'yes', T0 + 1), v('Second', 'no', END + 9)],
      END
    );
    expect(c2).toEqual([v('Dee', 'yes', T0 + 1)]);
    expect(late.map((x) => x.name)).toEqual(['Second']);
  });

  it('a vote the viewer read wins a tie with a share’s copy', () => {
    const { counted } = countVotes([v('Bea', 'yes', T0 + 1, 'share'), v('Bea', 'no', T0 + 1)], END);
    expect(counted).toEqual([v('Bea', 'no', T0 + 1)]);
  });

  it('counts a poll’s own answers, and no vote for an answer it doesn’t have', () => {
    const answers = [
      { id: 'yes', label: 'Approve', tone: 'green' as const },
      { id: 'opt4', label: 'Later', tone: 'neutral' as const },
    ];
    const view = assemblePoll(
      sources({
        polls: [pollRead('Bea', ok(poll({ answers })))],
        votes: [
          voteRead('Avery', 'yes', T0 + 10_000),
          voteRead('Cal', 'opt4', T0 + 11_000),
          // No (not one of its answers): no vote.
          voteRead('Dee', 'no', T0 + 12_000),
        ],
      }),
      ctx()
    )!;
    expect(view.counts).toEqual({ yes: 1, opt4: 1 });
    expect(view.votes.map((v) => [v.name, v.vote])).toEqual([
      ['Avery', 'yes'],
      ['Cal', 'opt4'],
    ]);
  });

  it('counts Yes, No and Neutral', () => {
    expect(tallyVotes([])).toEqual({ yes: 0, no: 0, neutral: 0 });
    expect(
      tallyVotes([{ vote: 'yes' }, { vote: 'no' }, { vote: 'yes' }, { vote: 'neutral' }])
    ).toEqual({ yes: 2, no: 1, neutral: 1 });
  });

  it('a poll’s votes: read, or from shares where the viewer can’t read them', () => {
    const src = sources({
      votes: [
        voteRead('Bea', 'yes', T0 + 100),
        voteRead('Cal', 'no', T0 + 200, locked),
        voteRead('Dee', 'maybe', T0 + 300),
        voteRead('Eve', 'neutral', T0 + 400, ok({ v: 1, pollId: 'zzzzzzzz', vote: 'yes' })),
      ],
      shares: [
        shareRead(
          'Eve',
          share({
            votes: [
              { name: 'Cal', vote: 'no', updated: T0 + 200 },
              { name: 'Member', vote: 'yes', updated: T0 + 250 },
            ],
          })
        ),
      ],
    });
    const entries = voteEntries(src, ctx());
    expect(entries.map((e) => [e.name, e.vote, e.via])).toEqual([
      ['Bea', 'yes', 'direct'],
      ['Cal', 'no', 'share'],
    ]);
    const view = assemblePoll(src, ctx({ viewer: ADDR.Cal }));
    expect(view?.counts).toEqual({ yes: 1, no: 1, neutral: 0 });
    expect(view?.myVote).toMatchObject({ name: 'Cal', vote: 'no', via: 'share' });
  });

  it('the viewer’s vote, or none yet', () => {
    const view = assemblePoll(sources({ votes: [voteRead('Bea', 'yes', T0 + 1)] }), ctx());
    expect(view?.myVote).toBeNull();
    const mine = assemblePoll(sources({ votes: [voteRead('Avery', 'neutral', T0 + 1)] }), ctx());
    expect(mine?.myVote).toMatchObject({ vote: 'neutral', address: ADDR.Avery });
  });
});

describe('votes: the rows decide, a share only fills in what the viewer can’t read', () => {
  const END = T0 + 7 * DAY_MS;
  const shareOf = (
    votes: Array<{ name: string; vote: string; updated: number }>,
    at = T0 + DAY_MS
  ) => shareRead('Bea', share({ votes }), at);

  it('a share can’t change a vote the viewer reads, whatever time it claims', () => {
    // A Minter Admin was added since, so every admin reads the shares.
    const src = sources({
      votes: [voteRead('Cal', 'no', T0 + 5)],
      shares: [shareOf([{ name: 'Cal', vote: 'yes', updated: END - 1 }])],
    });
    for (const viewer of [ADDR.Avery, ADDR.Bea, ADDR.Cal]) {
      const view = assemblePoll(src, ctx({ viewer, signers: [...SIGNERS, NEW_ADMIN] }))!;
      expect(view.votes).toEqual([
        { name: 'Cal', address: ADDR.Cal, vote: 'no', at: T0 + 5, via: 'direct' },
      ]);
      expect(view.counts).toEqual({ yes: 0, no: 1, neutral: 0 });
    }
  });

  it('a copy fills in a row the viewer can’t read only for that very version', () => {
    const same = sources({
      votes: [voteRead('Cal', 'no', T0 + 200, locked)],
      shares: [shareOf([{ name: 'Cal', vote: 'yes', updated: T0 + 200 }])],
    });
    expect(assemblePoll(same, ctx())?.votes).toEqual([
      { name: 'Cal', address: ADDR.Cal, vote: 'yes', at: T0 + 200, via: 'share', sharedBy: 'Bea' },
    ]);
    // Cal voted again since the share: the old copy isn’t Cal’s vote any more.
    const changed = sources({
      votes: [voteRead('Cal', 'no', T0 + 900, { status: 'unavailable' })],
      shares: [shareOf([{ name: 'Cal', vote: 'yes', updated: T0 + 200 }])],
    });
    const view = assemblePoll(changed, ctx())!;
    expect(view.votes).toEqual([]);
    expect(view.counts).toEqual({ yes: 0, no: 0, neutral: 0 });
    // Voted, all the same: not among those who haven't.
    expect(view.unread).toEqual([
      { name: 'Cal', address: ADDR.Cal, vote: null, at: T0 + 900, via: 'direct' },
    ]);
  });

  it('a copy dated after its share was published isn’t one it could have made', () => {
    const src = sources({
      votes: [voteRead('Cal', 'no', T0 + 3 * DAY_MS, locked)],
      shares: [shareOf([{ name: 'Cal', vote: 'yes', updated: T0 + 3 * DAY_MS }], T0 + DAY_MS)],
    });
    expect(assemblePoll(src, ctx())?.votes).toEqual([]);
  });

  it('too late is judged from the row, even when the viewer can’t read it', () => {
    const src = sources({
      votes: [voteRead('Cal', 'no', END + 20_000, locked)],
      shares: [shareOf([{ name: 'Cal', vote: 'yes', updated: T0 + 200 }])],
    });
    const view = assemblePoll(src, ctx({ now: END + DAY_MS }))!;
    // Cal's latest version came after the end: the older copy doesn't count either.
    expect(view.votes).toEqual([]);
    expect(view.late).toEqual([
      { name: 'Cal', address: ADDR.Cal, vote: null, at: END + 20_000, via: 'direct' },
    ]);
  });

  it('a copy with no row is dropped, unless a search stopped early', () => {
    const src = sources({ shares: [shareOf([{ name: 'Cal', vote: 'yes', updated: T0 + 200 }])] });
    expect(assemblePoll(src, ctx())?.votes).toEqual([]);
    expect(assemblePoll(src, ctx({ truncated: true }))?.votes).toEqual([
      {
        name: 'Cal',
        address: ADDR.Cal,
        vote: 'yes',
        at: T0 + 200,
        via: 'share',
        sharedBy: 'Bea',
        unlisted: true,
      },
    ]);
  });

  it('a vote whose latest version isn’t a valid vote is no vote', () => {
    const src = sources({
      votes: [voteRead('Cal', 'no', T0 + 200, { status: 'invalid' })],
      shares: [shareOf([{ name: 'Cal', vote: 'yes', updated: T0 + 200 }])],
    });
    const view = assemblePoll(src, ctx())!;
    expect([view.votes, view.unread, view.late]).toEqual([[], [], []]);
  });

  it('the viewer’s own vote after the end: theirs, and late', () => {
    const view = assemblePoll(
      sources({ votes: [voteRead('Avery', 'yes', END + 1)] }),
      ctx({ now: END + DAY_MS })
    )!;
    expect(view.myVote).toBeNull();
    expect(view.myLate).toMatchObject({ name: 'Avery', vote: 'yes', at: END + 1 });
  });

  it('a share whose copy of the poll was asked at another time than its row is ignored', () => {
    const src = sources({
      polls: [pollRead('Bea', locked, T0 + 5_000)],
      shares: [
        shareRead(
          'Cal',
          share({ poll: poll({ createdAt: T0 - 2 * DAY_MS, endsAt: T0 + 5 * DAY_MS }) }),
          T0 + DAY_MS
        ),
      ],
    });
    expect(validShares(src, ctx())).toEqual([]);
    expect(assemblePoll(src, ctx())).toBeNull();
  });
});

describe('readers', () => {
  it('the poll’s and every share’s; current admins outside them are missing', () => {
    const src = sources({
      polls: [pollRead('Bea', ok(poll({ readers: [ADDR.Avery, ADDR.Bea] })))],
      shares: [shareRead('Cal', share({ readers: [ADDR.Bea, ADDR.Cal, ADDR.Dee] }))],
    });
    const view = assemblePoll(src, ctx());
    expect(new Set(view?.readers)).toEqual(new Set([ADDR.Avery, ADDR.Bea, ADDR.Cal, ADDR.Dee]));
    expect(view?.missing).toEqual([ADDR.Eve]);
    expect(missingReaders(SIGNERS, SIGNERS)).toEqual([]);
    expect(missingReaders([NEW_ADMIN, ...SIGNERS], SIGNERS)).toEqual([NEW_ADMIN]);
    expect(pollReaders(poll({ readers: [ADDR.Bea] }), [])).toEqual([ADDR.Bea]);
  });
});

describe('comments', () => {
  it('rows from current admins, this poll only, each once (its newest), newest first', () => {
    const rows = pollCommentRows(
      ID,
      [
        row('Bea', commentIdent('aaaaaa'), T0 + 10),
        row('Bea', commentIdent('aaaaaa'), T0 + 10, T0 + 50),
        row('Cal', commentIdent('bbbbbb'), T0 + 20),
        row('Member', commentIdent('cccccc'), T0 + 30),
        row('Cal', `qmp-admincomment-zzzzzzzz-dddddd`, T0 + 40),
      ],
      ctx()
    );
    expect(rows.map((r) => [r.name, r.identifier, r.updatedAt])).toEqual([
      ['Cal', commentIdent('bbbbbb'), T0 + 20],
      ['Bea', commentIdent('aaaaaa'), T0 + 50],
    ]);
    expect(rows[0]).toMatchObject({ key: ID, ref: `Cal\n${commentIdent('bbbbbb')}` });
  });

  it('copies from shares: current admins’ comments only, each a copy of its row’s version', () => {
    const c = (name: string, cid: string, postedAt: number, updatedAt: number, text = 'Hi') => ({
      name,
      identifier: commentIdent(cid),
      postedAt,
      updatedAt,
      text,
    });
    const rows = pollCommentRows(
      ID,
      [
        row('Bea', commentIdent('aaaaaa'), T0 + 5, T0 + 9),
        row('Cal', commentIdent('cccccc'), T0 + 7),
        row('Eve', commentIdent('eeeeee'), T0 + 8),
      ],
      ctx()
    );
    const shares = validShares(
      sources({
        shares: [
          shareRead(
            'Cal',
            share({
              comments: [
                // An older version than the row: not a copy of it.
                c('Bea', 'aaaaaa', T0 + 5, T0 + 5, 'old'),
                c('Member', 'bbbbbb', T0 + 5, T0 + 5),
                c('Cal', 'cccccc', T0 + 7, T0 + 7, 'Cal, as Cal’s share saw it'),
                // No row for it.
                c('Dee', 'dddddd', T0 + 6, T0 + 6, 'Only in a share'),
              ],
            }),
            T0 + DAY_MS
          ),
          shareRead(
            'Dee',
            share({
              comments: [
                c('Bea', 'aaaaaa', T0 + 5, T0 + 9, 'new'),
                c('Cal', 'cccccc', T0 + 7, T0 + 7, 'Cal, as Dee’s share saw it'),
                // Dated after the share itself: not a copy it could have made.
                c('Eve', 'eeeeee', T0 + 8, T0 + 3 * DAY_MS, 'From the future'),
              ],
            }),
            T0 + 2 * DAY_MS
          ),
        ],
      }),
      ctx()
    );
    // The newest share first: its copy of each version.
    expect(shareCommentCopies(shares, rows, ctx())).toEqual([
      { ...c('Bea', 'aaaaaa', T0 + 5, T0 + 9, 'new'), sharedBy: 'Dee' },
      { ...c('Cal', 'cccccc', T0 + 7, T0 + 7, 'Cal, as Dee’s share saw it'), sharedBy: 'Dee' },
    ]);
    // A search that stopped early: a copy with no row is kept, marked as only in a share.
    expect(shareCommentCopies(shares, rows, ctx({ truncated: true }))).toContainEqual({
      ...c('Dee', 'dddddd', T0 + 6, T0 + 6, 'Only in a share'),
      sharedBy: 'Cal',
      unlisted: true,
    });
  });

  it('as the public thread shows them', () => {
    expect(
      toCommentRecord(ID, { text: 'Hi', edited: true, replyTo: commentIdent('aaaaaa') })
    ).toEqual({
      v: 1,
      key: ID,
      text: 'Hi',
      edited: true,
      replyTo: commentIdent('aaaaaa'),
    });
    expect(toCommentRecord(ID, { text: 'gone', deleted: true, edited: true })).toEqual({
      v: 1,
      key: ID,
      text: '',
      deleted: true,
    });
  });

  it('the thread: what the viewer read; a share’s copy only for a row they can’t read', () => {
    const rows = pollCommentRows(
      ID,
      [
        row('Bea', commentIdent('aaaaaa'), T0 + 10),
        row('Cal', commentIdent('bbbbbb'), T0 + 20),
        row('Dee', commentIdent('cccccc'), T0 + 30),
        row('Eve', commentIdent('dddddd'), T0 + 40),
        row('Avery', commentIdent('eeeeee'), T0 + 50),
        row('Bea', commentIdent('ffffff'), T0 + 60),
        row('Cal', commentIdent('gggggg'), T0 + 70, T0 + 80),
        row('Eve', commentIdent('hhhhhh'), T0 + 90),
      ],
      ctx()
    );
    const copy = (
      name: string,
      cid: string,
      postedAt: number,
      updatedAt: number,
      text: string
    ) => ({
      name,
      identifier: commentIdent(cid),
      postedAt,
      updatedAt,
      text,
      sharedBy: 'Dee',
    });
    const {
      rows: shown,
      bodies,
      unreadable,
    } = pollThreadSources({
      pollId: ID,
      rows,
      bodies: new Map<string, BodyRead & { fetching?: boolean }>([
        [`Bea\n${commentIdent('aaaaaa')}`, ok({ v: 1, pollId: ID, text: 'Read it myself' })],
        [`Cal\n${commentIdent('bbbbbb')}`, locked],
        [`Dee\n${commentIdent('cccccc')}`, locked],
        [`Eve\n${commentIdent('dddddd')}`, { status: 'unavailable', fetching: true }],
        [`Avery\n${commentIdent('eeeeee')}`, ok({ v: 1, pollId: ID, text: 'What I read' })],
        [`Cal\n${commentIdent('gggggg')}`, locked],
        [`Eve\n${commentIdent('hhhhhh')}`, { status: 'unavailable' }],
      ]),
      copies: [
        copy('Cal', 'bbbbbb', T0 + 20, T0 + 20, 'From the share'),
        // Claims a newer version than the one the viewer read: never replaces it.
        copy('Avery', 'eeeeee', T0 + 50, T0 + 99, 'I support this'),
        // A copy of an older version than the row: not used.
        copy('Cal', 'gggggg', T0 + 70, T0 + 70, 'Before the edit'),
        copy('Eve', 'hhhhhh', T0 + 90, T0 + 90, 'Not on my node yet'),
        { ...copy('Bea', '999999', T0 + 5, T0 + 5, 'Only in the share'), unlisted: true as const },
      ],
    });
    const text = (name: string, cid: string) => {
      const b = bodies.get(`${name}\n${commentIdent(cid)}`);
      return b?.status === 'ok' ? b.record.text : b?.status;
    };
    expect(text('Bea', 'aaaaaa')).toBe('Read it myself');
    expect(bodies.get(`Bea\n${commentIdent('aaaaaa')}`)).not.toHaveProperty('from');
    expect(text('Cal', 'bbbbbb')).toBe('From the share');
    // Shown as from the admin whose share carried it.
    expect(bodies.get(`Cal\n${commentIdent('bbbbbb')}`)).toMatchObject({ from: 'Dee' });
    expect(text('Dee', 'cccccc')).toBe('invalid');
    expect(bodies.get(`Eve\n${commentIdent('dddddd')}`)).toEqual({
      status: 'unavailable',
      fetching: true,
    });
    expect(text('Avery', 'eeeeee')).toBe('What I read');
    expect(text('Cal', 'gggggg')).toBe('invalid');
    expect(text('Eve', 'hhhhhh')).toBe('Not on my node yet');
    // Locked, and no share carries that version: left out, and counted.
    expect(unreadable).toBe(2);
    // Not read yet: listed without a body (the thread shows it once read).
    expect(bodies.has(`Bea\n${commentIdent('ffffff')}`)).toBe(false);
    expect(text('Bea', '999999')).toBe('Only in the share');
    expect(shown.map((r) => r.identifier.slice(-6))).toEqual([
      'hhhhhh',
      'gggggg',
      'ffffff',
      'eeeeee',
      'dddddd',
      'cccccc',
      'bbbbbb',
      'aaaaaa',
      '999999',
    ]);
    // A body that doesn't parse, with no copy: never shown.
    const bad = pollThreadSources({
      pollId: ID,
      rows: rows.slice(0, 1),
      bodies: new Map([[rows[0].ref, ok({ v: 1, pollId: 'zzzzzzzz', text: 'x' })]]),
      copies: [],
    });
    expect(bad.bodies.get(rows[0].ref)).toEqual({ status: 'invalid' });
  });

  it('a poll’s view: copies of other versions, or with no row, aren’t passed on to the thread', () => {
    const cRow = row('Cal', commentIdent('bbbbbb'), T0 + 20, T0 + 30);
    const shareBody = share({
      comments: [
        {
          name: 'Cal',
          identifier: commentIdent('bbbbbb'),
          postedAt: T0 + 20,
          updatedAt: T0 + 25,
          text: 'Old',
        },
        {
          name: 'Bea',
          identifier: commentIdent('cccccc'),
          postedAt: T0 + 9,
          updatedAt: T0 + 9,
          text: 'No row',
        },
      ],
    });
    const src = sources({
      polls: [pollRead('Bea', locked)],
      shares: [shareRead('Dee', shareBody)],
      comments: [cRow],
    });
    expect(assemblePoll(src, ctx())?.shareComments).toEqual([]);
    expect(assemblePoll(src, ctx({ truncated: true }))?.shareComments).toEqual([
      expect.objectContaining({ name: 'Bea', text: 'No row', unlisted: true }),
    ]);
  });
});

describe('open, closed and the list', () => {
  const END = T0 + 7 * DAY_MS;

  it('open until the end; listed until 31 days after it', () => {
    expect(isPollOpen({ endsAt: END }, END - 1)).toBe(true);
    expect(isPollOpen({ endsAt: END }, END)).toBe(false);
    expect(isPollShown({ endsAt: END }, END + CLOSED_SHOWN_MS)).toBe(true);
    expect(isPollShown({ endsAt: END }, END + CLOSED_SHOWN_MS + 1)).toBe(false);
  });

  it('open polls first, soonest end first; then closed ones, latest end first', () => {
    const p = (id: string, endsAt: number, open: boolean) => ({ id, poll: { endsAt }, open });
    expect(
      sortPolls([
        p('closed-old', T0, false),
        p('open-late', T0 + 9, true),
        p('closed-new', T0 + 5, false),
        p('open-soon', T0 + 2, true),
      ]).map((x) => x.id)
    ).toEqual(['open-soon', 'open-late', 'closed-new', 'closed-old']);
  });

  it('assemblePolls lists what counts, in order, and leaves out polls closed long ago', () => {
    const make = (id: string, createdAt: number, durationDays: number): PollSources => ({
      pollId: id,
      polls: [
        {
          row: row('Bea', pollIdentifier(id), createdAt),
          body: ok(
            poll({ id, createdAt, endsAt: createdAt + durationDays * DAY_MS, durationDays })
          ),
        },
      ],
      votes: [],
      shares: [],
      comments: [],
    });
    const now = T0 + 40 * DAY_MS;
    const views = assemblePolls(
      [
        make('aaaaaaaa', T0, 1), // ended 39 days ago
        make('bbbbbbbb', T0 + 20 * DAY_MS, 7), // ended 13 days ago
        make('cccccccc', T0 + 35 * DAY_MS, 30), // open, ends in 25 days
        make('dddddddd', T0 + 38 * DAY_MS, 7), // open, ends in 5 days
        { ...make('eeeeeeee', T0 + 39 * DAY_MS, 7), polls: [] }, // nothing to show
      ],
      ctx({ now })
    );
    expect(views.map((v) => [v.id, v.open])).toEqual([
      ['dddddddd', true],
      ['cccccccc', true],
      ['bbbbbbbb', false],
    ]);
  });

  it('polls waiting for the viewer’s vote: open, not voted, not being voted from here', () => {
    const open = assemblePoll(sources(), ctx())!;
    const voted = assemblePoll(
      { ...sources({ votes: [voteRead('Avery', 'yes', T0 + 1)] }), pollId: ID },
      ctx()
    )!;
    const closed = assemblePoll(sources(), ctx({ now: T0 + 8 * DAY_MS }))!;
    expect(pollsWaitingForVote([open, voted, closed]).map((v) => v.id)).toEqual([ID]);
    expect(pollsWaitingForVote([open], new Set([ID]))).toEqual([]);
  });
});

describe('when the loader reads shares', () => {
  it('only when a current admin shared it and something is missing for the viewer', () => {
    const withShare = (over: Partial<PollSources> = {}) =>
      sources({ shares: [shareRead('Cal')], ...over });
    // Everything readable and everyone covered: no need.
    expect(needsShareRead(withShare(), ctx())).toBe(false);
    // No share from a current admin: nothing to read.
    expect(needsShareRead(sources({ polls: [pollRead('Bea', locked)] }), ctx())).toBe(false);
    expect(
      needsShareRead(
        sources({ polls: [pollRead('Bea', locked)], shares: [shareRead('Member')] }),
        ctx()
      )
    ).toBe(false);
    // The poll itself can't be read.
    expect(needsShareRead(withShare({ polls: [pollRead('Bea', locked)] }), ctx())).toBe(true);
    // A current admin isn't among the poll's readers.
    expect(needsShareRead(withShare(), ctx({ signers: [...SIGNERS, NEW_ADMIN] }))).toBe(true);
    // A current admin's vote couldn't be read.
    expect(needsShareRead(withShare({ votes: [voteRead('Cal', 'no', T0, locked)] }), ctx())).toBe(
      true
    );
    // An unreadable vote from a member doesn't matter.
    expect(
      needsShareRead(withShare({ votes: [voteRead('Member', 'no', T0, locked)] }), ctx())
    ).toBe(false);
  });
});
