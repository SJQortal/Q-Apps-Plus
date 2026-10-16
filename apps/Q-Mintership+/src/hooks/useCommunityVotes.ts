/**
 * Community votes for one card (a nomination, or a proposal to remove, ban
 * or make a Minter Admin): the round's Yes and No (one shared read for
 * every card; the card's own search when that list is full, once the card
 * is near the screen), this account's own vote with what this device is
 * still publishing, and who may vote here.
 */
import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import {
  loadSubjectVotes,
  loadVoteIndex,
  subjectVotesKey,
  voteIndexCovers,
} from '../data/communityVotes';
import { getAdmins } from '../data/group';
import {
  NO_VOTES,
  communityVotesFor,
  myCommunityVote,
  type CommunityTally,
  type MyCommunityVote,
  type VoteTopic,
} from '../rules/communityVotes';
import { signerOf, useSession } from '../state/session';
import { CONFIRMING_WINDOW_MS, pendingWritesAtom, writeKeys } from '../writes/optimistic';
import type { Signer } from '../writes/runner';
import { CONFIRMING_REFRESH_MS } from './useData';
import { useQuery } from './useQuery';

/** Votes change slowly: the shared read refreshes every 3 minutes while visible. */
export const VOTES_REFRESH_MS = 3 * 60_000;

export interface CommunityVotesView {
  tally: CommunityTally;
  /** This account's vote (null without `myAddress`). */
  mine: MyCommunityVote | null;
}

/**
 * The community's votes on a round (`since`: when it began) of a nomination,
 * or of a proposal (`topic`, its kind) about `nominee`. `nearScreen` lets
 * the card search its own round when the shared list can't cover it.
 */
export function useCommunityVotes(
  round: { topic?: VoteTopic; nominee: string; since: number } | null,
  options: { nearScreen?: boolean; myAddress?: string | null } = {}
): CommunityVotesView {
  const nominee = round?.nominee ?? null;
  const since = round?.since ?? 0;
  const topic = round?.topic ?? 'nomination';
  const writes = useAtomValue(pendingWritesAtom);
  const pendingYes = nominee
    ? (writes[writeKeys.communityVote(nominee, 'yes', topic)] ?? null)
    : null;
  const pendingNo = nominee
    ? (writes[writeKeys.communityVote(nominee, 'no', topic)] ?? null)
    : null;
  // While this device's vote waits for its block, look more often so it settles soon after.
  const now = Date.now();
  const waiting = [pendingYes, pendingNo].some(
    (w) => w && w.status === 'confirming' && now - w.at <= CONFIRMING_WINDOW_MS
  );
  const refreshMs = waiting ? CONFIRMING_REFRESH_MS : VOTES_REFRESH_MS;

  const index = useQuery('communityvotes:index', (force) => loadVoteIndex({ force }), {
    refreshMs,
    enabled: nominee !== null,
  });
  const own = Boolean(
    nominee && index.data && !voteIndexCovers(index.data, since) && options.nearScreen !== false
  );
  const nomineeQuery = useQuery(
    own ? subjectVotesKey(topic, nominee as string, since) : null,
    (force) => loadSubjectVotes(topic, nominee as string, since, { force }),
    { refreshMs }
  );
  const source = own ? nomineeQuery.data : index.data;
  const tally = useMemo(
    () =>
      source && nominee
        ? communityVotesFor(source.rows, { topic, nominee, since }, new Set(source.admins))
        : NO_VOTES,
    [source, topic, nominee, since]
  );
  const mine =
    options.myAddress && nominee
      ? myCommunityVote(tally, options.myAddress, { yes: pendingYes, no: pendingNo })
      : null;
  return { tally, mine };
}

/**
 * The signed-in account when it may vote on `nominee`'s nomination (or a
 * proposal about them): not that account and not a Minter Admin (their
 * answer is on chain). Null otherwise, and while the Minter Admins aren't
 * read yet.
 */
export function useCommunityVoter(
  nominee: string | null
): (Signer & { name: string | null }) | null {
  const signer = signerOf(useSession());
  const asks = Boolean(signer && nominee && signer.address !== nominee);
  // The shared admins read (useAdmins' key), only for someone who could vote.
  const admins = useQuery(asks ? 'group:admins' : null, (force) => getAdmins({ force }), {
    refreshMs: 5 * 60_000,
  });
  if (!signer || !asks || !admins.data) return null;
  return admins.data.admins.some((a) => a.member === signer.address) ? null : signer;
}
