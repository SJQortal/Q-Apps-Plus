/**
 * Community votes (docs/apps/Q-Mintership+.md → Data contract): a Yes or No
 * from anyone who isn't a Minter Admin, so the admins can weigh the
 * community's view. Advisory: nothing on chain follows from it. On an open
 * nomination, or on a proposal to remove a member, ban an account or make a
 * Minter Admin (Yes: for the proposal).
 *
 * Vote  service JSON, identifier `qmp-vote-<nomineeAddress>-<yes|no>-<id>`,
 *       published under the voter's name.
 *       { v: 1, nomineeAddress, vote }
 *
 * Decision vote  service JSON, identifier
 *       `qmp-vote-<remove|ban|admin>-<subjectAddress>-<yes|no>-<id>`
 *       (a GROUP_KICK that isn't a declined join request, a GROUP_BAN, an
 *       ADD_GROUP_ADMIN), published under the voter's name.
 *       { v: 1, kind: 'kick' | 'ban' | 'addAdmin', subjectAddress, vote }
 *
 * The shared search for `qmp-vote-` lists both; a nomination vote's
 * identifier never reads as a decision vote, nor the other way round.
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

/** The proposals everyone may vote on, by decision kind. */
export type DecisionVoteKind = 'kick' | 'ban' | 'addAdmin';

/** Each kind's word in the identifier. */
const KIND_WORD: Record<DecisionVoteKind, string> = {
  kick: 'remove',
  ban: 'ban',
  addAdmin: 'admin',
};
const KIND_OF_WORD = new Map(
  Object.entries(KIND_WORD).map(([kind, word]) => [word, kind as DecisionVoteKind])
);
const DECISION_VOTE_ID_RE = new RegExp(
  `^${VOTE_PREFIX}(remove|ban|admin)-([${B58}]{34})-(yes|no)-([A-Za-z0-9]{6})$`
);

export interface DecisionVoteRecord {
  v: 1;
  kind: DecisionVoteKind;
  subjectAddress: string;
  vote: CommunityVoteValue;
}

export function isDecisionVoteKind(kind: unknown): kind is DecisionVoteKind {
  return typeof kind === 'string' && Object.prototype.hasOwnProperty.call(KIND_WORD, kind);
}

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

/** One proposal's votes (its kind, the account it is about): the prefix their own search uses. */
export function decisionVoteSearchPrefix(kind: DecisionVoteKind, subject: string): string {
  return `${VOTE_PREFIX}${KIND_WORD[kind]}-${subject}-`;
}

/** A new decision vote's identifier (a new `id` each time). Throws on malformed input. */
export function newDecisionVoteIdentifier(
  kind: DecisionVoteKind,
  subject: string,
  vote: CommunityVoteValue,
  id: string = randomCommentId()
): string {
  if (!isDecisionVoteKind(kind))
    throw new Error('Votes are only on removals, bans and new admins.');
  if (!isAddress(subject)) throw new Error('Not a valid Qortal address.');
  if (!isVote(vote)) throw new Error('A vote is Yes or No.');
  const identifier = `${decisionVoteSearchPrefix(kind, subject)}${vote}-${id}`;
  if (!DECISION_VOTE_ID_RE.test(identifier) || identifier.length > IDENTIFIER_MAX)
    throw new Error('Not a vote identifier.');
  return identifier;
}

/** The kind, the account and the vote a decision vote's identifier carries, or null. */
export function parseDecisionVoteIdentifier(
  identifier: unknown
): { kind: DecisionVoteKind; subject: string; vote: CommunityVoteValue } | null {
  if (typeof identifier !== 'string') return null;
  const match = DECISION_VOTE_ID_RE.exec(identifier);
  const kind = match ? KIND_OF_WORD.get(match[1]) : undefined;
  if (!match || !kind || !isAddress(match[2])) return null;
  return { kind, subject: match[2], vote: match[3] as CommunityVoteValue };
}

/** A decision vote's record: the body repeats what the identifier says. Throws on bad input. */
export function buildDecisionVote(
  kind: DecisionVoteKind,
  subject: string,
  vote: CommunityVoteValue
): DecisionVoteRecord {
  if (!isDecisionVoteKind(kind))
    throw new Error('Votes are only on removals, bans and new admins.');
  if (!isAddress(subject)) throw new Error('Not a valid Qortal address.');
  if (!isVote(vote)) throw new Error('A vote is Yes or No.');
  return { v: 1, kind, subjectAddress: subject, vote };
}
