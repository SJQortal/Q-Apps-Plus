/**
 * The Transactions tab's words: what each family's (or type's)
 * transactions are called, what narrows the list (a name, a time, blocks),
 * how much of the account's list is on screen (always with what it is out
 * of, when that is known), and what "Load older" brought.
 */
import { ACCOUNT_TX_PAGE } from '../../../../data/explorer/accountTx';
import { dayStart, WHENS, type TxFilters } from '../../../../rules/explorer/accountTxFilters';
import { visibleName } from '../../../../rules/explorer/nameNotes';
import { txTypeLabel, type TxFamilyKey } from '../../../../rules/explorer/txFamilies';
import { formatCount, formatDate } from '../../../../utils/format';

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

/** What the list holds, as a noun: the exact type picked, or its family. */
export function listNoun(filters: TxFilters): Noun {
  // With a name, All reads only the types that carry one.
  if (filters.name && filters.kind === 'all' && !filters.type)
    return { one: 'name or QDN transaction', many: 'name and QDN transactions' };
  if (filters.type) {
    const label = txTypeLabel(filters.type);
    return { one: `“${label}” transaction`, many: `“${label}” transactions` };
  }
  return FAMILY_NOUN[filters.kind];
}

/** When, as the end of a sentence: " in the last 7 days", " between 1 Sept 2026 and …". */
function timePhrase(filters: TxFilters): string {
  const { when, from, to } = filters;
  const span = WHENS.find((w) => w.value === when)?.label.toLowerCase();
  if (when === '24h' || when === '7d' || when === '30d' || when === '1y') return ` in the ${span}`;
  if (when === 'dates') {
    const day = (value: string) => formatDate(dayStart(value));
    if (from && to)
      return from === to ? ` on ${day(from)}` : ` between ${day(from)} and ${day(to)}`;
    if (from) return ` since ${day(from)}`;
    if (to) return ` up to ${day(to)}`;
  }
  if (when === 'blocks') {
    const block = (value: string) => formatCount(Number(value));
    if (from && to)
      return from === to ? ` in block ${block(from)}` : ` in blocks ${block(from)}–${block(to)}`;
    if (from) return ` from block ${block(from)} on`;
    if (to) return ` up to block ${block(to)}`;
  }
  return '';
}

/** What narrows the list, as the end of a sentence: " about “Q-Maps” in the last 7 days". */
export function scopePhrase(filters: TxFilters): string {
  const name = filters.name ? ` about “${visibleName(filters.name)}”` : '';
  return `${name}${timePhrase(filters)}`;
}

/** "No name transactions in this account's history.", or with what narrows it. */
export function emptyLine(filters: TxFilters): string {
  const noun = listNoun(filters);
  const scope = scopePhrase(filters);
  return scope
    ? `This account has no ${noun.many}${scope}.`
    : `No ${noun.many} in this account's history.`;
}

/** Why nothing can match: a name picked with a kind that never carries one. */
export function noNameLine(filters: TxFilters): string {
  return `${listNoun(filters).many.replace(/^./, (c) => c.toUpperCase())} are never about a name. Pick All, Names or QDN data to see transactions about “${visibleName(filters.name ?? '')}”.`;
}

/**
 * How much of the list is on screen, always with what it is out of when
 * known: "The newest 150 of this account's transactions.", "All 37 of …",
 * "The oldest 50 of …". With a name picked (matched on the rows read):
 * "12 about “Q-Maps” among its newest 300 name transactions read; Load
 * older looks further back." Sorted by amount: "Biggest amounts first,
 * among the 100 read so far."
 */
export function coverageLine(
  filters: TxFilters,
  shown: number,
  held: number,
  read: number,
  done: boolean
): string {
  const noun = listNoun(filters);
  const scope = scopePhrase(filters);
  const end = filters.order === 'oldest' ? 'oldest' : 'newest';
  const lead =
    filters.order === 'amount'
      ? done
        ? 'Biggest amounts first. '
        : `Biggest amounts first, among the ${formatCount(read)} read so far. `
      : '';
  if (filters.name && !done) {
    const time = timePhrase(filters);
    const found = held ? formatCount(held) : 'None yet';
    return `${lead}${found} about “${visibleName(filters.name)}” in its ${end} ${formatCount(read)} ${read === 1 ? noun.one : noun.many}${time}. ${loadMoreLabel(filters)} looks further.`;
  }
  if (done && shown >= held)
    return (
      lead +
      (held === 1
        ? `This account's only ${noun.one}${scope}.`
        : `All ${formatCount(held)} of this account's ${noun.many}${scope}.`)
    );
  return (
    lead +
    (done
      ? `The ${end} ${formatCount(shown)} of this account's ${formatCount(held)} ${noun.many}${scope}.`
      : `The ${end} ${formatCount(shown)} of this account's ${noun.many}${scope}.`)
  );
}

/** The button that reads on: older ones, or newer ones when the oldest come first. */
export function loadMoreLabel(filters: TxFilters): string {
  return filters.order === 'oldest' ? 'Load newer' : 'Load older';
}

/** Said while a name's matches are few and more is read by itself. */
export function readingOnLine(name: string): string {
  return `Reading on for more about “${visibleName(name)}”…`;
}

/** "50 older transactions loaded" (said once in a polite live region). */
export function olderLoadedLine(filters: TxFilters, count: number, done: boolean): string {
  const noun = listNoun(filters);
  const more = filters.order === 'oldest' ? 'newer' : 'older';
  if (count > 0)
    return `${formatCount(count)} ${more} ${count === 1 ? noun.one : noun.many} loaded`;
  if (!done && filters.name)
    return `None about “${visibleName(filters.name)}” in the next ${formatCount(ACCOUNT_TX_PAGE)} read`;
  return `No ${more} ${noun.many}`;
}

/** Shown while a busy account's search runs longer than a few seconds. */
export const STILL_CHECKING = 'Still checking (busy account)…';

/**
 * With a search: how many of the rows searched match, how many are only
 * similar, and how far it searched ("12 of the 300 transactions read match
 * “crow”, and 3 more are similar. Load older searches older ones too.").
 */
export function searchLine(
  filters: TxFilters,
  typed: string,
  counts: { match: number; similar: number; searched: number; done: boolean; looking?: boolean }
): string {
  const noun = listNoun(filters);
  const scope = scopePhrase(filters);
  const { match, similar, searched, done } = counts;
  // Names still on their way: not "none" yet.
  if (counts.looking && match + similar === 0) return `Looking for “${typed}”…`;
  const what = done
    ? searched === 1
      ? `this account's only ${noun.one}${scope}`
      : `this account's ${formatCount(searched)} ${noun.many}${scope}`
    : `the ${formatCount(searched)} ${searched === 1 ? noun.one : noun.many}${scope} read`;
  const are = (n: number) => (n === 1 ? 'is' : 'are');
  let line: string;
  if (match > 0) {
    line = `${formatCount(match)} of ${what} ${match === 1 ? 'matches' : 'match'} “${typed}”`;
    if (similar > 0) line += `, and ${formatCount(similar)} more ${are(similar)} similar`;
  } else if (similar > 0)
    line = `None of ${what} matches “${typed}”; ${formatCount(similar)} ${are(similar)} similar`;
  else line = `None of ${what} matches “${typed}”`;
  return done
    ? `${line}.`
    : `${line}. ${loadMoreLabel(filters)} searches ${filters.order === 'oldest' ? 'newer' : 'older'} ones too.`;
}
