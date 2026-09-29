import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCallsFor, mockFetchRoute, mockQortalRequest, qortalCallsFor } from '../test/setup';
import {
  createBoardPoll,
  fetchPollResults,
  fetchPollResultsCached,
  getPollOwnerAddressCached,
  resetPollCaches,
  voteNoOnPoll,
  voteYesOnPoll,
} from './polls';

const RESULTS = {
  totalVotes: 2,
  voteCounts: [
    { optionName: 'Yes', voteCount: 1 },
    { optionName: 'No', voteCount: 1 },
  ],
  votes: [],
};

beforeEach(() => resetPollCaches());

describe('poll results', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('retries with the legacy backoff until Core answers', async () => {
    let calls = 0;
    mockFetchRoute('/polls/votes/', () => {
      calls += 1;
      return calls < 3 ? new Response('not yet', { status: 404 }) : RESULTS;
    });
    const promise = fetchPollResults('Minter-board-card-abc');
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(promise).resolves.toEqual(RESULTS);
    expect(calls).toBe(3);
  });

  it('gives up after ten attempts and returns null', async () => {
    mockFetchRoute('/polls/votes/', new Response('nope', { status: 500 }));
    const promise = fetchPollResults('missing');
    await vi.advanceTimersByTimeAsync(60_000);
    await expect(promise).resolves.toBeNull();
    expect(fetchCallsFor('/polls/votes/')).toHaveLength(10);
  });

  it('caches successful results for the session and merges concurrent calls', async () => {
    mockFetchRoute('/polls/votes/', RESULTS);
    await Promise.all([fetchPollResultsCached('p1'), fetchPollResultsCached('p1')]);
    await fetchPollResultsCached('p1');
    expect(fetchCallsFor('/polls/votes/')).toEqual(['/polls/votes/p1']);
    await expect(fetchPollResultsCached('')).resolves.toBeNull();
  });
});

describe('poll info and votes', () => {
  it('caches the owner lookup', async () => {
    mockFetchRoute('/polls/', { pollName: 'p', owner: 'Qowner', creatorPublicKey: 'PK' });
    await expect(getPollOwnerAddressCached('p')).resolves.toBe('Qowner');
    await getPollOwnerAddressCached('p');
    expect(fetchCallsFor('/polls/p')).toHaveLength(1);
  });

  it('votes Yes as option 0 and No as option 1 through the mocked bridge', async () => {
    mockQortalRequest('VOTE_ON_POLL', { signature: 'sig' });
    await voteYesOnPoll('p');
    await voteNoOnPoll('p');
    expect(qortalCallsFor('VOTE_ON_POLL')).toEqual([
      { action: 'VOTE_ON_POLL', pollName: 'p', optionIndex: 0 },
      { action: 'VOTE_ON_POLL', pollName: 'p', optionIndex: 1 },
    ]);
  });

  it('creates a poll with the exact legacy option list', async () => {
    mockQortalRequest('CREATE_POLL', { signature: 'sig' });
    await createBoardPoll({ pollName: 'p', pollDescription: 'd', pollOwnerAddress: 'Qo' });
    expect(qortalCallsFor('CREATE_POLL')).toEqual([
      {
        action: 'CREATE_POLL',
        pollName: 'p',
        pollDescription: 'd',
        pollOptions: ['Yes, No'],
        pollOwnerAddress: 'Qo',
      },
    ]);
  });
});
