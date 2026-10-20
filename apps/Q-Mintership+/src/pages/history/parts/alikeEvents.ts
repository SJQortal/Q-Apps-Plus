/**
 * MINTER events in runs (Simon, 2026-10-17: repeating rows merged and
 * expandable): consecutive events of one kind that ended the same way on
 * the same day ("Made a Minter Admin" five times on 22 Jan 2025) are one
 * run. Pure; TimelineList shows a run of two or more as one line that
 * opens to each.
 */
import type { TimelineEvent } from '../../../data/timeline';
import { formatDate } from '../../../utils/format';

const alikeKey = (event: TimelineEvent) =>
  [event.kind, event.title, event.outcome, formatDate(event.at)].join('|');

export function alikeEvents(events: readonly TimelineEvent[]): TimelineEvent[][] {
  const runs: TimelineEvent[][] = [];
  let last: string | null = null;
  for (const event of events) {
    const key = alikeKey(event);
    if (key === last) runs[runs.length - 1].push(event);
    else runs.push([event]);
    last = key;
  }
  return runs;
}

/** The first `count` lines of `events` (a run of alike ones is one line), as events. */
export function firstAlikeLines(events: readonly TimelineEvent[], count: number): TimelineEvent[] {
  return alikeEvents(events).slice(0, count).flat();
}
