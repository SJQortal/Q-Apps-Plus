/**
 * Community votes (docs/apps/Q-Mintership+.md → Data contract): a Yes or No
 * on an open nomination from anyone who isn't a Minter Admin, so the admins
 * can weigh the community's view. Advisory: nothing on chain follows from it.
 *
 * Vote  service JSON, identifier `qmp-vote-<nomineeAddress>-<yes|no>-<id>`,
 *       published under the voter's name.
 *       { v: 1, nomineeAddress, vote }
 *
 * The vote is in the identifier, so readers take it from the search row and
 * never read the body (which repeats it for other readers). Each vote is a
 * new record with a new `id` (6 letters or digits): Core lists and limits a
 * search by when a resource was first published, so a republished
 * identifier would sort under its first date. Per account, the newest vote
 * counts (rules/communityVotes.ts).
 */
import { isAddress } from './accounts';
import { randomCommentId } from './commentRecords';
import { IDENTIFIER_MAX, RECORD_SERVICE } from './records';

export { RECORD_SERVICE as VOTE_SERVICE };

export const VOTE_PREFIX = 'qmp-vote-';

export type CommunityVoteValue = 'yes' | 'no';

export interface CommunityVoteRecord {
  v: 1;
  nomineeAddress: string;
  vote: CommunityVoteValue;
}

const B58 = '1-9A-HJ-NP-Za-km-z';
const VOTE_ID_RE = new RegExp(`^${VOTE_PREFIX}([${B58}]{34})-(yes|no)-([A-Za-z0-9]{6})$`);

function isVote(value: unknown): value is CommunityVoteValue {
  return value === 'yes' || value === 'no';
}

/** One nominee's votes: the prefix their own search uses. */
export function voteSearchPrefix(nominee: string): string {
  return `${VOTE_PREFIX}${nominee}-`;
}

/** A new vote's identifier (a new `id` each time). Throws on a malformed nominee or vote. */
export function newVoteIdentifier(
  nominee: string,
  vote: CommunityVoteValue,
  id: string = randomCommentId()
): string {
  if (!isAddress(nominee)) throw new Error('Not a valid Qortal address.');
  if (!isVote(vote)) throw new Error('A vote is Yes or No.');
  const identifier = `${voteSearchPrefix(nominee)}${vote}-${id}`;
  if (!VOTE_ID_RE.test(identifier) || identifier.length > IDENTIFIER_MAX)
    throw new Error('Not a vote identifier.');
  return identifier;
}

/** The nominee and the vote a search row's identifier carries, or null when it isn't a vote. */
export function parseVoteIdentifier(
  identifier: unknown
): { nominee: string; vote: CommunityVoteValue } | null {
  if (typeof identifier !== 'string') return null;
  const match = VOTE_ID_RE.exec(identifier);
  if (!match || !isAddress(match[1])) return null;
  return { nominee: match[1], vote: match[2] as CommunityVoteValue };
}

/** The record to publish: the body repeats what the identifier says. Throws on bad input. */
export function buildVote(nominee: string, vote: CommunityVoteValue): CommunityVoteRecord {
  if (!isAddress(nominee)) throw new Error('Not a valid Qortal address.');
  if (!isVote(vote)) throw new Error('A vote is Yes or No.');
  return { v: 1, nomineeAddress: nominee, vote };
}
