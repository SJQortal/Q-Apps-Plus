/**
 * The History tab's count for a Minter Admin: MINTER's changes decided since
 * they last had History open on this device (data/historyNews.ts). The first
 * time, counting starts from now, so the tab doesn't open on weeks of old
 * news. One search every 5 minutes, paused while the app is hidden; none for
 * anyone else.
 */
import { useEffect } from 'react';
import { loadHistoryNews } from '../data/historyNews';
import { markHistorySeen, useHistorySeen } from '../data/historySeen';
import { useDecisions } from './useData';
import { useQuery } from './useQuery';

export const HISTORY_NEWS_REFRESH_MS = 5 * 60_000;

export function useHistoryNews(isAdmin: boolean, address: string | null): number {
  const who = isAdmin && address ? address : null;
  const seen = useHistorySeen(who);
  // The queue an admin's shell already reads carries the tip.
  const decisions = useDecisions(Boolean(who));
  const tip = decisions.data?.now.height ?? null;
  useEffect(() => {
    if (who && seen === null && tip) markHistorySeen(who, tip);
  }, [who, seen, tip]);
  const news = useQuery(
    who && seen !== null ? `historynews:${seen}` : null,
    (force) => loadHistoryNews(seen as number, { force }),
    { refreshMs: HISTORY_NEWS_REFRESH_MS }
  );
  return who && seen !== null ? (news.data ?? 0) : 0;
}
