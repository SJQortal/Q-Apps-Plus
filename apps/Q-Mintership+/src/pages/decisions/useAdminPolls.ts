/**
 * The Minter Admin polls a view shows: the shared read (data/adminPolls.ts,
 * refreshed every minute while visible), assembled by the pure rules for
 * this viewer, with this device's writes still on their way. Writes that
 * QDN now shows are settled here. Decisions reads the listed polls, History
 * the closed ones, and a poll's page that one poll (PollScope).
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  adminPollsKey,
  loadAdminPolls,
  pollContext,
  pollScopeKey,
  retryPollDecrypts,
  type AdminPollsData,
  type PollScope,
} from '../../data/adminPolls';
import { getQueryState, subscribeQuery, type QueryState } from '../../data/query';
import { LIVE_REFRESH_MS } from '../../hooks/useData';
import { useNow } from '../../hooks/useNow';
import { useQuery } from '../../hooks/useQuery';
import {
  assemblePoll,
  assemblePolls,
  pollsWaitingForVote,
  sortPolls,
  type AdminPollView,
  type PollContext,
} from '../../rules/adminPolls';
import {
  setPendingPoll,
  setPendingShare,
  setPendingVote,
  usePendingPollWrites,
} from '../../state/adminPolls';
import { shareSettled, voteSettled, withPublishing, type ShownPoll } from './adminPollUi';

const LISTED: PollScope = { kind: 'listed' };

/** The scope's polls, in order: History's only once closed, the latest end first. */
function assembleScope(data: AdminPollsData, ctx: PollContext, scope: PollScope) {
  if (scope.kind === 'listed') return assemblePolls(data.sources, ctx);
  const views = data.sources
    .map((src) => assemblePoll(src, ctx))
    .filter((v): v is AdminPollView => v !== null && (scope.kind === 'poll' || !v.open));
  return sortPolls(views);
}

function useAssembled(data: AdminPollsData | undefined, scope: PollScope = LISTED) {
  const pending = usePendingPollWrites();
  // Open and closed move with the clock: re-read it every minute.
  const now = useNow(60_000);
  const views = useMemo(
    () =>
      data
        ? scope.kind === 'listed'
          ? // A poll on its way from this device shows on Decisions at once.
            withPublishing(
              assembleScope(data, pollContext(data, now), scope),
              pending.polls,
              data.signers,
              now
            )
          : (assembleScope(data, pollContext(data, now), scope) as ShownPoll[])
        : null,
    [data, pending.polls, now, scope]
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

/**
 * The polls of `scope` (Decisions' listed ones unless said), read for `viewer`
 * (a Minter Admin) while `enabled`. `undecrypted`: polls Hub didn't decrypt
 * this time; `retry` asks Hub for them again now.
 */
export function useAdminPolls(viewer: string | null, enabled = true, scope: PollScope = LISTED) {
  const query = useQuery(
    viewer && enabled ? pollScopeKey(viewer, scope) : null,
    (force) => loadAdminPolls(viewer as string, { force, scope }),
    { refreshMs: LIVE_REFRESH_MS }
  );
  const { refetch } = query;
  const retry = useCallback(() => {
    retryPollDecrypts();
    void refetch();
  }, [refetch]);
  return {
    query,
    retry,
    undecrypted: query.data?.undecrypted ?? 0,
    ...useAssembled(query.data, scope),
  };
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
