import { describe, expect, it } from 'vitest';
import { fakeAddress } from '../../../e2e/world.mjs';
import { DAY_MS, type PollRecord } from '../../data/adminPollRecords';
import type { AdminPollView, CountedVote } from '../../rules/adminPolls';
import {
  adminPollCardId,
  countsText,
  encryptedCheck,
  encryptedTo,
  endBlockText,
  endText,
  myVoteView,
  notVotedText,
  shareLabel,
  shareSettled,
  unlistedText,
  unreadText,
  voteSettled,
  waitingText,
  withPublishing,
} from './adminPollUi';

const T0 = 1_791_000_000_000;
const A = fakeAddress('ui-a');
const B = fakeAddress('ui-b');
const C = fakeAddress('ui-c');

const poll = (over: Partial<PollRecord> = {}): PollRecord => ({
  v: 1,
  id: 'k3x9m2pq',
  question: 'Should only level 5+ minters become Minter Admins?',
  durationDays: 7,
  createdAt: T0,
  endsAt: T0 + 7 * DAY_MS,
  endHeight: 2_765_797,
  readers: [A, B],
  ...over,
});

const vote = (v: CountedVote['vote'], at = T0 + 1000): CountedVote => ({
  name: 'Avery Admin',
  address: A,
  vote: v,
  at,
  via: 'direct',
});

const view = (over: Partial<AdminPollView> = {}): AdminPollView => ({
  id: 'k3x9m2pq',
  poll: poll(),
  publisher: { name: 'Admin B', address: B },
  postedAt: T0,
  sharedBy: null,
  shares: [],
  open: true,
  votes: [],
  late: [],
  unread: [],
  counts: { yes: 0, no: 0, neutral: 0 },
  myVote: null,
  myLate: null,
  readers: [A, B],
  missing: [],
  commentRows: [],
  shareComments: [],
  ...over,
});

describe('words', () => {
  it('when it ends, or ended, with its date and estimated block', () => {
    expect(endText(poll(), T0 + 2 * DAY_MS)).toMatch(/^Ends in 5 days · \d+ \w+ 2026, \d\d:\d\d$/);
    expect(endText(poll(), T0 + 9 * DAY_MS)).toMatch(/^Ended 2 days ago · /);
    expect(endBlockText(poll())).toBe('about block 2,765,797');
  });

  it('counts, who hasn’t voted, sharing and the Home line', () => {
    expect(countsText({ yes: 3, no: 2, neutral: 1 })).toBe('Yes 3 · No 2 · Neutral 1');
    expect(notVotedText(6, 19)).toBe("13 of 19 Minter Admins haven't voted");
    expect(notVotedText(18, 19)).toBe("1 of 19 Minter Admins hasn't voted");
    expect(notVotedText(19, 19)).toBeNull();
    expect(shareLabel(1)).toBe('Share with 1 Minter Admin added since');
    expect(shareLabel(2)).toBe('Share with 2 Minter Admins added since');
    expect(unreadText(1)).toBe('1 vote you can’t read yet isn’t in these counts.');
    expect(unreadText(2)).toBe('2 votes you can’t read yet aren’t in these counts.');
    expect(unlistedText(1)).toMatch(/^1 of these votes is only in a share’s copy/);
    expect(unlistedText(3)).toMatch(/^3 of these votes are only in a share’s copy/);
    expect(waitingText(1)).toBe('1 Minter Admin poll is waiting for your vote');
    expect(waitingText(3)).toBe('3 Minter Admin polls are waiting for your vote');
    expect(adminPollCardId('k3x9m2pq')).toBe('admin-poll-k3x9m2pq');
  });

  it('what to check in Hub for an encrypted publish, and who can read it', () => {
    expect(encryptedCheck('Avery Admin', 'qmp-adminvote-')).toEqual([
      'The name is Avery Admin.',
      'The service is DOCUMENT_PRIVATE.',
      'The identifier starts with qmp-adminvote-.',
      'It says isEncrypted: true.',
      'The fee.',
    ]);
    expect(encryptedTo(19)).toMatch(/^Encrypted to the 19 Minter Admins: only they can read it\./);
  });
});

describe('the viewer’s vote', () => {
  it('none yet: nothing to show', () => {
    expect(myVoteView(view(), null)).toEqual({
      vote: null,
      label: null,
      settled: true,
      sending: false,
      failed: false,
    });
  });

  it('counted: "Your vote: Yes ✓" while open, "You voted Yes" once closed', () => {
    expect(myVoteView(view({ myVote: vote('yes') }), null)).toMatchObject({
      vote: 'yes',
      label: 'Your vote: Yes ✓',
      settled: true,
    });
    expect(myVoteView(view({ myVote: vote('yes'), open: false }), null).label).toBe(
      'You voted Yes'
    );
  });

  it('on its way: sending keeps the old one; confirming shows the new one', () => {
    const sending = myVoteView(view({ myVote: vote('no') }), {
      vote: 'yes',
      status: 'sending',
      at: T0 + 5000,
    });
    expect(sending).toMatchObject({ vote: 'no', label: 'Your vote: No ✓', sending: true });
    const confirming = myVoteView(view({ myVote: vote('no') }), {
      vote: 'yes',
      status: 'confirming',
      at: T0 + 5000,
    });
    expect(confirming).toEqual({
      vote: 'yes',
      label: 'Voted Yes ✓ (confirming…)',
      settled: false,
      sending: false,
      failed: false,
    });
    const failed = myVoteView(view(), { vote: 'yes', status: 'failed', at: T0 });
    expect(failed).toMatchObject({ vote: null, label: null, failed: true });
  });

  it('settles once QDN shows the same vote, published since', () => {
    const pending = { vote: 'yes' as const, at: T0 + 5000 };
    expect(voteSettled(view({ myVote: vote('yes', T0 + 6000) }), pending)).toBe(true);
    // A minute or two of clock difference is fine.
    expect(voteSettled(view({ myVote: vote('yes', T0 - 60_000) }), pending)).toBe(true);
    expect(voteSettled(view({ myVote: vote('yes', T0 - 20 * 60_000) }), pending)).toBe(false);
    expect(voteSettled(view({ myVote: vote('no', T0 + 6000) }), pending)).toBe(false);
    expect(voteSettled(view(), pending)).toBe(false);
    expect(
      myVoteView(view({ myVote: vote('yes', T0 + 6000) }), { ...pending, status: 'confirming' })
        .label
    ).toBe('Your vote: Yes ✓');
  });

  it('a share settles once QDN lists the viewer’s', () => {
    const shares = [{ name: 'Avery Admin', address: A, sharedAt: T0, readers: [A], at: T0 + 10 }];
    expect(shareSettled(view({ shares }), A, { at: T0 })).toBe(true);
    expect(shareSettled(view({ shares }), B, { at: T0 })).toBe(false);
    expect(shareSettled(view(), A, { at: T0 })).toBe(false);
  });
});

describe('polls this device just published', () => {
  const pending = {
    newpoll1: {
      poll: poll({ id: 'newpoll1', endsAt: T0 + DAY_MS, readers: [A, B] }),
      publisher: { name: 'Avery Admin', address: A },
      status: 'confirming' as const,
      at: T0,
    },
  };

  it('are listed as publishing, in order, until QDN lists them', () => {
    const listed = view({ id: 'k3x9m2pq' });
    const shown = withPublishing([listed], pending, [A, B, C], T0 + 1000);
    expect(shown.map((v) => [v.id, Boolean(v.publishing)])).toEqual([
      ['newpoll1', true],
      ['k3x9m2pq', false],
    ]);
    expect(shown[0]).toMatchObject({
      open: true,
      votes: [],
      counts: { yes: 0, no: 0, neutral: 0 },
      missing: [C],
    });
    // Listed by QDN: not twice.
    const both = withPublishing(
      [listed, view({ id: 'newpoll1', poll: pending.newpoll1.poll })],
      pending,
      [A, B],
      T0
    );
    expect(both.filter((v) => v.id === 'newpoll1')).toHaveLength(1);
    expect(both.every((v) => !v.publishing)).toBe(true);
    // Nothing pending: the list as it is.
    expect(withPublishing([listed], {}, [A], T0)).toEqual([listed]);
  });
});
