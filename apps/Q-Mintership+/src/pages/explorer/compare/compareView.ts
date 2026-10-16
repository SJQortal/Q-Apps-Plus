/**
 * Compare's small view helpers that aren't components: the letters'
 * colours, when a finding happened in words, the pair anchors, and what
 * In common has, is still reading, found nothing of and couldn't check.
 */
import { useTheme, type Theme } from '@mui/material/styles';
import { letterOf, type PairFinding } from '../../../rules/explorer/compare';
import { monthRange } from '../../../rules/explorer/connections';
import { formatDate } from '../../../utils/format';
import { withHue } from '../../decisions/sectionAccents';
import { whenLine } from '../account/connections/words';
import type { SideRead } from './sideRows';
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
  /** Checked (every read it needs came in) and nothing found, in words. */
  empty: string[];
  /** Checks a read failed for, in words: neither found nor said to be empty. */
  failed: string[];
  /** The reads that failed, to retry. */
  failedReads: CompareRead[];
}

/** One of Compare's reads, as far as these checks need it. */
export interface CompareRead {
  data?: unknown;
  error: unknown;
  isError: boolean;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

/** What each of Side by side's reads is, in words after the account's letter. */
const SIDE_READ_WORDS: ReadonlyArray<[SideRead, string]> = [
  ['primary', 'primary name'],
  ['names', 'names'],
  ['first', 'first transactions'],
  ['balance', 'balance'],
  ['status', 'MINTER status'],
  ['links', 'reward shares'],
  ['lastSent', 'last sent transaction'],
  ['groups', 'groups'],
  ['qdn', 'QDN publishes'],
];

/** Side by side's reads for the account at `i`. */
function sideReads(data: CompareData, i: number): Record<SideRead, CompareRead> {
  return {
    primary: data.primary[i],
    names: data.names[i],
    first: data.first[i],
    balance: data.balance[i],
    status: data.status[i],
    links: data.links[i],
    online: data.online,
    lastSent: data.lastSent[i],
    groups: data.groups[i],
    qdn: data.qdn[i],
  };
}

/** Which of Side by side's reads failed for the account at `i`. */
export function sideFailed(data: CompareData, i: number): Partial<Record<SideRead, boolean>> {
  const reads = sideReads(data, i);
  const failed: Partial<Record<SideRead, boolean>> = {};
  for (const read of Object.keys(reads) as SideRead[]) if (reads[read].isError) failed[read] = true;
  return failed;
}

/** Side by side's failed reads: "B’s balance", "who is minting now", and the reads to retry. */
export function sideFailures(data: CompareData): { what: string[]; reads: CompareRead[] } {
  const what: string[] = [];
  const reads = new Set<CompareRead>();
  data.live.forEach((address, i) => {
    if (!address) return;
    const mine = sideReads(data, i);
    for (const [read, words] of SIDE_READ_WORDS) {
      if (!mine[read].isError) continue;
      what.push(`${letterOf(i)}’s ${words}`);
      reads.add(mine[read]);
    }
  });
  if (data.live.some(Boolean) && data.online.isError) {
    what.push('who is minting now');
    reads.add(data.online);
  }
  return { what, reads: [...reads] };
}

/** What In common has, is reading, found nothing of, and couldn't check. */
export function inCommonState(data: CompareData): InCommonState {
  const live = data.live.map((a, i) => (a ? i : -1)).filter((i) => i >= 0);
  const checks: Array<{ words: string; found: boolean; reads: (i: number) => CompareRead[] }> = [
    { words: 'a shared sponsor', found: data.sponsors.length > 0, reads: (i) => [data.links[i]] },
    {
      words: 'a shared first payer',
      found: data.firstPayers.length > 0,
      reads: (i) => [data.first[i]],
    },
    {
      words: 'the same accounts in their payments',
      // Shared accounts that were left out (ATs, busy payers) were found, and are said so.
      found: Boolean(
        data.counterparties.rows.length ||
        data.counterparties.atLeftOut ||
        data.counterparties.busyLeftOut
      ),
      reads: (i) => [data.sent[i], data.recv[i], data.assets[i]],
    },
    {
      words: 'shared groups (MINTER aside)',
      found: data.groupsShared.length > 0,
      reads: (i) => [data.groups[i]],
    },
  ];
  const empty: string[] = [];
  const failed: string[] = [];
  const failedReads = new Set<CompareRead>();
  let reading = false;
  for (const check of checks) {
    const reads = live.flatMap(check.reads);
    // A failed read is not a read: its check is neither empty nor complete.
    if (reads.every((q) => q.data !== undefined)) {
      if (!check.found) empty.push(check.words);
    } else if (reads.some((q) => q.isError)) {
      failed.push(check.words);
    }
    for (const q of reads) {
      if (q.isError) failedReads.add(q);
      else if (q.data === undefined) reading = true;
    }
  }
  return {
    reading,
    any: Boolean(
      data.sponsors.length ||
      data.firstPayers.length ||
      data.counterparties.rows.length ||
      data.counterparties.atLeftOut ||
      data.counterparties.busyLeftOut ||
      data.groupsShared.length ||
      data.timing.length
    ),
    empty,
    failed,
    failedReads: [...failedReads],
  };
}
