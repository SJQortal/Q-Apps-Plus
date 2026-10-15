/**
 * What is new in History for a Minter Admin, for the History tab's count:
 * MINTER's changes decided (approved, rejected or expired) after the height
 * they last saw History up to (data/historySeen.ts), counted as History
 * counts its events (buildTimeline). One search of MINTER's decisions,
 * paged at 100, over the blocks such a change can have been proposed in: a
 * signing window before that height, and never more than History's first
 * 30 days, plus one window, back. Joins, join requests and leaves don't
 * count here: finding them means searching every group's joins.
 */
import { buildTimeline, HISTORY_WINDOW_DAYS } from './timeline';
import { getChainNow } from './chain';
import { getGroupInfo } from './group';
import { fetchQuery } from './query';
import { getDecisionsInRange } from './txs';
import { APPROVAL_GATED_TYPES } from './types';

/** Changes decided after `seenHeight`, up to the tip. Key `historynews:<seenHeight>`. */
export function loadHistoryNews(
  seenHeight: number,
  options: { force?: boolean } = {}
): Promise<number> {
  return fetchQuery(
    `historynews:${seenHeight}`,
    async () => {
      const [now, group] = await Promise.all([getChainNow(), getGroupInfo()]);
      if (now.height <= seenHeight) return 0;
      const maximumBlockDelay = group.maximumBlockDelay;
      const window = maximumBlockDelay + 1;
      const historyBlocks = Math.ceil((HISTORY_WINDOW_DAYS * 86_400_000) / now.msPerBlock);
      const start = Math.max(1, seenHeight - window, now.height - historyBlocks - window);
      const rows = await getDecisionsInRange(APPROVAL_GATED_TYPES, start, now.height, {
        force: options.force,
        slot: 'historynews',
      });
      return buildTimeline(rows.rows, { msPerBlock: now.msPerBlock, maximumBlockDelay }).filter(
        (e) =>
          e.outcome !== 'pending' &&
          e.atHeight !== null &&
          e.atHeight > seenHeight &&
          e.atHeight <= now.height
      ).length;
    },
    { ttlMs: 5 * 60_000, force: options.force }
  );
}
