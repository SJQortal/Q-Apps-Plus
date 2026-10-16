/**
 * Community votes, as everyone sees them (data/voteRecords.ts), on
 * nominations and on proposals to remove, ban or make a Minter Admin:
 *
 * - **One shared search** lists every vote of the last two signing windows
 *   (`identifier=qmp-vote-&prefix=true&after=…`, 100 a page, at most 3
 *   pages), so a page full of cards costs one GET. A round lasts at most two
 *   windows (a nomination waits at most one for its first approval, then its
 *   invite collects approvals for at most one; a proposal collects for one).
 * - **No bodies:** the vote is in the identifier.
 * - **When that list is full,** a card on screen searches its own nominee's
 *   (or proposal's) votes since its round began instead
 *   (hooks/useCommunityVotes.ts).
 *
 * Each voter's name is looked up once to the account that owns it (cached
 * 30 minutes), and the Minter Admins are read with it, so the rules can
 * leave their votes out. Nothing here writes.
 */
import type { VoteRow, VoteTopic } from '../rules/communityVotes';
import { getNameOwner } from './accounts';
import { getChainNow } from './chain';
import { getAdmins, getGroupInfo } from './group';
import { mapLimit, searchQdn } from './qdn';
import { fetchQuery } from './query';
import type { QdnRow } from './types';
import {
  VOTE_PREFIX,
  VOTE_SERVICE,
  decisionVoteSearchPrefix,
  parseDecisionVoteIdentifier,
  parseVoteIdentifier,
  voteSearchPrefix,
} from './voteRecords';

/** Pages of 100 rows read at most, newest first (the shared list, and one nominee's). */
export const VOTE_PAGES = 3;
const HOUR = 3_600_000;

export interface CommunityVoteData {
  /** Votes published after this time (ms) are all listed, unless `truncated`. */
  after: number;
  rows: VoteRow[];
  /** The search hit its ceiling. */
  truncated: boolean;
  /** The Minter Admins when it was read (the null owner too): their answers are on chain. */
  admins: string[];
}

/** A search row as a vote: on a nomination, or on a proposal (null when it is neither). */
function parseRow(
  row: QdnRow
): { row: QdnRow; topic: VoteTopic; nominee: string; vote: VoteRow['vote'] } | null {
  const nomination = parseVoteIdentifier(row.identifier);
  if (nomination) return { row, topic: 'nomination', ...nomination };
  const decision = parseDecisionVoteIdentifier(row.identifier);
  return decision
    ? { row, topic: decision.kind, nominee: decision.subject, vote: decision.vote }
    : null;
}

async function toVoteRows(rows: QdnRow[]): Promise<VoteRow[]> {
  const parsed = rows.flatMap((row) => {
    const vote = parseRow(row);
    return vote ? [vote] : [];
  });
  const owners = new Map<string, string | null>();
  await mapLimit([...new Set(parsed.map((p) => p.row.name))], 6, async (name) => {
    owners.set(name, await getNameOwner(name).catch(() => null));
  });
  return parsed.flatMap(({ row, topic, nominee, vote }) => {
    const voter = owners.get(row.name);
    return voter ? [{ voter, name: row.name, topic, nominee, vote, castAt: row.created }] : [];
  });
}

/** Every vote of the last two signing windows. Key `communityvotes:index`. */
export function loadVoteIndex(options: { force?: boolean } = {}): Promise<CommunityVoteData> {
  return fetchQuery(
    'communityvotes:index',
    async () => {
      const force = options.force;
      const [now, group, admins] = await Promise.all([getChainNow(), getGroupInfo(), getAdmins()]);
      const windowMs = (group.maximumBlockDelay + 1) * now.msPerBlock;
      // Rounded to the hour, so the search's own cache key holds for an hour.
      const after = Math.floor((now.timestamp - 2 * windowMs) / HOUR) * HOUR;
      const search = await searchQdn(
        { service: VOTE_SERVICE, identifier: VOTE_PREFIX, after, maxPages: VOTE_PAGES },
        { force }
      );
      return {
        after,
        rows: await toVoteRows(search.rows),
        truncated: search.truncated,
        admins: admins.admins.map((a) => a.member),
      };
    },
    { ttlMs: 60_000, force: options.force }
  );
}

/** Whether the shared list has every vote of a round that began at `since`. */
export function voteIndexCovers(index: CommunityVoteData, since: number): boolean {
  return !index.truncated && since > index.after;
}

/** One nominee's votes since `since` (ms). Key `communityvotes:nominee:<address>:<since>`. */
export function loadNomineeVotes(
  nominee: string,
  since: number,
  options: { force?: boolean } = {}
): Promise<CommunityVoteData> {
  return loadSubjectVotes('nomination', nominee, since, options);
}

/** The key of one round's own search. */
export function subjectVotesKey(topic: VoteTopic, subject: string, since: number): string {
  return topic === 'nomination'
    ? `communityvotes:nominee:${subject}:${since}`
    : `communityvotes:${topic}:${subject}:${since}`;
}

/**
 * The votes on one nomination, or one kind of proposal about `subject`,
 * since `since` (ms). Key `subjectVotesKey(…)`.
 */
export function loadSubjectVotes(
  topic: VoteTopic,
  subject: string,
  since: number,
  options: { force?: boolean } = {}
): Promise<CommunityVoteData> {
  return fetchQuery(
    subjectVotesKey(topic, subject, since),
    async () => {
      const force = options.force;
      const after = Math.max(0, since - 1);
      const [search, admins] = await Promise.all([
        searchQdn(
          {
            service: VOTE_SERVICE,
            identifier:
              topic === 'nomination'
                ? voteSearchPrefix(subject)
                : decisionVoteSearchPrefix(topic, subject),
            after,
            maxPages: VOTE_PAGES,
          },
          { force }
        ),
        getAdmins(),
      ]);
      return {
        after,
        rows: await toVoteRows(search.rows),
        truncated: search.truncated,
        admins: admins.admins.map((a) => a.member),
      };
    },
    { ttlMs: 60_000, force: options.force }
  );
}
