/**
 * Compare's small view helpers that aren't components: the letters'
 * colours, when a finding happened in words, the pair anchors, and what
 * In common has, is still reading and found nothing of.
 */
import { useTheme, type Theme } from '@mui/material/styles';
import type { PairFinding } from '../../../rules/explorer/compare';
import { monthRange } from '../../../rules/explorer/connections';
import { formatDate } from '../../../utils/format';
import { withHue } from '../../decisions/sectionAccents';
import { whenLine } from '../account/connections/words';
import type { CompareData } from './useCompareData';

/** A blue, a violet, a teal and an amber. */
const HUES = [215, 285, 170, 35] as const;

export function letterAccents(theme: Theme): string[] {
  return HUES.map((hue) => withHue(theme.palette.info.main, hue));
}

export function useLetterAccents(): string[] {
  return letterAccents(useTheme());
}

/** "12 Mar 2025 · block 1,371,641", or the dates alone for what has no block. */
export function findingWhen(
  finding: Pick<PairFinding, 'height' | 'firstHeight' | 'timestamp' | 'firstTimestamp'>
): string {
  if (finding.height !== undefined)
    return whenLine({
      height: finding.height,
      timestamp: finding.timestamp,
      firstHeight: finding.firstHeight,
      firstTimestamp: finding.firstTimestamp,
    });
  return finding.firstTimestamp !== undefined && finding.firstTimestamp !== finding.timestamp
    ? monthRange(finding.firstTimestamp, finding.timestamp)
    : formatDate(finding.timestamp);
}

/** A block the pair grid jumps to: clear of the sticky header, focused without a ring. */
export const PAIR_ANCHOR_SX = {
  scrollMarginTop: 'calc(var(--qmp-header-offset, 0px) + 16px)',
  '&:focus': { outline: 'none' },
} as const;

/** The id of a pair's block in "Recorded between them". */
export const pairAnchorId = (id: string) => `compare-pair-${id}`;

export interface InCommonState {
  /** Reads it needs are still out. */
  reading: boolean;
  /** What two or more share, found so far. */
  any: boolean;
  /** Checked and nothing found, in words. */
  empty: string[];
}

/** What In common has, is reading, and found nothing of. */
export function inCommonState(data: CompareData): InCommonState {
  const live = data.live.map((a, i) => (a ? i : -1)).filter((i) => i >= 0);
  const done = (q: { data?: unknown; isError: boolean }) => q.data !== undefined || q.isError;
  const linksIn = live.every((i) => done(data.links[i]));
  const firstIn = live.every((i) => done(data.first[i]));
  const payIn = live.every((i) => done(data.sent[i]) && done(data.recv[i]) && done(data.assets[i]));
  const groupsIn = live.every((i) => done(data.groups[i]));
  const empty: string[] = [];
  if (linksIn && !data.sponsors.length) empty.push('a shared sponsor');
  if (firstIn && !data.firstPayers.length) empty.push('a shared first payer');
  if (payIn && !data.counterparties.rows.length) empty.push('the same accounts in their payments');
  if (groupsIn && !data.groupsShared.length) empty.push('shared groups (MINTER aside)');
  return {
    reading: !(linksIn && firstIn && payIn && groupsIn),
    any: Boolean(
      data.sponsors.length ||
      data.firstPayers.length ||
      data.counterparties.rows.length ||
      data.groupsShared.length ||
      data.timing.length
    ),
    empty,
  };
}
