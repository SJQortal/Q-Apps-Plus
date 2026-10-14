import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_POLL_IDS, NULL_OWNER, addAdminPolls, fakeAddress } from '../../e2e/world.mjs';
import { fromData64, parsePoll, parseShare, parseVote } from '../data/adminPollRecords';
import { serveAdminPolls } from '../test/adminPolls';
import {
  fetchCallsFor,
  fetchRequests,
  mockFetchRoute,
  mockQortalRequest,
  qortalCallsFor,
} from '../test/setup';
import { ADDR, MS_PER_BLOCK, NOW, PEOPLE, TIP, installWorld } from '../test/world';
import { loadAdminPolls } from '../data/adminPolls';
import { askedInTime } from '../rules/adminPolls';
import { pendingPollWrites, resetPendingPollWrites } from '../state/adminPolls';
import {
  commentAdminPoll,
  deleteAdminPollComment,
  editAdminPollComment,
  guardPollOpen,
  guardVoteInTime,
  publishAdminPoll,
  shareAdminPoll,
  voteAdminPoll,
  type PollAuthor,
} from './adminPolls';
import * as flows from './flows';
import { publishEncryptedRequest } from './hubActions';

beforeEach(() => resetPendingPollWrites());
afterEach(() => vi.useRealTimers());

const DAY = 86_400_000;
const extra = (i: number) => fakeAddress(`admin-${i}`);

function author(persona = 'admin') {
  const installed = installWorld(persona);
  addAdminPolls(installed.world);
  serveAdminPolls(installed.world, persona);
  const me: PollAuthor = {
    address: installed.address,
    publicKey: installed.publicKey,
    name: PEOPLE[persona].name,
  };
  return { ...installed, me };
}

const sent = () =>
  mockQortalRequest('PUBLISH_QDN_RESOURCE', (request: Record<string, unknown>) => ({
    type: 'ARBITRARY',
    signature: 'S1',
    identifier: request.identifier,
  }));

const publishes = () => qortalCallsFor('PUBLISH_QDN_RESOURCE');
const bodyOf = (call: Record<string, unknown>) => fromData64(String(call.data64));
const signerKeys = (world: ReturnType<typeof installWorld>['world']) =>
  world.admins
    .filter((a: string) => a !== NULL_OWNER)
    .map((a: string) => world.accounts.get(a).publicKey);

describe('the Hub request (pinned)', () => {
  it('DOCUMENT_PRIVATE under the name, encrypt: true, the public keys once each', () => {
    const record = { v: 1 as const, pollId: 'k3x9m2pq', vote: 'yes' as const };
    const request = publishEncryptedRequest('Avery Admin', 'qmp-adminvote-k3x9m2pq', record, [
      'KeyA',
      'KeyB',
      'KeyA',
    ]);
    expect(request).toEqual({
      action: 'PUBLISH_QDN_RESOURCE',
      name: 'Avery Admin',
      service: 'DOCUMENT_PRIVATE',
      identifier: 'qmp-adminvote-k3x9m2pq',
      data64: expect.any(String),
      encrypt: true,
      publicKeys: ['KeyA', 'KeyB'],
    });
    expect(fromData64(String(request.data64))).toEqual(record);
    expect(() => publishEncryptedRequest('Avery Admin', 'x', record, [])).toThrow(/public key/);
  });

  it('the flows the testnet calls are on writes/flows', () => {
    for (const name of [
      'publishAdminPoll',
      'voteAdminPoll',
      'commentAdminPoll',
      'editAdminPollComment',
      'deleteAdminPollComment',
      'shareAdminPoll',
    ])
      expect(typeof (flows as Record<string, unknown>)[name]).toBe('function');
  });
});

describe('publishAdminPoll: Ask the Minter Admins', () => {
  it('one publish, encrypted to every Minter Admin who can sign; the end from the block time', async () => {
    const { me, world } = author();
    sent();
    const result = await publishAdminPoll(me, {
      question: '  Should only level 5+ minters   become Minter Admins? ',
      details: 'Context.',
      durationDays: 7,
    });
    expect(result.outcome).toMatchObject({ status: 'sent' });
    expect(publishes()).toHaveLength(1);
    const call = publishes()[0];
    expect(call).toMatchObject({
      name: 'Avery Admin',
      service: 'DOCUMENT_PRIVATE',
      identifier: `qmp-adminpoll-${result.pollId}`,
      encrypt: true,
    });
    expect(result.pollId).toMatch(/^[a-z0-9]{8}$/);
    expect(new Set(call.publicKeys as string[])).toEqual(new Set(signerKeys(world)));
    const poll = parsePoll(bodyOf(call), result.pollId);
    expect(poll).toEqual(result.poll);
    expect(poll?.question).toBe('Should only level 5+ minters become Minter Admins?');
    expect(poll?.details).toBe('Context.');
    expect(poll?.readers).toEqual(world.admins.filter((a: string) => a !== NULL_OWNER));
    // The mock chain's tip is at NOW, 72.9 s a block (its measured time).
    const blocks = Math.ceil((7 * DAY) / MS_PER_BLOCK);
    expect(poll?.createdAt).toBe(NOW);
    expect(poll?.endsAt).toBe(NOW + blocks * MS_PER_BLOCK);
    expect(poll?.endHeight).toBe(TIP + blocks);
    // Shown at once, until QDN lists it.
    expect(pendingPollWrites().polls[result.pollId]).toMatchObject({
      status: 'confirming',
      publisher: { name: 'Avery Admin', address: ADDR.admin },
    });
  });

  it('a device clock 20 minutes fast: the poll is dated by the chain, so its readers keep it', async () => {
    const { me } = author();
    sent();
    vi.setSystemTime(new Date(NOW + 20 * 60_000));
    const result = await publishAdminPoll(me, {
      question: 'A long enough question?',
      durationDays: 7,
    });
    expect(result.outcome).toMatchObject({ status: 'sent' });
    // The mock chain's tip is at NOW.
    expect(result.poll?.createdAt).toBe(NOW + 5 * 60_000);
    expect(askedInTime(result.poll!, NOW)).toBe(true);
  });

  it('stops before Hub: a bad question, a member, no name, someone else’s name, no fee', async () => {
    const { me, world } = author();
    sent();
    const short = await publishAdminPoll(me, { question: 'Why?', durationDays: 7 });
    expect(short.outcome).toEqual({
      status: 'blocked',
      reason: 'Write a question of at least 10 characters.',
    });
    expect(
      (await publishAdminPoll(me, { question: 'A long enough question?', durationDays: 31 }))
        .outcome
    ).toMatchObject({
      reason: 'Pick a duration of 1 to 30 days.',
    });
    const q = { question: 'A long enough question?', durationDays: 7 };
    expect((await publishAdminPoll({ ...me, name: null }, q)).outcome).toMatchObject({
      status: 'blocked',
      reason: expect.stringMatching(/registered name/),
    });
    expect((await publishAdminPoll({ ...me, name: 'Nora Nominator' }, q)).outcome).toEqual({
      status: 'blocked',
      reason: 'The name Nora Nominator belongs to another account.',
    });
    world.accounts.get(ADDR.admin).balance = 0;
    expect((await publishAdminPoll(me, q)).outcome).toMatchObject({
      status: 'blocked',
      reason: expect.stringMatching(/fee/),
    });
    expect(publishes()).toHaveLength(0);
  });

  it('a member who isn’t a Minter Admin can’t ask', async () => {
    const { me } = author('nominator');
    sent();
    const result = await publishAdminPoll(me, {
      question: 'A long enough question?',
      durationDays: 7,
    });
    expect(result.outcome).toEqual({
      status: 'blocked',
      reason: 'Only Minter Admins can take part in Minter Admin polls.',
    });
    expect(publishes()).toHaveLength(0);
  });

  it('a decline in Hub is a cancel: nothing is shown', async () => {
    const { me } = author();
    const result = await publishAdminPoll(me, {
      question: 'A long enough question?',
      durationDays: 3,
    });
    expect(result.outcome).toEqual({ status: 'declined' });
    expect(pendingPollWrites().polls).toEqual({});
  });

  it('after Hub’s 30-second timeout it finds the publish on the node before saying anything', async () => {
    const { me, world } = author();
    let identifier = '';
    mockQortalRequest('PUBLISH_QDN_RESOURCE', (request: Record<string, unknown>) => {
      identifier = String(request.identifier);
      world.decided.push({
        type: 'ARBITRARY',
        timestamp: Date.now() + 1,
        signature: 'LATE1',
        txGroupId: 0,
        blockHeight: TIP,
        creatorAddress: ADDR.admin,
        identifier,
      });
      throw { error: 'timeout', message: 'Request timed out after 30000 ms' };
    });
    const result = await publishAdminPoll(me, {
      question: 'A long enough question?',
      durationDays: 3,
    });
    expect(result.outcome).toMatchObject({ status: 'sent', recovered: true, signature: 'LATE1' });
  });
});

describe('voteAdminPoll', () => {
  it('publishes the vote, encrypted to every admin; shows "confirming" at once', async () => {
    const { me, world } = author();
    sent();
    const result = await voteAdminPoll(me, ADMIN_POLL_IDS.open, 'neutral');
    expect(result.outcome).toMatchObject({ status: 'sent' });
    const call = publishes()[0];
    expect(call.identifier).toBe(`qmp-adminvote-${ADMIN_POLL_IDS.open}`);
    expect(call.encrypt).toBe(true);
    expect(new Set(call.publicKeys as string[])).toEqual(new Set(signerKeys(world)));
    expect(parseVote(bodyOf(call), String(call.identifier))).toEqual({
      v: 1,
      pollId: ADMIN_POLL_IDS.open,
      vote: 'neutral',
    });
    expect(pendingPollWrites().votes[ADMIN_POLL_IDS.open]).toMatchObject({
      vote: 'neutral',
      status: 'confirming',
    });
  });

  it('changing a vote republishes the same identifier', async () => {
    const { me } = author();
    sent();
    await voteAdminPoll(me, ADMIN_POLL_IDS.voted, 'yes');
    expect(publishes()[0].identifier).toBe(`qmp-adminvote-${ADMIN_POLL_IDS.voted}`);
  });

  it('refuses after the end, on a poll they can’t read, and an unknown answer', async () => {
    const { me } = author();
    sent();
    expect((await voteAdminPoll(me, ADMIN_POLL_IDS.closed, 'yes')).outcome).toEqual({
      status: 'blocked',
      reason: 'This poll has ended: a vote can’t count any more.',
    });
    expect((await voteAdminPoll(me, ADMIN_POLL_IDS.locked, 'yes')).outcome).toEqual({
      status: 'blocked',
      reason: 'This poll isn’t among the Minter Admin polls you can read.',
    });
    expect((await voteAdminPoll(me, ADMIN_POLL_IDS.open, 'maybe' as never)).outcome).toEqual({
      status: 'blocked',
      reason: 'A vote is Yes, No or Neutral.',
    });
    expect(publishes()).toHaveLength(0);
    expect(pendingPollWrites().votes).toEqual({});
    expect(guardPollOpen({ endsAt: 10 }, 9)).toBeNull();
    expect(guardPollOpen({ endsAt: 10 }, 10)).toMatch(/ended/);
  });

  it('judges the end by the later of the device clock and the chain tip, and stops a few minutes early', () => {
    const end = NOW + DAY;
    // The device's clock behind: the chain's tip says it has ended.
    expect(guardVoteInTime({ endsAt: end }, end, end - 3_600_000)).toMatch(/has ended/);
    // The tip behind: the device's clock says so.
    expect(guardVoteInTime({ endsAt: end }, end - 3_600_000, end)).toMatch(/has ended/);
    expect(guardVoteInTime({ endsAt: end }, end - 4 * 60_000, end - 4 * 60_000)).toBe(
      'This poll ends in under 5 minutes: a vote published now could arrive after the end, and wouldn’t count.'
    );
    expect(guardVoteInTime({ endsAt: end }, end - 6 * 60_000, end - 6 * 60_000)).toBeNull();
  });

  it('a device clock days behind can’t vote on a poll the chain says has ended', async () => {
    const { me } = author();
    sent();
    // Days slow: by the device's clock the closed poll is still open.
    vi.setSystemTime(new Date(NOW - 5 * DAY));
    expect((await voteAdminPoll(me, ADMIN_POLL_IDS.closed, 'yes')).outcome).toEqual({
      status: 'blocked',
      reason: 'This poll has ended: a vote can’t count any more.',
    });
    expect(publishes()).toHaveLength(0);
  });

  it('remembers the vote QDN showed before, so the new one settles on a newer row, not on clocks', async () => {
    const { me } = author();
    sent();
    await voteAdminPoll(me, ADMIN_POLL_IDS.voted, 'yes');
    const before = NOW - DAY + 1_800_000;
    expect(pendingPollWrites().votes[ADMIN_POLL_IDS.voted]).toMatchObject({
      vote: 'yes',
      status: 'confirming',
      after: before,
    });
    await voteAdminPoll(me, ADMIN_POLL_IDS.open, 'no');
    expect(pendingPollWrites().votes[ADMIN_POLL_IDS.open]).toMatchObject({ after: 0 });
  });

  it('a decline clears the vote shown as on its way', async () => {
    const { me } = author();
    const result = await voteAdminPoll(me, ADMIN_POLL_IDS.open, 'yes');
    expect(result.outcome).toEqual({ status: 'declined' });
    expect(pendingPollWrites().votes).toEqual({});
  });
});

describe('comments on a poll', () => {
  it('post, reply, edit and delete: each one encrypted publish', async () => {
    const { me } = author();
    sent();
    const post = await commentAdminPoll(me, ADMIN_POLL_IDS.open, { text: '  Agreed.  ' });
    expect(post.outcome).toMatchObject({ status: 'sent' });
    expect(post.identifier).toMatch(
      new RegExp(`^qmp-admincomment-${ADMIN_POLL_IDS.open}-[a-z0-9]{6}$`)
    );
    expect(bodyOf(publishes()[0])).toEqual({ v: 1, pollId: ADMIN_POLL_IDS.open, text: 'Agreed.' });
    const reply = await commentAdminPoll(me, ADMIN_POLL_IDS.open, {
      text: 'Me too',
      replyTo: post.identifier,
    });
    expect(bodyOf(publishes()[1])).toMatchObject({ replyTo: post.identifier });
    await editAdminPollComment(
      me,
      { name: 'Avery Admin', identifier: reply.identifier, replyTo: post.identifier },
      'Me too, edited'
    );
    expect(publishes()[2].identifier).toBe(reply.identifier);
    expect(bodyOf(publishes()[2])).toEqual({
      v: 1,
      pollId: ADMIN_POLL_IDS.open,
      text: 'Me too, edited',
      replyTo: post.identifier,
      edited: true,
    });
    await deleteAdminPollComment(me, { name: 'Avery Admin', identifier: post.identifier });
    expect(bodyOf(publishes()[3])).toEqual({
      v: 1,
      pollId: ADMIN_POLL_IDS.open,
      text: '',
      deleted: true,
    });
    for (const call of publishes())
      expect(call).toMatchObject({ encrypt: true, service: 'DOCUMENT_PRIVATE' });
    // Each shows at once.
    expect(Object.keys(pendingPollWrites().comments)).toHaveLength(2);
  });

  it('stops before Hub: empty text, someone else’s comment, a poll they can’t read', async () => {
    const { me } = author();
    sent();
    expect((await commentAdminPoll(me, ADMIN_POLL_IDS.open, { text: ' ' })).outcome).toEqual({
      status: 'blocked',
      reason: 'Write something first.',
    });
    expect(
      (
        await editAdminPollComment(
          me,
          { name: 'Admin B', identifier: `qmp-admincomment-${ADMIN_POLL_IDS.open}-g7h8i9` },
          'Not mine'
        )
      ).outcome
    ).toEqual({ status: 'blocked', reason: 'The name Admin B belongs to another account.' });
    expect(
      (await commentAdminPoll(me, ADMIN_POLL_IDS.locked, { text: 'Hello' })).outcome
    ).toMatchObject({ status: 'blocked' });
    expect(
      (await deleteAdminPollComment(me, { name: 'Avery Admin', identifier: 'qmp-comment-x' }))
        .outcome
    ).toEqual({ status: 'blocked', reason: 'That isn’t a comment on a poll.' });
    expect(publishes()).toHaveLength(0);
  });
});

describe('shareAdminPoll', () => {
  it('a copy of the poll, its votes and comments, encrypted to every current admin', async () => {
    const { me, world } = author();
    sent();
    const result = await shareAdminPoll(me, ADMIN_POLL_IDS.open);
    expect(result.outcome).toMatchObject({ status: 'sent' });
    const call = publishes()[0];
    expect(call.identifier).toBe(`qmp-adminshare-${ADMIN_POLL_IDS.open}`);
    expect(new Set(call.publicKeys as string[])).toEqual(new Set(signerKeys(world)));
    const share = parseShare(bodyOf(call), String(call.identifier));
    expect(share?.pollPublisher).toBe('Admin B');
    expect(share?.poll.id).toBe(ADMIN_POLL_IDS.open);
    expect(share?.readers).toEqual(world.admins.filter((a: string) => a !== NULL_OWNER));
    expect(share?.readers).toContain(extra(14));
    expect(share?.votes.map((v) => [v.name, v.vote]).sort()).toEqual(
      [
        ['Admin B', 'yes'],
        ['Admin C', 'yes'],
        ['Admin E', 'neutral'],
        ['Admin F', 'no'],
        ['Dex Demote', 'yes'],
        ['Juniper L4', 'no'],
      ].sort()
    );
    expect(share?.comments).toHaveLength(3);
    expect(share?.comments.find((c) => c.replyTo)).toMatchObject({ name: 'Juniper L4' });
    expect(pendingPollWrites().shares[ADMIN_POLL_IDS.open]).toMatchObject({ status: 'confirming' });
  });

  it('refuses when every admin can read it already', async () => {
    const { me } = author();
    sent();
    expect((await shareAdminPoll(me, ADMIN_POLL_IDS.voted)).outcome).toEqual({
      status: 'blocked',
      reason: 'Every Minter Admin can already read this poll.',
    });
    expect(publishes()).toHaveLength(0);
  });

  it('reads fresh before deciding: a share another admin published since the list was read covers them', async () => {
    const { me, world } = author();
    sent();
    // The list as Decisions read it a moment ago.
    await loadAdminPolls(me.address);
    const signers = world.admins.filter((a: string) => a !== NULL_OWNER);
    const poll = world.adminPollRecords.find(
      (r: { identifier: string }) => r.identifier === `qmp-adminpoll-${ADMIN_POLL_IDS.open}`
    ).body;
    world.adminPollRecords.push({
      name: 'Admin D ΑΩ',
      identifier: `qmp-adminshare-${ADMIN_POLL_IDS.open}`,
      created: Date.now() - 60_000,
      readers: signers,
      body: {
        v: 1,
        pollId: ADMIN_POLL_IDS.open,
        poll,
        pollPublisher: 'Admin B',
        votes: [],
        comments: [],
        readers: signers,
        sharedAt: Date.now() - 60_000,
      },
    });
    expect((await shareAdminPoll(me, ADMIN_POLL_IDS.open)).outcome).toEqual({
      status: 'blocked',
      reason: 'Every Minter Admin can already read this poll.',
    });
    expect(publishes()).toHaveLength(0);
  });

  it('a share published a moment ago that hasn’t reached the node yet: wait, don’t pay twice', async () => {
    const { me, world } = author();
    sent();
    const signers = world.admins.filter((a: string) => a !== NULL_OWNER);
    const identifier = `qmp-adminshare-${ADMIN_POLL_IDS.open}`;
    world.adminPollRecords.push({
      name: 'Admin D ΑΩ',
      identifier,
      created: Date.now() - 60_000,
      readers: signers,
      body: { v: 1 },
    });
    mockFetchRoute(
      `/arbitrary/DOCUMENT_PRIVATE/${encodeURIComponent('Admin D ΑΩ')}/${identifier}`,
      () => new Response('', { status: 404 })
    );
    expect((await shareAdminPoll(me, ADMIN_POLL_IDS.open)).outcome).toEqual({
      status: 'blocked',
      reason:
        'This poll was shared a moment ago, and that copy hasn’t reached your node yet. Try again in a minute: it may already cover everyone.',
    });
    expect(publishes()).toHaveLength(0);
  });

  it('a vote or comment not on the node yet: no copy that leaves it out for good', async () => {
    const incomplete = {
      status: 'blocked',
      reason:
        'Some of its votes or comments haven’t reached your node yet, so the copy would leave them out. Try again in a minute.',
    };
    const missing = (name: string, identifier: string) =>
      mockFetchRoute(
        `/arbitrary/DOCUMENT_PRIVATE/${encodeURIComponent(name)}/${identifier}`,
        () => new Response('', { status: 404 })
      );
    {
      const { me } = author();
      sent();
      missing('Admin C', `qmp-admincomment-${ADMIN_POLL_IDS.open}-c1a2b3`);
      expect((await shareAdminPoll(me, ADMIN_POLL_IDS.open)).outcome).toEqual(incomplete);
    }
    {
      const { me } = author();
      sent();
      missing('Admin E', `qmp-adminvote-${ADMIN_POLL_IDS.open}`);
      expect((await shareAdminPoll(me, ADMIN_POLL_IDS.open)).outcome).toEqual(incomplete);
    }
    expect(publishes()).toHaveLength(0);
  });

  it('never POSTs to Core', async () => {
    const { me, posts } = author();
    sent();
    await publishAdminPoll(me, { question: 'A long enough question?', durationDays: 2 });
    await voteAdminPoll(me, ADMIN_POLL_IDS.open, 'yes');
    await shareAdminPoll(me, ADMIN_POLL_IDS.open);
    expect(posts).toEqual([]);
    expect(fetchRequests.every((r) => !r.init?.method || r.init.method === 'GET')).toBe(true);
    // Each admin's public key was read once at most.
    expect(fetchCallsFor(`/addresses/publickey/${ADDR.adminL4}`).length).toBeLessThanOrEqual(1);
  });
});
