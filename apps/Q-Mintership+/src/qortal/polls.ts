/**
 * Polls (legacy QortalApi.js "Qortal poll-related calls"). Every board card
 * has a poll named after it with the options "Yes" / "No"; results come from
 * Core and are cached, votes go through Hub.
 */
import { coreGet, coreJson, qortal } from './client';
import { memoizeAsync } from './cache';
import {
  POLL_RESULTS_FETCH_RETRY_ATTEMPTS,
  POLL_RESULTS_FETCH_RETRY_DELAY_CAP_MS,
  POLL_RESULTS_FETCH_RETRY_DELAY_MS,
} from './constants';
import { sleep, trimString } from './util';

export interface PollVoteCount {
  optionName: string;
  voteCount: number;
}

export interface PollVote {
  voterPublicKey: string;
  optionIndex: number;
}

export interface PollResults {
  totalVotes: number;
  voteCounts: PollVoteCount[];
  votes: PollVote[];
}

export interface PollInfo {
  pollName: string;
  description: string;
  creatorPublicKey: string;
  owner: string;
  published: number;
  pollOptions: Array<{ optionName: string }>;
}

/** The option list the legacy app passed to CREATE_POLL, kept byte for byte. */
export const LEGACY_POLL_OPTIONS = ['Yes, No'] as const;

/** Option index 0 is Yes and 1 is No on every board poll. */
export const POLL_OPTION_YES = 0;
export const POLL_OPTION_NO = 1;

const pollOwnerCache = new Map<string, string | null>();
const pollOwnerInflight = new Map<string, Promise<string | null>>();
const pollResultsCache = new Map<string, Promise<PollResults | null>>();

export function clearPollResultsCache(): void {
  pollResultsCache.clear();
}

export function resetPollCaches(): void {
  pollOwnerCache.clear();
  pollResultsCache.clear();
}

/** `/polls/{pollName}`; null on failure. */
export async function getPollInfo(pollName: string): Promise<PollInfo | null> {
  try {
    const response = await coreGet(`/polls/${pollName}`);
    if (!response.ok) return null;
    return (await response.json()) as PollInfo;
  } catch {
    return null;
  }
}

export async function getPollOwnerAddress(pollName: string): Promise<string | null> {
  return (await getPollInfo(pollName))?.owner ?? null;
}

export function getPollOwnerAddressCached(pollName: string): Promise<string | null> {
  return memoizeAsync(pollOwnerCache, pollOwnerInflight, pollName, () =>
    getPollOwnerAddress(pollName)
  );
}

export async function getPollPublisherPublicKey(pollName: string): Promise<string | null> {
  return (await getPollInfo(pollName))?.creatorPublicKey ?? null;
}

async function fetchPollResultsOnce(pollName: string): Promise<PollResults> {
  const data = await coreJson<PollResults>(`/polls/votes/${pollName}`);
  if (!data || typeof data !== 'object') throw new Error('Poll results response was empty or invalid.');
  return data;
}

/**
 * `/polls/votes/{pollName}` with the legacy retry (10 attempts, 500 ms
 * doubling, 5 s cap) because Core answers 404 until a new poll confirms.
 * Null when every attempt failed.
 */
export async function fetchPollResults(pollName: string): Promise<PollResults | null> {
  const normalized = trimString(pollName);
  if (!normalized) return null;
  for (let attempt = 1; attempt <= POLL_RESULTS_FETCH_RETRY_ATTEMPTS; attempt++) {
    try {
      return await fetchPollResultsOnce(normalized);
    } catch {
      if (attempt < POLL_RESULTS_FETCH_RETRY_ATTEMPTS) {
        await sleep(
          Math.min(
            POLL_RESULTS_FETCH_RETRY_DELAY_CAP_MS,
            POLL_RESULTS_FETCH_RETRY_DELAY_MS * 2 ** (attempt - 1)
          )
        );
      }
    }
  }
  return null;
}

/** Results cached for the session; a null result is not cached. */
export async function fetchPollResultsCached(pollName: string): Promise<PollResults | null> {
  const normalized = trimString(pollName);
  if (!normalized) return null;
  const cached = pollResultsCache.get(normalized);
  if (cached) return cached;
  const request = fetchPollResults(normalized).then((result) => {
    if (result) pollResultsCache.set(normalized, Promise.resolve(result));
    else pollResultsCache.delete(normalized);
    return result;
  });
  pollResultsCache.set(normalized, request);
  return request;
}

/** VOTE_ON_POLL. Hub confirms with the user; this spends the tx fee. */
export async function voteOnPoll(pollName: string, optionIndex: number): Promise<unknown> {
  return qortal({ action: 'VOTE_ON_POLL', pollName, optionIndex });
}

export function voteYesOnPoll(pollName: string): Promise<unknown> {
  return voteOnPoll(pollName, POLL_OPTION_YES);
}

export function voteNoOnPoll(pollName: string): Promise<unknown> {
  return voteOnPoll(pollName, POLL_OPTION_NO);
}

/** CREATE_POLL with the legacy option list. Hub confirms; this spends the tx fee. */
export async function createBoardPoll(params: {
  pollName: string;
  pollDescription: string;
  pollOwnerAddress: string;
}): Promise<unknown> {
  return qortal({
    action: 'CREATE_POLL',
    pollName: params.pollName,
    pollDescription: params.pollDescription,
    pollOptions: [...LEGACY_POLL_OPTIONS],
    pollOwnerAddress: params.pollOwnerAddress,
  });
}
