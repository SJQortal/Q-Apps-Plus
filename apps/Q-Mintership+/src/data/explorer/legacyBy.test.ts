/**
 * What an account posted in the original app (legacyBy.ts): its cards and
 * comment counts by exact name, never the bare `comment-` prefix other apps
 * use, the encrypted admin board as counts; and its poll votes, read through
 * the heavy-read slot and mapped by each poll's own option list.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCallsFor, mockFetchRoute } from '../../test/setup';
import { ADDR, NOW, installWorld } from '../../test/world';
import { addPollVotes } from '../../pages/explorer/account/mintership/testWorld';
import { queryLoadCounts } from '../query';
import { heavyLoad } from './heavy';
import type { QdnRow, TxRow } from '../types';
import {
  cardOfPoll,
  commentedCard,
  legacyFromRows,
  loadLegacyBy,
  loadPollVotes,
  pollVotesFrom,
  voteOption,
} from './legacyBy';

afterEach(() => vi.useRealTimers());

const row = (name: string, identifier: string, created = 1_000, service = 'BLOG_POST'): QdnRow => ({
  name,
  service,
  identifier,
  created,
});

describe('legacyFromRows', () => {
  it('lists their cards and counts their comments, under their exact names only', () => {
    const posted = legacyFromRows(['Nora', 'Spare'], {
      minterCards: {
        rows: [
          row('Nora', 'Minter-board-card-aaa', 1_000),
          row('Spare', 'Minter-board-card-bbb', 3_000),
          row('Nora Nominator', 'Minter-board-card-ccc', 2_000),
        ],
        truncated: false,
      },
      arCards: { rows: [row('Nora', 'QM-AR-card-ddd', 2_000)], truncated: false },
      minterComments: {
        rows: [
          row('Nora', 'comment-Minter-board-card-aaa-c1'),
          row('Nora', 'comment-Minter-board-card-aaa-c2'),
          row('Spare', 'comment-Minter-board-card-zzz-c3'),
        ],
        truncated: true,
      },
      arComments: { rows: [], truncated: false },
      adminCards: {
        rows: [row('Nora', 'card-MAC-NC-1780000000000-a1B2c3', 1_000, 'MAIL_PRIVATE')],
        truncated: false,
      },
      adminComments: {
        rows: [
          row('Nora', 'comment-card-MAC-NC-1780000000000-a1B2c3-x1', 1_000, 'MAIL_PRIVATE'),
          row('Nora', 'comment-card-MAC-NC-1780000000000-a1B2c3-x2', 1_000, 'MAIL_PRIVATE'),
        ],
        truncated: false,
      },
    });
    expect(posted.cards.map((c) => [c.identifier, c.publisher, c.board])).toEqual([
      ['Minter-board-card-bbb', 'Spare', 'minter'],
      ['QM-AR-card-ddd', 'Nora', 'ar'],
      ['Minter-board-card-aaa', 'Nora', 'minter'],
    ]);
    expect(posted.minterComments).toEqual({ comments: 3, cards: 2 });
    expect(posted.arComments).toEqual({ comments: 0, cards: 0 });
    expect(posted.adminCards).toBe(1);
    expect(posted.adminComments).toBe(2);
    expect(posted.namesWithRecords).toEqual(['Nora', 'Spare']);
    expect(posted.truncated).toEqual(['minterComments']);
    // The encrypted board is counted: none of its identifiers is kept.
    expect(JSON.stringify(posted)).not.toMatch(/card-MAC/);
  });

  it('reads the card a comment is on from its identifier', () => {
    expect(commentedCard('comment-Minter-board-card-bQ7xK2-c0mm01')).toBe(
      'Minter-board-card-bQ7xK2'
    );
    expect(commentedCard('comment-QM-AR-card-Pr0m0t-ar0001')).toBe('QM-AR-card-Pr0m0t');
    expect(commentedCard('comment-some-other-app-123')).toBeNull();
    expect(commentedCard('Minter-board-card-bQ7xK2')).toBeNull();
  });
});

describe('loadLegacyBy', () => {
  it('searches by name with each card prefix, never the bare comment- prefix', async () => {
    installWorld('admin', { strict: true });
    const posted = await loadLegacyBy(ADDR.admin);
    const searched = fetchCallsFor('/arbitrary/resources/searchsimple').map(
      (path) => new URL(path, 'http://x').searchParams
    );
    expect(new Set(searched.map((sp) => `${sp.get('service')} ${sp.get('identifier')}`))).toEqual(
      new Set([
        'BLOG_POST Minter-board-card-',
        'BLOG_POST QM-AR-card-',
        'BLOG_POST comment-Minter-board-card-',
        'BLOG_POST comment-QM-AR-card-',
        'MAIL_PRIVATE card-MAC-',
        'MAIL_PRIVATE comment-card-MAC-',
      ])
    );
    for (const sp of searched) {
      expect(sp.getAll('name')).toEqual(['Avery Admin', 'Avery Two', 'AA Maps']);
      expect(sp.get('prefix')).toBe('true');
    }
    expect(posted.cards.map((c) => c.identifier)).toEqual(['QM-AR-card-Pr0m0t']);
    expect(posted.minterComments).toEqual({ comments: 1, cards: 1 });
    expect(posted.namesWithRecords).toEqual(['Avery Admin']);
  });
});

describe('poll votes', () => {
  it('maps a vote by the poll’s own options, whatever their order', () => {
    expect(voteOption({ options: ['No', 'Yes'] }, 1)).toEqual({ option: 'Yes', answer: 'yes' });
    expect(voteOption({ options: ['Yes', 'No'] }, 1)).toEqual({ option: 'No', answer: 'no' });
    expect(voteOption({ options: ['Yes', 'No', 'Abstain'] }, 2)).toEqual({
      option: 'Abstain',
      answer: 'other',
    });
    expect(voteOption({ options: ['Yes', 'No'] }, 5)).toEqual({ option: null, answer: null });
    expect(voteOption(null, 0)).toEqual({ option: null, answer: null });
    expect(cardOfPoll('Minter-board-card-x1-poll')).toBe('Minter-board-card-x1');
    expect(cardOfPoll('Some app poll')).toBeNull();
  });

  it('lists the public boards’ votes and only counts the rest', () => {
    const vote = (pollName: string, optionIndex: number, i: number): TxRow => ({
      type: 'VOTE_ON_POLL',
      timestamp: 1_000 + i,
      signature: `sig${i}`,
      txGroupId: 0,
      blockHeight: 100 + i,
      pollName,
      optionIndex,
    });
    const votes = pollVotesFrom(
      [
        vote('Minter-board-card-a-poll', 0, 1),
        vote('QM-AR-card-b-poll', 0, 2),
        vote('card-MAC-NC-1-x-poll', 1, 3),
        vote('Other app poll', 0, 4),
        vote('Minter-board-card-a-poll', 0, 1),
      ],
      new Map([
        [
          'Minter-board-card-a-poll',
          { pollName: '', description: 'For Bob', owner: '', published: 0, options: ['No', 'Yes'] },
        ],
      ])
    );
    expect(votes.votes.map((v) => [v.card, v.answer, v.description])).toEqual([
      ['QM-AR-card-b', null, ''],
      ['Minter-board-card-a', 'no', 'For Bob'],
    ]);
    expect(votes.adminBoard).toBe(1);
    expect(votes.other).toBe(1);
    expect(votes.truncated).toBe(false);
  });

  it('reads their newest 100 votes through the heavy slot, then each poll once', async () => {
    const { world } = installWorld('admin', { strict: true });
    addPollVotes(world, ADDR.nominator);
    mockFetchRoute('/polls/Minter-board-card-Kt3mPq-poll', {
      pollName: 'Minter-board-card-Kt3mPq-poll',
      description: 'Mintership Board Poll for Kit',
      owner: ADDR.kicked,
      published: NOW,
      pollOptions: [{ optionName: 'No' }, { optionName: 'Yes' }],
    });
    const reading = loadPollVotes(ADDR.nominator);
    expect(heavyLoad()).toEqual({ running: 1, queued: 0 });
    const votes = await reading;
    const search = new URL(fetchCallsFor('/transactions/search')[0], 'http://x').searchParams;
    expect(search.get('address')).toBe(ADDR.nominator);
    expect(search.get('txType')).toBe('VOTE_ON_POLL');
    expect(search.get('limit')).toBe('100');
    expect(search.get('reverse')).toBe('true');
    expect(votes.votes.map((v) => [v.card, v.answer])).toEqual([
      ['Minter-board-card-Kt3mPq', 'yes'],
      ['Minter-board-card-bQ7xK2', 'no'],
    ]);
    expect(votes.adminBoard).toBe(1);
    expect(votes.other).toBe(1);
    // Encrypted board and other apps' polls aren't read.
    expect(fetchCallsFor('/polls/').sort()).toEqual([
      '/polls/Minter-board-card-Kt3mPq-poll',
      '/polls/Minter-board-card-bQ7xK2-poll',
    ]);
    expect(queryLoadCounts().xpollvotes).toBe(1);
  });
});
