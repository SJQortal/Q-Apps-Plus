/** Small words the Connections rows share. */
import { monthRange } from '../../../../rules/explorer/connections';
import { formatCount, formatDate } from '../../../../utils/format';
import type { ConnectionsPart } from './useConnections';

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
    ].filter((words): words is string => words !== null)
  );
}
