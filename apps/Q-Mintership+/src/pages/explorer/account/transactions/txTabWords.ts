/**
 * The Transactions tab's words: what each family's transactions are called,
 * how much of the account's list is on screen (always with what it is out
 * of, when that is known), and what "Load older" brought.
 */
import type { TxFamilyKey } from '../../../../rules/explorer/txFamilies';
import { formatCount } from '../../../../utils/format';

interface Noun {
  one: string;
  many: string;
}

/** Each family's transactions, as a noun ("name transactions"). */
export const FAMILY_NOUN: Readonly<Record<TxFamilyKey, Noun>> = {
  all: { one: 'transaction', many: 'transactions' },
  payments: { one: 'payment', many: 'payments' },
  names: { one: 'name transaction', many: 'name transactions' },
  minting: { one: 'minting transaction', many: 'minting transactions' },
  groups: { one: 'group transaction', many: 'group transactions' },
  qdn: { one: 'QDN publish', many: 'QDN publishes' },
  trading: { one: 'trading transaction', many: 'trading transactions' },
  messages: { one: 'message', many: 'messages' },
  other: { one: 'other transaction', many: 'other transactions' },
};

/** The list's title for a family: "All transactions", "Payments", "Names", … */
export function familyTitle(family: TxFamilyKey, label: string): string {
  return family === 'all' ? 'All transactions' : label;
}

/** "No name transactions in this account's history." */
export function emptyLine(family: TxFamilyKey): string {
  return `No ${FAMILY_NOUN[family].many} in this account's history.`;
}

/**
 * How much of the list is on screen: "The newest 150 of this account's
 * transactions." while Core may have more, "The newest 50 of this
 * account's 87 payments." once every row is read, "All 37 of …" when all
 * are on screen.
 */
export function coverageLine(
  family: TxFamilyKey,
  shown: number,
  held: number,
  done: boolean
): string {
  const noun = FAMILY_NOUN[family];
  if (done && shown >= held)
    return held === 1
      ? `This account's only ${noun.one}.`
      : `All ${formatCount(held)} of this account's ${noun.many}.`;
  return done
    ? `The newest ${formatCount(shown)} of this account's ${formatCount(held)} ${noun.many}.`
    : `The newest ${formatCount(shown)} of this account's ${noun.many}.`;
}

/** "50 older transactions loaded" (said once in a polite live region). */
export function olderLoadedLine(family: TxFamilyKey, count: number): string {
  const noun = FAMILY_NOUN[family];
  return count <= 0
    ? `No older ${noun.many}`
    : `${formatCount(count)} older ${count === 1 ? noun.one : noun.many} loaded`;
}

/** Shown while a busy account's search runs longer than a few seconds. */
export const STILL_CHECKING = 'Still checking (busy account)…';
