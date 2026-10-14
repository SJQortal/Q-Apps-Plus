/**
 * The original Q-Mintership's chain polls, read-only. Every old board card
 * has a poll named `<cardIdentifier>-poll` with the options Yes and No.
 * Q-Mintership+ has no votes: these reads only show an old card's result in
 * History, so there is no retry loop and nothing here can vote or create.
 *
 * Core lists the options in the order they were created ("No" can come
 * first), so counts are read by option name, never by index.
 */
import { CoreHttpError, coreJson } from './client';

/** `GET /polls/{pollName}` (the fields History shows). */
export interface PollInfo {
  pollName: string;
  description: string;
  /** The address the poll belongs to. The original app only listed a card when this was its publisher. */
  owner: string;
  published: number;
  options: string[];
}

/** `GET /polls/votes/{pollName}?onlyCounts=true`, reduced to the board's Yes/No. */
export interface PollCounts {
  yes: number;
  no: number;
  total: number;
}

/** The poll name of an old board card. */
export function pollNameFor(cardIdentifier: string): string {
  return `${cardIdentifier}-poll`;
}

function isMissing(error: unknown): boolean {
  return error instanceof CoreHttpError && error.status === 404;
}

/** A poll's owner and options; null when Core has no poll by that name. */
export async function getPollInfo(pollName: string): Promise<PollInfo | null> {
  try {
    const body = await coreJson<Record<string, unknown>>(`/polls/${encodeURIComponent(pollName)}`);
    const options = Array.isArray(body?.pollOptions)
      ? body.pollOptions
          .map((o) =>
            o && typeof o === 'object' ? (o as { optionName?: unknown }).optionName : ''
          )
          .filter((name): name is string => typeof name === 'string')
      : [];
    return {
      pollName: typeof body?.pollName === 'string' ? body.pollName : pollName,
      description: typeof body?.description === 'string' ? body.description : '',
      owner: typeof body?.owner === 'string' ? body.owner : '',
      published: Number(body?.published ?? 0),
      options,
    };
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

/** Yes and No counts (one account, one vote, as Core counts); null when there is no such poll. */
export async function getPollCounts(pollName: string): Promise<PollCounts | null> {
  try {
    const body = await coreJson<Record<string, unknown>>(
      `/polls/votes/${encodeURIComponent(pollName)}?onlyCounts=true`
    );
    const counts = Array.isArray(body?.voteCounts) ? body.voteCounts : [];
    const count = (option: string) => {
      const row = counts.find(
        (c) =>
          c &&
          typeof c === 'object' &&
          String((c as { optionName?: unknown }).optionName ?? '')
            .trim()
            .toLowerCase() === option
      ) as { voteCount?: unknown } | undefined;
      const value = Number(row?.voteCount ?? 0);
      return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
    };
    const yes = count('yes');
    const no = count('no');
    const total = Number(body?.totalVotes);
    return { yes, no, total: Number.isFinite(total) && total >= yes + no ? total : yes + no };
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}
