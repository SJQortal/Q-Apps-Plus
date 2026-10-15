/**
 * The community's Yes and No on a nomination: advisory votes from anyone who
 * isn't a Minter Admin. Pure; data/communityVotes.ts reads the rows.
 *
 * - Per account only its newest vote counts (by when it was published), so
 *   one account's names count once and changing a vote replaces it.
 * - A vote counts in the round it was cast in: from the nomination's start.
 * - Votes from current Minter Admins (their answer is on chain) and from the
 *   nominee are left out.
 */
import type { CommunityVoteValue } from '../data/voteRecords';
import type { DecisionPhase } from './decision';
import type { NominationState } from './nomination';

/** A decision whose approvals can still count: until then votes are offered. */
export const VOTING_PHASES: ReadonlySet<DecisionPhase> = new Set(['early', 'open', 'unconfirmed']);

/**
 * Whether a nomination takes votes: waiting for its first approval, or
 * collecting approvals that can still count (not once the count has decided
 * it, nor after the last block an approval counts in).
 */
export function takesVotes(
  state: NominationState,
  phase: DecisionPhase | null | undefined
): boolean {
  return state === 'waiting' || (state === 'signing' && Boolean(phase && VOTING_PHASES.has(phase)));
}

export interface VoteRow {
  /** The account that owns the name it was published under. */
  voter: string;
  /** That name. */
  name: string;
  nominee: string;
  vote: CommunityVoteValue;
  /** When it was published (the QDN row's `created`, ms). */
  castAt: number;
}

export interface CommunityVoter {
  address: string;
  name: string;
  vote: CommunityVoteValue;
  castAt: number;
}

export interface CommunityTally {
  /** Oldest first. */
  yes: CommunityVoter[];
  no: CommunityVoter[];
}

export interface VoteRound {
  nominee: string;
  /** When the round began (ms): votes cast before it belong to an earlier one. */
  since: number;
}

export const NO_VOTES: CommunityTally = { yes: [], no: [] };

/** Each account's newest vote in `round`, less Minter Admins (`excluded`) and the nominee. */
export function communityVotesFor(
  rows: readonly VoteRow[],
  round: VoteRound,
  excluded: ReadonlySet<string>
): CommunityTally {
  const latest = new Map<string, VoteRow>();
  for (const row of rows) {
    if (row.nominee !== round.nominee || row.castAt < round.since) continue;
    const current = latest.get(row.voter);
    if (!current || row.castAt > current.castAt) latest.set(row.voter, row);
  }
  const tally: CommunityTally = { yes: [], no: [] };
  for (const row of latest.values()) {
    if (row.voter === round.nominee || excluded.has(row.voter)) continue;
    tally[row.vote].push({
      address: row.voter,
      name: row.name,
      vote: row.vote,
      castAt: row.castAt,
    });
  }
  tally.yes.sort((a, b) => a.castAt - b.castAt);
  tally.no.sort((a, b) => a.castAt - b.castAt);
  return tally;
}

/** A vote from this device still on its way (writes/optimistic.ts PendingWrite). */
export interface VoteWrite {
  status: 'sending' | 'confirming' | 'failed';
  at: number;
}

export interface MyCommunityVote {
  /** The vote shown as theirs: from QDN, or one from this device on its way. */
  vote: CommunityVoteValue | null;
  /** QDN shows it; false while this device's vote is on its way. */
  settled: boolean;
  /** A vote from this device is being sent or is on its way: no new one until it shows. */
  busy: boolean;
  /** Being sent right now. */
  sending: CommunityVoteValue | null;
}

/** Entries older than this are dropped (as writes/optimistic.ts does). */
const WRITE_EXPIRE_MS = 15 * 60_000;

/**
 * This account's vote as the card shows it: what QDN says, unless a newer
 * vote from this device hasn't shown up there yet.
 */
export function myCommunityVote(
  tally: CommunityTally,
  myAddress: string,
  pending: { yes: VoteWrite | null; no: VoteWrite | null },
  nowMs = Date.now()
): MyCommunityVote {
  const onQdn: CommunityVoteValue | null = tally.yes.some((v) => v.address === myAddress)
    ? 'yes'
    : tally.no.some((v) => v.address === myAddress)
      ? 'no'
      : null;
  const live = (w: VoteWrite | null) =>
    w && (w.status === 'sending' || w.status === 'confirming') && nowMs - w.at <= WRITE_EXPIRE_MS
      ? w
      : null;
  const yes = live(pending.yes);
  const no = live(pending.no);
  const newest: CommunityVoteValue | null =
    yes && no ? (yes.at >= no.at ? 'yes' : 'no') : yes ? 'yes' : no ? 'no' : null;
  const write = newest === 'yes' ? yes : newest === 'no' ? no : null;
  if (!newest || !write) return { vote: onQdn, settled: true, busy: false, sending: null };
  if (write.status === 'sending')
    return { vote: onQdn, settled: true, busy: true, sending: newest };
  const settled = onQdn === newest;
  return { vote: newest, settled, busy: !settled, sending: null };
}
