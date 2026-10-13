/**
 * The Minter Admin polls a view shows: the shared read (data/adminPolls.ts,
 * refreshed every minute while visible), assembled by the pure rules for
 * this viewer, with this device's writes still on their way. Writes that
 * QDN now shows are settled here.
 */
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  adminPollsKey,
  loadAdminPolls,
  pollContext,
  type AdminPollsData,
} from '../../data/adminPolls';
import { getQueryState, subscribeQuery, type QueryState } from '../../data/query';
import { LIVE_REFRESH_MS } from '../../hooks/useData';
import { useNow } from '../../hooks/useNow';
import { useQuery } from '../../hooks/useQuery';
import { assemblePolls, pollsWaitingForVote } from '../../rules/adminPolls';
import {
  setPendingPoll,
  setPendingShare,
  setPendingVote,
  usePendingPollWrites,
} from '../../state/adminPolls';
import { shareSettled, voteSettled, withPublishing, type ShownPoll } from './adminPollUi';

function useAssembled(data: AdminPollsData | undefined) {
  const pending = usePendingPollWrites();
  // Open and closed move with the clock: re-read it every minute.
  const now = useNow(60_000);
  const views = useMemo(
    () =>
      data
        ? withPublishing(
            assemblePolls(data.sources, pollContext(data, now)),
            pending.polls,
            data.signers,
            now
          )
        : null,
    [data, pending.polls, now]
  );

  // What QDN shows now needs no "(confirming…)" any more.
  useEffect(() => {
    if (!views || !data) return;
    for (const view of views) {
      const vote = pending.votes[view.id];
      if (vote && vote.status !== 'sending' && voteSettled(view, vote))
        setPendingVote(view.id, null);
      if (pending.polls[view.id] && !view.publishing) setPendingPoll(view.id, null);
      const share = pending.shares[view.id];
      if (share && shareSettled(view, data.viewer, share)) setPendingShare(view.id, null);
    }
  }, [views, data, pending]);

  return { views, pending, signers: data?.signers ?? [] };
}

/** The polls, read for `viewer` (a Minter Admin) while `enabled`. */
export function useAdminPolls(viewer: string | null, enabled = true) {
  const query = useQuery(
    viewer && enabled ? adminPollsKey(viewer) : null,
    (force) => loadAdminPolls(viewer as string, { force }),
    { refreshMs: LIVE_REFRESH_MS }
  );
  return { query, ...useAssembled(query.data) };
}

const IDLE = '__idle__';

/**
 * The polls as already read this session, without reading anything: Home
 * shows how many wait for the viewer's vote only once Decisions read them.
 */
export function useReadAdminPolls(viewer: string | null): ShownPoll[] | null {
  const key = viewer ? adminPollsKey(viewer) : IDLE;
  const state = useSyncExternalStore(
    (listener) => subscribeQuery(key, listener),
    () => getQueryState<AdminPollsData>(key),
    () => getQueryState<AdminPollsData>(key)
  ) as QueryState<AdminPollsData>;
  return useAssembled(viewer ? state.data : undefined).views;
}

/** Open polls the viewer hasn't voted on (a vote on its way from here counts as voted). */
export function waitingForMyVote(
  views: readonly ShownPoll[] | null,
  votes: Record<string, unknown>
): ShownPoll[] {
  if (!views) return [];
  return pollsWaitingForVote(views, new Set(Object.keys(votes))) as ShownPoll[];
}
