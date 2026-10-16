/**
 * Transactions on Qortal's narrowing (Simon, 2026-10-16): of the rows read,
 * only those that mention some text, and, for reward shares, only one kind.
 * Pure; the list pages through Core as before and shows what matches.
 *
 * - Text: anywhere in the transaction, ignoring case (an address, a name,
 *   an amount, a signature, a reason), or a number equal to one of its
 *   numbers (a group's number, with or without "#"). When the text is a
 *   registered name, rows that involve its owner's address match too.
 * - Reward shares: a self share (an account minting on its own), a share
 *   to another account, or a removal (Core's negative share percent).
 */
import type { TxRow } from '../../data/types';

export type ShareKind = 'any' | 'self' | 'other' | 'removal';

export const SHARE_KINDS: ReadonlyArray<{ value: ShareKind; label: string }> = [
  { value: 'any', label: 'Every reward share' },
  { value: 'self', label: 'Self shares (minting on its own)' },
  { value: 'other', label: 'Shares to another account' },
  { value: 'removal', label: 'Removed shares' },
];

export function isShareKind(value: unknown): value is ShareKind {
  return SHARE_KINDS.some((kind) => kind.value === value);
}

export interface RowFilter {
  /** What was typed, trimmed. */
  text: string;
  /** The owner of the name typed, when it is one. */
  owner?: string | null;
  share: ShareKind;
}

export const NO_ROW_FILTER: RowFilter = { text: '', share: 'any' };

export function filterOn(filter: RowFilter): boolean {
  return filter.text.trim() !== '' || filter.share !== 'any';
}

/** The kind of a reward share; null for any other transaction. */
export function shareKindOf(tx: TxRow): Exclude<ShareKind, 'any'> | null {
  if (tx.type !== 'REWARD_SHARE') return null;
  if (Number(tx.sharePercent) < 0) return 'removal';
  return tx.creatorAddress && tx.creatorAddress === tx.recipient ? 'self' : 'other';
}

/** Its strings and numbers, one level into lists and objects (a multi-payment's payments). */
function valuesOf(tx: TxRow): Array<string | number> {
  const out: Array<string | number> = [];
  const take = (value: unknown, depth: number) => {
    if (typeof value === 'string' || typeof value === 'number') out.push(value);
    else if (depth < 2 && Array.isArray(value)) for (const item of value) take(item, depth + 1);
    else if (depth < 2 && value && typeof value === 'object')
      for (const item of Object.values(value)) take(item, depth + 1);
  };
  for (const value of Object.values(tx)) take(value, 0);
  return out;
}

export function rowMatches(tx: TxRow, filter: RowFilter): boolean {
  if (filter.share !== 'any' && shareKindOf(tx) !== filter.share) return false;
  const text = filter.text.trim().toLowerCase();
  if (!text) return true;
  const number = text.replace(/^#/, '');
  const owner = filter.owner ?? null;
  return valuesOf(tx).some((value) =>
    typeof value === 'number'
      ? String(value) === number
      : value === owner || value.toLowerCase().includes(text)
  );
}
