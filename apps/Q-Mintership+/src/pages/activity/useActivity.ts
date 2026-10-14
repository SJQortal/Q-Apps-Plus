/**
 * The Activity screen's reads: one window of Minter Admin Activity (cached
 * 5 minutes per window, refreshed politely while visible) and, only once
 * someone opens it, the members' level spread.
 */
import { useSyncExternalStore } from 'react';
import {
  activityKey,
  getLevelProgress,
  levelSpreadKey,
  loadActivity,
  loadLevelSpread,
  subscribeLevelProgress,
  type ActivityChoice,
} from '../../data/activity';
import { useQuery } from '../../hooks/useQuery';

export const ACTIVITY_REFRESH_MS = 5 * 60_000;

export function useActivity(choice: ActivityChoice) {
  return useQuery(activityKey(choice), (force) => loadActivity(choice, { force }), {
    refreshMs: ACTIVITY_REFRESH_MS,
  });
}

/** Members' levels; `members` null until the reader asks for them. */
export function useLevelSpread(members: string[] | null) {
  return useQuery(members?.length ? levelSpreadKey(members.length) : null, () =>
    loadLevelSpread(members as string[])
  );
}

export function useLevelProgress() {
  return useSyncExternalStore(subscribeLevelProgress, getLevelProgress, getLevelProgress);
}
