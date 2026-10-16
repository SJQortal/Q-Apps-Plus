/** Small words the Connections rows share. */
import { monthRange } from '../../../../rules/explorer/connections';
import { formatCount, formatDate } from '../../../../utils/format';

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
