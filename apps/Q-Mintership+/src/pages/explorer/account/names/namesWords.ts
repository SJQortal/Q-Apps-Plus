/**
 * The Names tab's words: the list's title and limits, the primary-name
 * rule, a name's own record, how much of the name history was read, and
 * what the QDN search covered. Counts always come with what they are out
 * of; partial reads say how far they got.
 */
import type { NameData, NamesOf } from '../../../../data/explorer/account';
import { NAME_HISTORY_LIMIT } from '../../../../data/explorer/nameHistory';
import { QDN_NAME_LIMIT, type QdnServiceCount } from '../../../../data/explorer/qdnBy';
import { formatAmount } from '../../../../rules/explorer/txWords';
import { formatCount, formatDate } from '../../../../utils/format';

/**
 * Core's rule (Core 6.x, naming/Name.java): registering or buying a name
 * makes it the primary one only when the account has none, and no
 * transaction picks or switches it.
 */
export const NO_PRIMARY =
  "No primary name. Core gives an account a primary name when it registers or buys a name while it has none; an account can't choose it.";

export const NO_NAMES = 'No registered name.';

/** "Names (88)", "Names (500+)", "Names" while loading. */
export function namesTitle(names: NamesOf | undefined): string {
  if (!names) return 'Names';
  return `Names (${formatCount(names.names.length)}${names.truncated ? '+' : ''})`;
}

/** "500+ names; the first 500 are listed." */
export function truncatedLine(listed: number): string {
  return `${formatCount(listed)}+ names; the first ${formatCount(listed)} are listed.`;
}

/** "Show 20 more", or fewer when fewer are left. */
export function showMoreWords(left: number, page: number): string {
  return `Show ${formatCount(Math.min(left, page))} more`;
}

/** A name's own record in short parts: "Registered 12 Oct 2024", "Updated …", "For sale at 5 QORT". */
export function nameDataParts(data: NameData): string[] {
  return [
    data.registered ? `Registered ${formatDate(data.registered)}` : null,
    data.updated ? `Updated ${formatDate(data.updated)}` : null,
    data.isForSale
      ? data.salePrice
        ? `For sale at ${formatAmount(data.salePrice)} QORT`
        : 'For sale'
      : null,
  ].filter((part): part is string => part !== null);
}

/** Under the name history: how much of it this is. */
export function historyCoverage(count: number, capped: boolean): string {
  if (capped) return `The newest ${formatCount(NAME_HISTORY_LIMIT)} name transactions.`;
  return count === 1 ? '1 name transaction.' : `${formatCount(count)} name transactions.`;
}

export const NO_NAME_HISTORY =
  'No name transactions found: it registered, bought, sold or changed no names.';

/** "Searched 10 of 88 names", "Searched all 3 names", "Searched its only name". */
export function searchedLine(searched: number, total: number, truncated: boolean): string {
  if (searched >= total && !truncated)
    return total === 1 ? 'Searched its only name.' : `Searched all ${formatCount(total)} names.`;
  return `Searched ${formatCount(searched)} of ${formatCount(total)}${truncated ? '+' : ''} names.`;
}

/** Which names are searched without asking. */
export function autoNamesWords(hasPrimary: boolean, newest: number): string {
  const recent = `the ${formatCount(newest)} registered most recently`;
  return hasPrimary ? `First the primary name and ${recent}.` : `First ${recent}.`;
}

/** "Search 78 more names", "Search 1 more name". */
export function searchMoreWords(left: number): string {
  return `Search ${formatCount(left)} more ${left === 1 ? 'name' : 'names'}`;
}

/** "APP 2", "MAIL_PRIVATE 53+" (more when a name hit the cap). */
export function serviceCountWords(count: QdnServiceCount): string {
  return `${count.service} ${formatCount(count.count)}${count.partial ? '+' : ''}`;
}

/** A name past the cap: only its newest resources were counted. */
export function cappedWords(names: readonly string[]): string | null {
  if (!names.length) return null;
  if (names.length === 1)
    return `has more than ${QDN_NAME_LIMIT} resources: its newest ${QDN_NAME_LIMIT} are counted.`;
  return `${formatCount(names.length)} names have more than ${QDN_NAME_LIMIT} resources each: their newest ${QDN_NAME_LIMIT} are counted.`;
}

/** Encrypted resources are counted, never listed. */
export function encryptedWords(count: number): string {
  return count === 1
    ? '1 encrypted resource is counted above and not listed.'
    : `${formatCount(count)} encrypted resources are counted above and not listed.`;
}

/** "74 resources", "100+ resources". */
export function resourcesWords(total: number, partial: boolean): string {
  return `${formatCount(total)}${partial ? '+' : ''} ${total === 1 && !partial ? 'resource' : 'resources'}`;
}
