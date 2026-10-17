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
import { buildTimeline, HISTORY_WINDOW_DAYS, type TimelineEvent } from './timeline';
import { getChainNow } from './chain';
import { getGroupInfo } from './group';
import { fetchQuery } from './query';
import { getDecisionsInRange } from './txs';
import { APPROVAL_GATED_TYPES } from './types';

/**
 * Whether History counts `e` as new for someone who last saw it up to
 * `seenHeight`: a MINTER change by approval, decided (approved, rejected or
 * expired) after that height, and by the tip when one is given. The History
 * tab's count and History's highlight (ChainHistory) both use it.
 */
export function isHistoryNews(
  e: Pick<TimelineEvent, 'outcome' | 'atHeight' | 'tx'>,
  seenHeight: number,
  tipHeight?: number
): boolean {
  return (
    e.outcome !== 'pending' &&
    e.atHeight !== null &&
    e.atHeight > seenHeight &&
    (tipHeight === undefined || e.atHeight <= tipHeight) &&
    (APPROVAL_GATED_TYPES as readonly string[]).includes(e.tx.type)
  );
}

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
        (e) => isHistoryNews(e, seenHeight, now.height)
      ).length;
    },
    { ttlMs: 5 * 60_000, force: options.force }
  );
}
