/**
 * The Names tab's words: the list's title and limits, the primary-name
 * rule, a name's own record, and how much of the name history was read. Counts always come with what they are out
 * of; partial reads say how far they got.
 */
import type { NameData, NamesOf } from '../../../../data/explorer/account';
import { NAME_HISTORY_LIMIT } from '../../../../data/explorer/nameHistory';
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

/**
 * Over the names, when the read stopped short: how much of their history
 * was read, and how many names show none for that reason ("Each name's
 * history comes from its newest 100 name transactions: 19 of the names
 * below have none in them. Older ones aren't read yet.").
 */
export function historyCoverage(
  count: number,
  capped: boolean,
  limit = NAME_HISTORY_LIMIT,
  without = 0
): string {
  if (capped) {
    const missing =
      without > 0
        ? ` ${without === 1 ? '1 of the names below has' : `${formatCount(without)} of the names below have`} none in them.`
        : '';
    return `Each name's history comes from its newest ${formatCount(limit)} name transactions.${missing} Older ones aren't read yet.`;
  }
  return count === 1 ? '1 name transaction.' : `${formatCount(count)} name transactions.`;
}

export const NO_NAME_HISTORY =
  'No name transactions found: it registered, bought, sold or changed no names.';
