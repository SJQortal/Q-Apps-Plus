/**
 * Open File's words for where a QDN resource stands on the node (Core's
 * status) and for a transaction that published an earlier version. Pure.
 */
import { formatCount, formatDateTime } from '../../utils/format';
import { sizeWords } from './txWords';

export interface StatusFacts {
  status: string;
  percent: number | null;
  chunks: { local: number; total: number } | null;
}

/** While the node gets it: what it is doing, with its parts when Core says. */
export function fetchingLine(status: StatusFacts): string {
  const parts = status.chunks
    ? ` ${formatCount(status.chunks.local)} of ${formatCount(status.chunks.total)} parts${
        status.percent !== null ? ` (${Math.floor(status.percent)}%)` : ''
      }.`
    : status.percent !== null
      ? ` ${Math.floor(status.percent)}%.`
      : '';
  switch (status.status) {
    case 'DOWNLOADED':
    case 'BUILDING':
      return 'Your node has every part and is putting the file together.';
    case 'MISSING_DATA':
      return `Some parts aren’t on any peer your node has reached yet, so it keeps asking.${parts}`;
    case 'DOWNLOADING':
      return `Your node is downloading it from its peers.${parts}`;
    default:
      return `Your node is asking its peers for it.${parts}`;
  }
}

/** Under the line when nothing new has come for a while. */
export const STALLED_LINE =
  'No new part has come for a while. Your node keeps asking; a file whose peers are offline can take long.';

/** Why it can't be opened, for Core's final statuses. */
export function finalWords(status: string): { title: string; description: string } {
  switch (status) {
    case 'BLOCKED':
      return {
        title: 'Your node blocks this resource.',
        description:
          'Its name or its publisher is on your node’s block list, so your node doesn’t fetch or show it.',
      };
    case 'UNSUPPORTED':
      return {
        title: 'Your node can’t read this kind of resource.',
        description: 'A newer version of Qortal Core may read it.',
      };
    case 'BUILD_FAILED':
      return {
        title: 'Your node couldn’t put this file together.',
        description: 'Its parts arrived but didn’t make a whole file. Try again later.',
      };
    default:
      return {
        title: 'Your node doesn’t list this resource.',
        description:
          'Its transaction is on chain, but your node says it isn’t published: it may not have caught up yet.',
      };
  }
}

/** Before a big file is fetched: what it costs, so the user decides. */
export function bigFileLine(size: number): string {
  return `This file is ${sizeWords(size)}, and your node isn’t holding it yet. Your node downloads all of it before it opens, which takes time and room on its disk.`;
}

/**
 * When this transaction isn't the resource's latest version: Core serves
 * the latest, so that is what shows.
 */
export function earlierVersionLine(latest: {
  created: number | null;
  updated: number | null;
}): string {
  const when = latest.updated ?? latest.created;
  return when
    ? `This transaction published an earlier version. Your node shows the latest one, from ${formatDateTime(when)}.`
    : 'This transaction published an earlier version. Your node shows the latest one.';
}

/** Under a file shown in part: "Showing the first 512 KB of 3.2 MB. Save File keeps all of it." */
export function partLine(shown: number, size: number | null): string {
  return size !== null
    ? `Showing the first ${sizeWords(shown)} of ${sizeWords(size)}. Save File keeps all of it.`
    : `Showing the first ${sizeWords(shown)}. Save File keeps all of it.`;
}
