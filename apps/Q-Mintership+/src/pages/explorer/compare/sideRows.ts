/**
 * Compare → Side by side: one row per fact, one cell per account, in the
 * Overview's words (names, first seen, first QORT from, level, blocks
 * minted, minting penalty, balance, MINTER status, sponsor, sponsored,
 * minting now, last sent a transaction, groups, QDN publishes). A cell is
 * undefined while its read is out, and says "Couldn’t read" when the read
 * failed (never a value it doesn't have). A row whose cells are all the
 * same reads "Same for all: …".
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
  /** Its read failed: the text says so, and the row never reads "Same for all". */
  failed?: boolean;
}

export interface SideRow {
  key: string;
  label: string;
  cells: Array<SideCell | undefined>;
}

/** The reads Side by side needs, beyond the account itself. */
export type SideRead =
  | 'primary'
  | 'names'
  | 'first'
  | 'balance'
  | 'status'
  | 'links'
  | 'online'
  | 'lastSent'
  | 'groups'
  | 'qdn';

export interface SideFacts {
  account: AccountInfo;
  /** Primary name (null: none; undefined: reading, or its read failed). */
  primary: string | null | undefined;
  names?: NamesOf;
  first?: FirstSeen;
  balance?: number;
  status?: MyStatus;
  /** Its sponsor (null: none; undefined: reading). */
  sponsor: string | null | undefined;
  /** How many accounts it sponsored (undefined: reading). */
  sponsees?: number;
  /** Its links were capped (only the newest 500 read): the sponsor and sponsee count may be partial. */
  sponseesCapped?: boolean;
  mintingNow?: boolean;
  /** Its newest own transaction (null: none). */
  lastSent?: LastSent | null;
  groups?: GroupOf[];
  /** What its primary name published on QDN. */
  qdn?: QdnOfName;
  /** The reads that failed (their cells say so instead of loading for good). */
  failed?: Partial<Record<SideRead, boolean>>;
}

const plain = (text: string, key = text): SideCell => ({ key, text });

/** "Couldn’t read", keyed to its account so a row of them never collapses. */
const failedCell = (f: SideFacts): SideCell => ({
  key: `failed:${f.account.address}`,
  text: 'Couldn’t read',
  failed: true,
});

/** The cell for a value still out: undefined while reading, "Couldn’t read" once failed. */
const unread = (f: SideFacts, read: SideRead): SideCell | undefined =>
  f.failed?.[read] ? failedCell(f) : undefined;

function namesCell(f: SideFacts): SideCell | undefined {
  if (!f.names) return unread(f, 'names');
  const count = f.names.names.length;
  const more = f.names.truncated ? '+' : '';
  // No names at all is a fact of its own: no primary name to read.
  if (!count && !more) return plain('No registered name');
  const counted = `${formatCount(count)}${more} ${count === 1 && !more ? 'name' : 'names'}`;
  if (f.primary === undefined)
    return f.failed?.primary
      ? { ...failedCell(f), text: `Couldn’t read the primary name (${counted})` }
      : undefined;
  if (f.primary) {
    const others = Math.max(0, count - 1);
    return {
      key: `${f.primary}|${count}${more}`,
      name: f.primary,
      after: others || more ? ` and ${formatCount(others)}${more} more` : undefined,
    };
  }
  return plain(`No primary name (${counted})`);
}

function firstQortCell(f: SideFacts): SideCell | undefined {
  const first = f.first;
  if (!first) return unread(f, 'first');
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
      if (!f.first) return unread(f, 'first');
      const seen = f.first.firstSeen;
      return seen
        ? plain(
            `${formatDate(seen.timestamp)} · block ${formatCount(seen.height)}`,
            String(seen.height)
          )
        : plain('Not found');
    }),
    row('firstQort', 'First QORT from', firstQortCell),
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
      if (f.balance === undefined) return unread(f, 'balance');
      const words = balanceWords(f.balance);
      return plain(`${words.short} QORT`, words.full);
    }),
    row('status', 'MINTER status', (f) =>
      f.status ? plain(minterStatusWord(f.status)) : unread(f, 'status')
    ),
    // Its first reward share in: only its newest 500 were read when capped, so it says so.
    row('sponsor', 'Sponsor', (f) =>
      f.sponsor === undefined
        ? unread(f, 'links')
        : f.sponsor
          ? f.sponseesCapped
            ? {
                key: `${f.sponsor}|newest 500`,
                account: f.sponsor,
                after: ' (the first in its newest 500 read)',
              }
            : { key: f.sponsor, account: f.sponsor }
          : plain(
              f.sponseesCapped
                ? 'None found in its newest 500 reward shares, level moves and name sales'
                : 'None found'
            )
    ),
    row('sponsored', 'Sponsored', (f) =>
      f.sponsees === undefined
        ? unread(f, 'links')
        : f.sponsees
          ? plain(`${plural(f.sponsees, 'account')}${f.sponseesCapped ? '+' : ''}`)
          : plain('None')
    ),
    row('mintingNow', 'Minting now', (f) =>
      f.mintingNow === undefined ? unread(f, 'online') : plain(f.mintingNow ? 'Yes' : 'No')
    ),
    row('lastSent', 'Last sent a transaction', (f) => {
      if (!f.account.publicKey) return plain('Never');
      if (f.lastSent === undefined) return unread(f, 'lastSent');
      return f.lastSent
        ? plain(
            `${formatDate(f.lastSent.timestamp)} · block ${formatCount(f.lastSent.height)}`,
            String(f.lastSent.height)
          )
        : plain('Never');
    }),
    row('groups', 'Groups', (f) =>
      f.groups ? plain(formatCount(f.groups.length)) : unread(f, 'groups')
    ),
    row('qdn', 'QDN publishes', (f) => {
      if (f.primary === undefined) return unread(f, 'primary');
      if (f.primary === null) return plain('No primary name');
      if (!f.qdn) return unread(f, 'qdn');
      const count = `${formatCount(f.qdn.resources.length)}${f.qdn.capped ? '+' : ''}`;
      return { key: `${f.primary}|${count}`, before: `${count} as `, name: f.primary };
    }),
  ];
}

/** The one cell a row's cells all equal, or null (or while any is out or failed). */
export function sameForAll(cells: ReadonlyArray<SideCell | undefined>): SideCell | null {
  if (cells.length < 2 || cells.some((cell) => cell === undefined || cell.failed)) return null;
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
