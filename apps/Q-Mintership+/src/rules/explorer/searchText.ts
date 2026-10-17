/**
 * What a row of the Explorer shows, as text to search (Simon, 2026-10-17:
 * search an account's connections and transactions): the words on screen
 * and in its details, never more, so a search can't find what a row hides
 * (a message's content, an encrypted resource's identifier: describeTx
 * leaves both out). An account counts by its address and by the name known
 * for it; a group by its number and, once read, its name. Pure.
 */
import type { TxRow } from '../../data/types';
import { formatCount, formatDate } from '../../utils/format';
import { familyOf, TX_FAMILIES } from './txFamilies';
import { groupWords, type TxPart, type TxWords } from './txWords';

/** The name known for an account, if any (a primary name already read). */
export type NameOf = (address: string) => string | null | undefined;
/** The name known for a group, if any. */
export type GroupNameOf = (groupId: number) => string | null | undefined;

export interface SearchNames {
  nameOf: NameOf;
  groupNameOf?: GroupNameOf;
}

/** An account as text: its name, when known, and its address. */
export function accountSearchText(address: string, nameOf: NameOf): string {
  const name = nameOf(address);
  return name ? `${name} ${address}` : address;
}

/** One piece of a sentence as text to search. */
export function partSearchText(part: TxPart, names: SearchNames): string {
  switch (part.kind) {
    case 'text':
      return part.text;
    case 'account':
      return accountSearchText(part.address, names.nameOf);
    case 'amount':
      return `${part.amount} ${part.asset}`;
    case 'name':
      return part.name;
    case 'group':
      return [groupWords(part.groupId), names.groupNameOf?.(part.groupId) ?? '']
        .filter(Boolean)
        .join(' ');
    case 'tx':
      return part.signature;
  }
}

/** A sentence as text to search. */
export function partsSearchText(parts: readonly TxPart[], names: SearchNames): string {
  return parts.map((part) => partSearchText(part, names)).join('');
}

/**
 * A transaction as its row and its details show it (`words`: its
 * describeTx, told from the list's account): the type and its family, the
 * sentence, the fields' values, the accounts involved, when, the block and
 * the signature.
 */
export function txSearchText(tx: TxRow, words: TxWords, names: SearchNames): string {
  const family = TX_FAMILIES.find((candidate) => candidate.key === familyOf(tx.type))?.label;
  return [
    words.title,
    family ?? '',
    partsSearchText(words.parts, names),
    ...words.fields.map((field) =>
      typeof field.value === 'string' ? field.value : partSearchText(field.value, names)
    ),
    ...words.participants.map((address) => accountSearchText(address, names.nameOf)),
    typeof tx.blockHeight === 'number'
      ? `block ${formatCount(tx.blockHeight)}`
      : 'waiting to be confirmed',
    formatDate(tx.timestamp),
    tx.signature,
  ]
    .filter(Boolean)
    .join('\n');
}
