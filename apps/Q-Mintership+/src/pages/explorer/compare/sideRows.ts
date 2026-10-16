/**
 * Compare → Side by side: one row per fact, one cell per account, in the
 * Overview's words (names, first seen, first QORT from, level, blocks
 * minted, minting penalty, balance, MINTER status, sponsor, sponsored,
 * minting now, last sent a transaction, groups, QDN publishes). A cell is
 * undefined while its read is out. A row whose cells are all the same reads
 * "Same for all: …".
 */
import type { FirstSeen, GroupOf, NamesOf } from '../../../data/explorer/account';
import type { LastSent } from '../../../data/explorer/lastSent';
import type { QdnOfName } from '../../../data/explorer/qdnBy';
import type { AccountInfo } from '../../../data/types';
import { visibleName } from '../../../rules/explorer/nameNotes';
import type { MyStatus } from '../../../rules/status';
import { formatCount, formatDate, plural, shortAddress } from '../../../utils/format';
import { minterStatusWord } from '../account/accountWords';
import { balanceWords, signedCount } from '../account/overview/overviewWords';

export interface SideCell {
  /** Equal for equal values (a row of equal keys collapses). */
  key: string;
  /** Plain words. */
  text?: string;
  /** A name, shown isolated. */
  name?: string;
  /** An account, shown as a link to it. */
  account?: string;
  /** Words before the name or account. */
  before?: string;
  /** Words after it. */
  after?: string;
}

export interface SideRow {
  key: string;
  label: string;
  cells: Array<SideCell | undefined>;
}

export interface SideFacts {
  account: AccountInfo;
  /** Primary name (null: none; undefined: reading). */
  primary: string | null | undefined;
  names?: NamesOf;
  first?: FirstSeen;
  balance?: number;
  status?: MyStatus;
  /** Its sponsor (null: none; undefined: reading). */
  sponsor: string | null | undefined;
  /** How many accounts it sponsored (undefined: reading). */
  sponsees?: number;
  sponseesCapped?: boolean;
  mintingNow?: boolean;
  /** Its newest own transaction (null: none). */
  lastSent?: LastSent | null;
  groups?: GroupOf[];
  /** What its primary name published on QDN. */
  qdn?: QdnOfName;
}

const plain = (text: string, key = text): SideCell => ({ key, text });

function namesCell(f: SideFacts): SideCell | undefined {
  if (f.primary === undefined || !f.names) return undefined;
  const count = f.names.names.length;
  const more = f.names.truncated ? '+' : '';
  if (f.primary) {
    const others = Math.max(0, count - 1);
    return {
      key: `${f.primary}|${count}${more}`,
      name: f.primary,
      after: others || more ? ` and ${formatCount(others)}${more} more` : undefined,
    };
  }
  return count
    ? plain(
        `No primary name (${formatCount(count)}${more} ${count === 1 && !more ? 'name' : 'names'})`
      )
    : plain('No registered name');
}

function firstQortCell(first: FirstSeen | undefined): SideCell | undefined {
  if (!first) return undefined;
  const funding = first.funding;
  if (!funding) return plain('Not found');
  const from = funding.from;
  switch (funding.kind) {
    case 'payment':
    case 'multiPayment':
      return from ? { key: from, account: from } : plain('A payment');
    case 'transferAsset':
      return from
        ? { key: `asset:${from}`, account: from, before: 'An asset transfer from ' }
        : plain('An asset transfer');
    case 'rewardShare':
      return from
        ? { key: `share:${from}`, account: from, before: 'A reward share from ' }
        : plain('A reward share');
    case 'transferPrivs':
      return from
        ? { key: `level:${from}`, account: from, before: 'Its minting level from ' }
        : plain('A minting level');
    case 'at':
      return plain('An AT (automated contract)');
    case 'genesis':
      return plain('The genesis block');
  }
}

/** The rows for the accounts Core knows, in letter order. */
export function sideRows(facts: readonly SideFacts[]): SideRow[] {
  const row = (
    key: string,
    label: string,
    cell: (f: SideFacts) => SideCell | undefined
  ): SideRow => ({
    key,
    label,
    cells: facts.map(cell),
  });
  return [
    row('names', 'Names', namesCell),
    row('firstSeen', 'First seen', (f) => {
      if (!f.first) return undefined;
      const seen = f.first.firstSeen;
      return seen
        ? plain(
            `${formatDate(seen.timestamp)} · block ${formatCount(seen.height)}`,
            String(seen.height)
          )
        : plain('Not found');
    }),
    row('firstQort', 'First QORT from', (f) => firstQortCell(f.first)),
    row('level', 'Level', (f) => plain(`Level ${f.account.level}`)),
    row('blocks', 'Blocks minted', (f) => plain(formatCount(f.account.blocksMinted))),
    row('penalty', 'Minting penalty', (f) =>
      plain(
        f.account.blocksMintedPenalty
          ? `${signedCount(f.account.blocksMintedPenalty)} blocks`
          : 'None'
      )
    ),
    row('balance', 'Balance', (f) => {
      if (f.balance === undefined) return undefined;
      const words = balanceWords(f.balance);
      return plain(`${words.short} QORT`, words.full);
    }),
    row('status', 'MINTER status', (f) =>
      f.status ? plain(minterStatusWord(f.status)) : undefined
    ),
    row('sponsor', 'Sponsor', (f) =>
      f.sponsor === undefined
        ? undefined
        : f.sponsor
          ? { key: f.sponsor, account: f.sponsor }
          : plain('None found')
    ),
    row('sponsored', 'Sponsored', (f) =>
      f.sponsees === undefined
        ? undefined
        : f.sponsees
          ? plain(`${plural(f.sponsees, 'account')}${f.sponseesCapped ? '+' : ''}`)
          : plain('None')
    ),
    row('mintingNow', 'Minting now', (f) =>
      f.mintingNow === undefined ? undefined : plain(f.mintingNow ? 'Yes' : 'No')
    ),
    row('lastSent', 'Last sent a transaction', (f) => {
      if (!f.account.publicKey) return plain('Never');
      if (f.lastSent === undefined) return undefined;
      return f.lastSent
        ? plain(
            `${formatDate(f.lastSent.timestamp)} · block ${formatCount(f.lastSent.height)}`,
            String(f.lastSent.height)
          )
        : plain('Never');
    }),
    row('groups', 'Groups', (f) => (f.groups ? plain(formatCount(f.groups.length)) : undefined)),
    row('qdn', 'QDN publishes', (f) => {
      if (f.primary === undefined) return undefined;
      if (f.primary === null) return plain('No primary name');
      if (!f.qdn) return undefined;
      const count = `${formatCount(f.qdn.resources.length)}${f.qdn.capped ? '+' : ''}`;
      return { key: `${f.primary}|${count}`, before: `${count} as `, name: f.primary };
    }),
  ];
}

/** The one cell a row's cells all equal, or null (or while any is out). */
export function sameForAll(cells: ReadonlyArray<SideCell | undefined>): SideCell | null {
  if (cells.length < 2 || cells.some((cell) => cell === undefined)) return null;
  const [first] = cells as SideCell[];
  return cells.every((cell) => cell?.key === first.key) ? first : null;
}

/** A cell as plain words (Copy findings, labels). */
export function cellText(
  cell: SideCell,
  nameOf?: (address: string) => string | null | undefined
): string {
  const middle = cell.account
    ? (nameOf?.(cell.account) ?? shortAddress(cell.account))
    : cell.name !== undefined
      ? visibleName(cell.name)
      : (cell.text ?? '');
  return `${cell.before ?? ''}${middle}${cell.after ?? ''}`;
}
