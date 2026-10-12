import { describe, expect, it } from 'vitest';
import { fetchCallsFor, mockFetchRoute, qortalCalls } from '../test/setup';
import { getPollCounts, getPollInfo, pollNameFor } from './polls';

const NOT_FOUND = () =>
  new Response(JSON.stringify({ error: 501, message: 'POLL_NO_EXISTS' }), { status: 404 });

describe('old board polls (read-only)', () => {
  it('names a card poll after the card', () => {
    expect(pollNameFor('Minter-board-card-abc123')).toBe('Minter-board-card-abc123-poll');
  });

  it('reads counts by option name, whatever order Core lists them in', async () => {
    mockFetchRoute('/polls/votes/', () => ({
      totalVotes: 10,
      totalWeight: 15_545_388,
      voteCounts: [
        { optionName: 'No', voteCount: 3 },
        { optionName: 'Yes', voteCount: 7 },
      ],
    }));
    expect(await getPollCounts('Minter-board-card-abc123-poll')).toEqual({
      yes: 7,
      no: 3,
      total: 10,
    });
    expect(fetchCallsFor('/polls/votes/')).toEqual([
      '/polls/votes/Minter-board-card-abc123-poll?onlyCounts=true',
    ]);
  });

  it('tolerates odd answers without inventing votes', async () => {
    mockFetchRoute('/polls/votes/', () => ({ voteCounts: [{ optionName: 'Yes', voteCount: -2 }] }));
    expect(await getPollCounts('p')).toEqual({ yes: 0, no: 0, total: 0 });
  });

  it('answers null for a poll Core does not have, and asks only once', async () => {
    mockFetchRoute('/polls/', NOT_FOUND);
    expect(await getPollCounts('missing-poll')).toBeNull();
    expect(await getPollInfo('missing-poll')).toBeNull();
    expect(fetchCallsFor('/polls/')).toHaveLength(2);
  });

  it('reports other failures to the caller', async () => {
    mockFetchRoute('/polls/', () => new Response('boom', { status: 500 }));
    await expect(getPollCounts('p')).rejects.toThrow(/500/);
  });

  it('reads the owner and options, encoding unusual poll names', async () => {
    mockFetchRoute('/polls/', () => ({
      pollName: 'a b/c-poll',
      description: 'Mintership Board Poll for Bob',
      owner: 'QOwner',
      published: 5,
      pollOptions: [{ optionName: 'Yes' }, { optionName: 'No' }],
    }));
    const info = await getPollInfo('a b/c-poll');
    expect(info).toEqual({
      pollName: 'a b/c-poll',
      description: 'Mintership Board Poll for Bob',
      owner: 'QOwner',
      published: 5,
      options: ['Yes', 'No'],
    });
    expect(fetchCallsFor('/polls/')).toEqual(['/polls/a%20b%2Fc-poll']);
  });

  it('never goes through Hub (no votes, no new polls)', async () => {
    mockFetchRoute('/polls/', NOT_FOUND);
    await getPollCounts('p');
    expect(qortalCalls).toHaveLength(0);
  });
});
