/** Small words the Connections rows share. */
import { monthRange } from '../../../../rules/explorer/connections';
import { formatCount, formatDate } from '../../../../utils/format';
import type { Funding } from '../../../../data/explorer/account';
import { LINK_PAGE, LINK_PAGES } from '../../../../data/explorer/links';
import type { ConnectionsPart } from './useConnections';
import type { CircleSide } from '../../../../rules/explorer/circle';

/** "12 Mar 2025 · block 1,371,641", or "Mar–May 2025 · blocks 1,364,500–2,100,000". */
export function whenLine(when: {
  height: number;
  timestamp: number;
  firstHeight?: number;
  firstTimestamp?: number;
}): string {
  if (when.firstHeight !== undefined && when.firstHeight !== when.height)
    return `${monthRange(when.firstTimestamp ?? when.timestamp, when.timestamp)} · blocks ${formatCount(
      when.firstHeight
    )}–${formatCount(when.height)}`;
  return `${formatDate(when.timestamp)} · block ${formatCount(when.height)}`;
}

/** "block 1,371,641", or "blocks 1,364,500–2,100,000" (the sentence already has the dates). */
export function blocksLine(first: number, last: number): string {
  return first === last
    ? `block ${formatCount(last)}`
    : `blocks ${formatCount(first)}–${formatCount(last)}`;
}

/** A finding's sentence when it is all text (no account in it). */
export function textOf(parts: ReadonlyArray<{ kind: string; text?: string }>): string {
  return parts.map((part) => (part.kind === 'text' ? (part.text ?? '') : '')).join('');
}

/** "a", "a and b", "a, b and c". */
function andList(items: readonly string[]): string {
  return items.length < 2
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * What the failed reads leave out: "its payments", "its payments sent and
 * its asset transfers and multi-payments" (empty when none failed).
 */
export function unreadWords(failed: readonly ConnectionsPart[]): string {
  const has = (part: ConnectionsPart) => failed.includes(part);
  return andList(
    [
      has('links') ? 'its reward shares, level moves and name sales' : null,
      has('sent') && has('recv')
        ? 'its payments'
        : has('sent')
          ? 'its payments sent'
          : has('recv')
            ? 'its payments received'
            : null,
      has('assets') ? 'its asset transfers and multi-payments' : null,
      has('trades') ? 'its asset trades' : null,
    ].filter((words): words is string => words !== null)
  );
}

/** How many links rows one read takes at most. */
const LINKS_READ = formatCount(LINK_PAGE * LINK_PAGES);

/** Under what was found, when the links read stopped at its ceiling. */
export const LINKS_CAPPED_NOTE = `From its newest ${LINKS_READ} reward shares, level moves and name sales: there may be older ones.`;

/**
 * The nothing-found line for what was looked for only in the newest 500
 * links rows: "In its newest 500 reward shares, level moves and name sales,
 * nothing found: a sponsor, name sales." (null when there is none).
 */
export function cappedNothingLine(line: string | null): string | null {
  return line
    ? line.replace(
        /^Also checked, nothing found: /,
        `In its newest ${LINKS_READ} reward shares, level moves and name sales, nothing found: `
      )
    : null;
}

/**
 * The tag on the row of the account its first incoming transaction came
 * from, worded by what that transaction was: only a payment is its first
 * QORT; a reward share or an asset transfer moved no QORT to it.
 */
export function fundingTag(funding: Pick<Funding, 'kind'>): string | null {
  switch (funding.kind) {
    case 'payment':
    case 'multiPayment':
      return 'its first QORT came from them';
    case 'transferPrivs':
      return 'its minting level came from them';
    case 'rewardShare':
    case 'transferAsset':
      return 'its first incoming transaction came from them';
    default:
      return null;
  }
}

/** "9 rows match “crow”, and 2 more are similar." */
export function connectionsSearchLine(
  typed: string,
  match: number,
  similar: number,
  looking = false
): string {
  const are = (n: number) => (n === 1 ? 'is' : 'are');
  // Names still on their way: not "nothing" yet.
  if (looking && match + similar === 0) return `Looking for “${typed}”…`;
  if (match > 0)
    return `${formatCount(match)} ${match === 1 ? 'row matches' : 'rows match'} “${typed}”${
      similar > 0 ? `, and ${formatCount(similar)} more ${are(similar)} similar` : ''
    }.`;
  if (similar > 0)
    return `Nothing matches “${typed}” exactly; ${formatCount(similar)} ${similar === 1 ? 'row' : 'rows'} ${are(similar)} similar.`;
  return `Nothing in this account’s connections matches “${typed}”.`;
}

/** A side of the Connections circle, as its heading says it. */
export function sideWords(side: CircleSide): string {
  return side === 'in'
    ? 'Received from'
    : side === 'out'
      ? 'Sent to'
      : side === 'both'
        ? 'Sent and received'
        : 'Other links';
}

/** The title of what an avatar of the circle stands for: "Received from Kit Kicked". */
export function circleNodeTitle(side: CircleSide, label: string): string {
  if (side === 'other') return `${label}: other links`;
  if (side === 'both') return `Sent to and received from ${label}`;
  return `${sideWords(side)} ${label}`;
}
