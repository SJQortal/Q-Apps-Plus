import { describe, expect, it } from 'vitest';
import { addCommunityVotes, addDecisionVotes } from '../../e2e/world.mjs';
import { ADDR, NOW, installWorld } from '../test/world';
import { fetchCallsFor } from '../test/setup';
import {
  VOTE_PREFIX,
  buildDecisionVote,
  buildVote,
  decisionVoteSearchPrefix,
  newDecisionVoteIdentifier,
  newVoteIdentifier,
  parseDecisionVoteIdentifier,
  parseVoteIdentifier,
  voteSearchPrefix,
} from './voteRecords';
import { IDENTIFIER_MAX } from './records';
import {
  loadNomineeVotes,
  loadSubjectVotes,
  loadVoteIndex,
  voteIndexCovers,
} from './communityVotes';
import {
  communityVotesFor,
  myCommunityVote,
  takesVotes,
  type CommunityTally,
  type VoteRow,
} from '../rules/communityVotes';

const NOMINEE = 'QNomiUy6sUiEnaN87dWmE92g1uQjrvPgrW';
const HOUR = 3_600_000;
const names = (people: Array<{ name: string }>) => people.map((p) => p.name);

describe('Community vote records (qmp-vote-<nominee>-<yes|no>-<id>)', () => {
  it('puts the vote in the identifier, with a new id each time, within QDN’s 64 characters', () => {
    const yes = newVoteIdentifier(NOMINEE, 'yes', 'abc123');
    expect(yes).toBe(`${VOTE_PREFIX}${NOMINEE}-yes-abc123`);
    expect(yes.length).toBeLessThanOrEqual(IDENTIFIER_MAX);
    expect(yes).toHaveLength(54);
    expect(newVoteIdentifier(NOMINEE, 'no', 'abc123')).toHaveLength(53);
    expect(newVoteIdentifier(NOMINEE, 'yes')).toMatch(
      new RegExp(`^qmp-vote-${NOMINEE}-yes-[a-z0-9]{6}$`)
    );
    expect(newVoteIdentifier(NOMINEE, 'yes')).not.toBe(newVoteIdentifier(NOMINEE, 'yes'));
    expect(yes.startsWith(voteSearchPrefix(NOMINEE))).toBe(true);
  });

  it('refuses a malformed nominee, vote or id', () => {
    expect(() => newVoteIdentifier('Qshort', 'yes')).toThrow();
    expect(() => newVoteIdentifier(NOMINEE, 'maybe' as 'yes')).toThrow();
    expect(() => newVoteIdentifier(NOMINEE, 'yes', 'too-long-id')).toThrow();
    expect(() => buildVote('Qshort', 'no')).toThrow();
  });

  it('reads the nominee and the vote back only from identifiers this app writes', () => {
    expect(parseVoteIdentifier(`qmp-vote-${NOMINEE}-no-k3j9x2`)).toEqual({
      nominee: NOMINEE,
      vote: 'no',
    });
    expect(parseVoteIdentifier(`qmp-vote-${NOMINEE}-maybe-k3j9x2`)).toBeNull();
    expect(parseVoteIdentifier(`qmp-vote-${NOMINEE}-yes-k3j9x`)).toBeNull();
    expect(parseVoteIdentifier(`qmp-vote-${NOMINEE}-yes`)).toBeNull();
    expect(parseVoteIdentifier('qmp-vote-not-an-address-yes-abc123')).toBeNull();
    expect(parseVoteIdentifier(`qmp-adminvote-${NOMINEE}`)).toBeNull();
    expect(parseVoteIdentifier(42)).toBeNull();
  });

  it('builds a body that repeats the identifier: { v: 1, nomineeAddress, vote }', () => {
    expect(buildVote(NOMINEE, 'yes')).toEqual({ v: 1, nomineeAddress: NOMINEE, vote: 'yes' });
  });
});

describe('Who counts (rules/communityVotes)', () => {
  const row = (voter: string, vote: 'yes' | 'no', castAt: number, nominee = NOMINEE): VoteRow => ({
    voter,
    name: voter,
    nominee,
    vote,
    castAt,
  });

  it('counts each account’s newest vote in this round, oldest voter first', () => {
    const tally = communityVotesFor(
      [
        row('A', 'yes', 300),
        row('B', 'yes', 200),
        row('C', 'yes', 150),
        // C changed their mind: the newest counts.
        row('C', 'no', 400),
        // Before the round began; about someone else.
        row('D', 'yes', 50),
        row('E', 'yes', 300, 'QOtherAddressxxxxxxxxxxxxxxxxxxxxx'),
      ],
      { nominee: NOMINEE, since: 100 },
      new Set()
    );
    expect(names(tally.yes)).toEqual(['B', 'A']);
    expect(names(tally.no)).toEqual(['C']);
  });

  it('leaves out Minter Admins and the nominee', () => {
    const tally = communityVotesFor(
      [row('A', 'yes', 200), row('Admin', 'no', 200), row(NOMINEE, 'yes', 200)],
      { nominee: NOMINEE, since: 0 },
      new Set(['Admin'])
    );
    expect(names(tally.yes)).toEqual(['A']);
    expect(tally.no).toEqual([]);
  });

  it('takes votes while it waits, or while approvals can still count', () => {
    expect(takesVotes('waiting', null)).toBe(true);
    expect(takesVotes('signing', 'open')).toBe(true);
    expect(takesVotes('signing', 'early')).toBe(true);
    expect(takesVotes('signing', 'unconfirmed')).toBe(true);
    // The last block an approval counts in has passed, or the count has decided it.
    expect(takesVotes('signing', 'tooLate')).toBe(false);
    expect(takesVotes('signing', 'thresholdMet')).toBe(false);
    expect(takesVotes('signing', 'rejectedMet')).toBe(false);
    expect(takesVotes('signing', null)).toBe(false);
    expect(takesVotes('approved', null)).toBe(false);
    expect(takesVotes('expired', 'expired')).toBe(false);
  });

  it('shows this account’s vote from QDN, or a newer one from this device on its way', () => {
    const tally: CommunityTally = {
      yes: [{ address: 'me', name: 'Me', vote: 'yes', castAt: 1 }],
      no: [],
    };
    const now = 1_000_000;
    expect(myCommunityVote(tally, 'me', { yes: null, no: null }, now)).toEqual({
      vote: 'yes',
      settled: true,
      busy: false,
      sending: null,
    });
    // Changing to No: being sent, then on its way, then QDN has it.
    expect(
      myCommunityVote(tally, 'me', { yes: null, no: { status: 'sending', at: now } }, now)
    ).toEqual({ vote: 'yes', settled: true, busy: true, sending: 'no' });
    expect(
      myCommunityVote(tally, 'me', { yes: null, no: { status: 'confirming', at: now } }, now)
    ).toEqual({ vote: 'no', settled: false, busy: true, sending: null });
    const changed: CommunityTally = { yes: [], no: [{ ...tally.yes[0], vote: 'no' }] };
    expect(
      myCommunityVote(changed, 'me', { yes: null, no: { status: 'confirming', at: now } }, now)
    ).toEqual({ vote: 'no', settled: true, busy: false, sending: null });
    // A failed or forgotten write leaves what QDN says.
    expect(
      myCommunityVote(tally, 'me', { yes: null, no: { status: 'failed', at: now } }, now).vote
    ).toBe('yes');
    expect(
      myCommunityVote(
        tally,
        'me',
        { yes: null, no: { status: 'confirming', at: now - 16 * 60_000 } },
        now
      ).vote
    ).toBe('yes');
    // The newest of two writes wins.
    expect(
      myCommunityVote(
        { yes: [], no: [] },
        'me',
        { yes: { status: 'confirming', at: now - 10 }, no: { status: 'confirming', at: now } },
        now
      ).vote
    ).toBe('no');
  });
});

describe('Reading the votes (data/communityVotes)', () => {
  it('one search for every card, no bodies, each name looked up to its account', async () => {
    const { world } = installWorld('learner');
    addCommunityVotes(world);
    const index = await loadVoteIndex();
    const wren = communityVotesFor(
      index.rows,
      { nominee: ADDR.nominatedWaiting, since: NOW - 48 * HOUR },
      new Set(index.admins)
    );
    expect(names(wren.yes)).toEqual(['Member 7', 'Zoë Newcomer', 'Member 1']);
    // Leo changed a Yes to No; the admin, the nominee and the vote from before the round don't count.
    expect(names(wren.no)).toEqual(['Lou Left', 'Leo Learner']);
    const bob = communityVotesFor(
      index.rows,
      { nominee: ADDR.nominatedSigning, since: NOW - 96 * HOUR },
      new Set(index.admins)
    );
    expect(bob.yes).toHaveLength(5);
    expect(names(bob.no)).toEqual(['Member 4']);

    const searches = fetchCallsFor('/arbitrary/resources/searchsimple').filter((p) =>
      p.includes('qmp-vote-')
    );
    expect(searches).toHaveLength(1);
    expect(searches[0]).toMatch(/limit=100/);
    expect(searches[0]).toMatch(/after=\d+/);
    expect(fetchCallsFor('/arbitrary/JSON/').filter((p) => p.includes('qmp-vote-'))).toEqual([]);
    expect(voteIndexCovers(index, NOW - 48 * HOUR)).toBe(true);
    expect(voteIndexCovers({ ...index, truncated: true }, NOW - 48 * HOUR)).toBe(false);
    expect(voteIndexCovers(index, index.after - 1)).toBe(false);
  });

  it('a card can search its own nominee from the round’s start', async () => {
    const { world } = installWorld('learner');
    addCommunityVotes(world);
    const own = await loadNomineeVotes(ADDR.nominatedWaiting, NOW - 48 * HOUR);
    expect(new Set(own.rows.map((r) => r.nominee))).toEqual(new Set([ADDR.nominatedWaiting]));
    // Member 2's vote from before the round isn't even listed.
    expect(own.rows.map((r) => r.name)).not.toContain('Member 2');
    const search = fetchCallsFor('/arbitrary/resources/searchsimple').find((p) =>
      p.includes(encodeURIComponent(voteSearchPrefix(ADDR.nominatedWaiting)))
    );
    expect(search).toMatch(/after=\d+/);
  });
});

describe('Votes on removals, bans and new Minter Admins (qmp-vote-<remove|ban|admin>-<address>-…)', () => {
  it('puts the kind, the account and the vote in the identifier, within QDN’s 64 characters', () => {
    const id = newDecisionVoteIdentifier('kick', NOMINEE, 'yes', 'abc123');
    expect(id).toBe(`qmp-vote-remove-${NOMINEE}-yes-abc123`);
    expect(id.length).toBeLessThanOrEqual(IDENTIFIER_MAX);
    expect(newDecisionVoteIdentifier('ban', NOMINEE, 'no', 'abc123')).toBe(
      `qmp-vote-ban-${NOMINEE}-no-abc123`
    );
    expect(newDecisionVoteIdentifier('addAdmin', NOMINEE, 'yes', 'abc123')).toBe(
      `qmp-vote-admin-${NOMINEE}-yes-abc123`
    );
    expect(id.startsWith(decisionVoteSearchPrefix('kick', NOMINEE))).toBe(true);
    expect(() => newDecisionVoteIdentifier('cancelBan' as 'ban', NOMINEE, 'yes')).toThrow();
    expect(() => newDecisionVoteIdentifier('ban', 'Qshort', 'yes')).toThrow();
    expect(buildDecisionVote('ban', NOMINEE, 'no')).toEqual({
      v: 1,
      kind: 'ban',
      subjectAddress: NOMINEE,
      vote: 'no',
    });
  });

  it('never reads a nomination vote as a decision vote, nor the other way round', () => {
    const decision = `qmp-vote-admin-${NOMINEE}-no-k3j9x2`;
    expect(parseDecisionVoteIdentifier(decision)).toEqual({
      kind: 'addAdmin',
      subject: NOMINEE,
      vote: 'no',
    });
    expect(parseVoteIdentifier(decision)).toBeNull();
    expect(parseDecisionVoteIdentifier(`qmp-vote-${NOMINEE}-no-k3j9x2`)).toBeNull();
    expect(parseDecisionVoteIdentifier(`qmp-vote-kick-${NOMINEE}-no-k3j9x2`)).toBeNull();
    expect(parseDecisionVoteIdentifier(`qmp-vote-ban-${NOMINEE}-maybe-k3j9x2`)).toBeNull();
  });

  it('keeps each kind’s votes apart from the nomination’s and from each other', async () => {
    const { world } = installWorld('learner');
    addDecisionVotes(world);
    const index = await loadVoteIndex();
    const admins = new Set(index.admins);
    const since = NOW - 25 * HOUR;
    const kick = communityVotesFor(
      index.rows,
      { topic: 'kick', nominee: ADDR.kickTarget, since },
      admins
    );
    expect(names(kick.yes)).toEqual(['Member 7', 'Zoë Newcomer']);
    expect(names(kick.no)).toEqual(['Lou Left']);
    // The nomination-style vote on Kai is another round.
    const nomination = communityVotesFor(index.rows, { nominee: ADDR.kickTarget, since }, admins);
    expect(names(nomination.yes)).toEqual(['Member 1']);
    expect(
      communityVotesFor(index.rows, { topic: 'ban', nominee: ADDR.kickTarget, since }, admins)
    ).toEqual({ yes: [], no: [] });
  });

  it('a card can search its own proposal’s votes', async () => {
    const { world } = installWorld('learner');
    addDecisionVotes(world);
    const own = await loadSubjectVotes('ban', ADDR.banTarget, NOW - 120 * HOUR);
    expect(own.rows.map((r) => [r.topic, r.name])).toEqual(
      expect.arrayContaining([
        ['ban', 'Member 1'],
        ['ban', 'Member 4'],
      ])
    );
    expect(own.rows).toHaveLength(2);
    expect(
      fetchCallsFor('/arbitrary/resources/searchsimple').some((p) =>
        p.includes(encodeURIComponent(decisionVoteSearchPrefix('ban', ADDR.banTarget)))
      )
    ).toBe(true);
  });
});
