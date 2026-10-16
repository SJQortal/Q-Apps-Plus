/**
 * How an account is linked to other accounts, from its links search
 * (data/explorer/links.ts: reward shares, minting levels moved, names
 * bought or sold): each link a plain sentence with the transactions behind
 * it. Evidence, never a verdict: what happened, with whom, when, and how
 * many; nothing here says what it means.
 *
 * - Level moved (TRANSFER_PRIVS): sent by the account ("Moved its minting
 *   level to C", the recipient read from the raw bytes), or received from
 *   its creator ("Got its minting level from P").
 * - Sponsors: each account that made a reward share to this one (not a
 *   removal), the earliest first: the sponsor. How long the share ran is
 *   the blocks until the first removal that followed it. A removal is a
 *   share with a negative percent (-1, or -1000000 in old ones).
 * - Sponsees: the accounts it made reward shares to (not a removal, not
 *   itself), with the first share, and whether the latest one for the pair
 *   is a removal.
 * - Active shares: the latest row of each pair is not a removal; with the
 *   online list, "Minting with B now".
 * - Names: BUY_NAME bought (it is the buyer) or sold (it is the seller).
 *
 * Pure: no reads.
 */
import type { TxRow } from '../../data/types';
import type { Funding, PayerBand } from '../../data/explorer/account';
import type { SponsorshipReport } from '../../data/explorer/sponsorship';
import { formatCount, formatDate, plural } from '../../utils/format';
import { formatAmount, type TxPart } from './txWords';

export interface TxRef {
  height: number;
  timestamp: number;
  signature: string;
}

export const refOf = (tx: TxRow): TxRef => ({
  height: tx.blockHeight ?? 0,
  timestamp: tx.timestamp,
  signature: tx.signature,
});

const ADDRESS_RE = /^[QA][1-9A-HJ-NP-Za-km-z]{33}$/;
const isAccount = (value: unknown): value is string =>
  typeof value === 'string' && ADDRESS_RE.test(value);

/** A reward share that ends one: a negative percent. */
export function isRemoval(tx: TxRow): boolean {
  return Number(tx.sharePercent) < 0;
}

/** "0", "5.5". */
export function percentOf(tx: TxRow): string {
  return formatAmount(String(tx.sharePercent ?? '0'));
}

/** Confirmed rows, oldest first. */
function ascending(rows: readonly TxRow[]): TxRow[] {
  return rows
    .filter((row) => typeof row.blockHeight === 'number')
    .sort((a, b) => (a.blockHeight ?? 0) - (b.blockHeight ?? 0) || a.timestamp - b.timestamp);
}

const newestFirst = (rows: TxRow[]) => [...rows].reverse();

// ---- what the links say ------------------------------------------------------------

export interface LevelMove {
  /** `to`: it moved its level to `other`; `from`: it got its level from `other`. */
  direction: 'to' | 'from';
  /** The other account; null when a sent move's recipient couldn't be read. */
  other: string | null;
  ref: TxRef;
  tx: TxRow;
}

export interface Sponsorship {
  sponsor: string;
  /** The first share's percent ("0"). */
  percent: string;
  start: TxRef;
  /** The first removal after the first share. */
  removal: TxRef | null;
  /** Blocks from the first share to that removal. */
  blocks: number | null;
  /** Every reward share between the two, newest first. */
  txs: TxRow[];
}

export interface Sponsee {
  address: string;
  /** The first share's percent ("0"). */
  percent: string;
  start: TxRef;
  /** The first removal after the first share. */
  removal: TxRef | null;
  blocks: number | null;
  /** The latest row for the pair is a share, not a removal. */
  active: boolean;
  /** Shares made to it (removals not counted). */
  shares: number;
  /** Every reward share between the two, newest first. */
  txs: TxRow[];
}

export interface ActiveShare {
  other: string;
  /** The account's part: it made the share (`minter`) or gets it (`recipient`). */
  role: 'minter' | 'recipient';
  percent: string;
  since: TxRef;
  tx: TxRow;
}

export interface NameDeal {
  kind: 'bought' | 'sold';
  name: string;
  other: string | null;
  amount: string;
  ref: TxRef;
  tx: TxRow;
}

export interface Links {
  levelMoves: LevelMove[];
  /** The earliest first: [0] is its sponsor. */
  sponsors: Sponsorship[];
  /** In the order of their first share. */
  sponsees: Sponsee[];
  activeShares: ActiveShare[];
  nameDeals: NameDeal[];
}

/** One pair's shares (oldest first): first share, first removal after it, latest row. */
function pairFacts(rows: TxRow[]) {
  const firstShare = rows.find((row) => !isRemoval(row)) ?? null;
  const removal = firstShare
    ? (rows.find(
        (row) => isRemoval(row) && (row.blockHeight ?? 0) >= (firstShare.blockHeight ?? 0)
      ) ?? null)
    : null;
  const latest = rows[rows.length - 1];
  return {
    firstShare,
    removal,
    blocks:
      firstShare && removal ? (removal.blockHeight ?? 0) - (firstShare.blockHeight ?? 0) : null,
    active: Boolean(latest) && !isRemoval(latest),
    shares: rows.filter((row) => !isRemoval(row)).length,
  };
}

function byPair(rows: TxRow[], keyOf: (row: TxRow) => string | null): Map<string, TxRow[]> {
  const pairs = new Map<string, TxRow[]>();
  for (const row of rows) {
    const key = keyOf(row);
    if (!key) continue;
    const list = pairs.get(key);
    if (list) list.push(row);
    else pairs.set(key, [row]);
  }
  return pairs;
}

const shareRows = (rows: readonly TxRow[]) =>
  ascending(rows).filter(
    (row) =>
      row.type === 'REWARD_SHARE' && isAccount(row.creatorAddress) && isAccount(row.recipient)
  );

/** The accounts `sponsor` made reward shares to, in the order of their first share. */
export function sponseesOf(rows: readonly TxRow[], sponsor: string): Sponsee[] {
  const mine = shareRows(rows).filter(
    (row) => row.creatorAddress === sponsor && row.recipient !== sponsor
  );
  const sponsees: Sponsee[] = [];
  for (const [address, pair] of byPair(mine, (row) => row.recipient as string)) {
    const facts = pairFacts(pair);
    if (!facts.firstShare) continue;
    sponsees.push({
      address,
      percent: percentOf(facts.firstShare),
      start: refOf(facts.firstShare),
      removal: facts.removal ? refOf(facts.removal) : null,
      blocks: facts.blocks,
      active: facts.active,
      shares: facts.shares,
      txs: newestFirst(pair),
    });
  }
  return sponsees.sort((a, b) => a.start.height - b.start.height);
}

/** Everything the links search says about `address`. */
export function linksOf(
  rows: readonly TxRow[],
  address: string,
  privs: Readonly<Record<string, string | null>> = {}
): Links {
  const sorted = ascending(rows);

  const levelMoves: LevelMove[] = sorted
    .filter((row) => row.type === 'TRANSFER_PRIVS')
    .map((row) => {
      const mine = row.creatorAddress === address;
      const recipient = privs[row.signature];
      return {
        direction: mine ? 'to' : 'from',
        other: mine
          ? isAccount(recipient)
            ? recipient
            : null
          : isAccount(row.creatorAddress)
            ? row.creatorAddress
            : null,
        ref: refOf(row),
        tx: row,
      } satisfies LevelMove;
    })
    .filter((move) => move.direction === 'to' || move.other !== null);

  const shares = shareRows(sorted);
  const toMe = shares.filter((row) => row.recipient === address && row.creatorAddress !== address);
  const sponsors: Sponsorship[] = [];
  for (const [sponsor, pair] of byPair(toMe, (row) => row.creatorAddress as string)) {
    const facts = pairFacts(pair);
    if (!facts.firstShare) continue;
    sponsors.push({
      sponsor,
      percent: percentOf(facts.firstShare),
      start: refOf(facts.firstShare),
      removal: facts.removal ? refOf(facts.removal) : null,
      blocks: facts.blocks,
      txs: newestFirst(pair),
    });
  }
  sponsors.sort((a, b) => a.start.height - b.start.height);

  const activeShares: ActiveShare[] = [];
  for (const pair of byPair(shares, (row) =>
    row.creatorAddress === row.recipient ? null : `${row.creatorAddress}>${row.recipient}`
  ).values()) {
    const latest = pair[pair.length - 1];
    if (isRemoval(latest)) continue;
    const minter = latest.creatorAddress as string;
    const recipient = latest.recipient as string;
    if (minter !== address && recipient !== address) continue;
    activeShares.push({
      other: minter === address ? recipient : minter,
      role: minter === address ? 'minter' : 'recipient',
      percent: percentOf(latest),
      since: refOf(latest),
      tx: latest,
    });
  }

  const nameDeals: NameDeal[] = [];
  for (const row of sorted) {
    if (row.type !== 'BUY_NAME') continue;
    const seller = isAccount(row.seller) ? row.seller : null;
    const buyer = isAccount(row.creatorAddress) ? row.creatorAddress : null;
    const deal = {
      name: typeof row.name === 'string' ? row.name : '',
      amount: String(row.amount ?? '0'),
      ref: refOf(row),
      tx: row,
    };
    if (buyer === address) nameDeals.push({ kind: 'bought', other: seller, ...deal });
    else if (seller === address) nameDeals.push({ kind: 'sold', other: buyer, ...deal });
  }

  return {
    levelMoves,
    sponsors,
    sponsees: sponseesOf(sorted, address),
    activeShares,
    nameDeals,
  };
}

/** The account's active shares that are minting now (in `/addresses/online`). */
export function mintingWithNow(
  links: Pick<Links, 'activeShares'>,
  address: string,
  online: ReadonlyArray<{ minterAddress: string; recipientAddress: string }>
): ActiveShare[] {
  const live = new Set(online.map((share) => `${share.minterAddress}>${share.recipientAddress}`));
  return links.activeShares.filter((share) =>
    live.has(share.role === 'minter' ? `${address}>${share.other}` : `${share.other}>${address}`)
  );
}

// ---- dates -------------------------------------------------------------------------

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short' });

/** "Mar 2025", "Mar–May 2025", "May 2023 – Mar 2025". */
export function monthRange(a: number, b: number): string {
  const [from, to] = a <= b ? [new Date(a), new Date(b)] : [new Date(b), new Date(a)];
  const fy = from.getFullYear();
  const ty = to.getFullYear();
  const fm = MONTH.format(from);
  const tm = MONTH.format(to);
  if (fy === ty && from.getMonth() === to.getMonth()) return `${fm} ${fy}`;
  if (fy === ty) return `${fm}–${tm} ${fy}`;
  return `${fm} ${fy} – ${tm} ${ty}`;
}

/** One day ("12 Mar 2025"), or the months a span covers. */
export function whenWords(first: number, last: number): string {
  return first === last ? formatDate(first) : monthRange(first, last);
}

// ---- sentences ---------------------------------------------------------------------

const text = (value: string): TxPart => ({ kind: 'text', text: value });
const account = (address: string): TxPart => ({ kind: 'account', address });

/** "Moved its minting level to C" / "Got its minting level from P. P is now level 0." */
export function levelMoveParts(move: LevelMove, otherLevel?: number): TxPart[] {
  if (move.direction === 'to')
    return move.other
      ? [text('Moved its minting level to '), account(move.other)]
      : [text('Moved its minting level to another account (its recipient couldn’t be read)')];
  const from = move.other as string;
  return otherLevel === undefined
    ? [text('Got its minting level from '), account(from)]
    : [
        text('Got its minting level from '),
        account(from),
        text('. '),
        account(from),
        text(` is now level ${otherLevel}.`),
      ];
}

/** "Sponsored by A at 0 % for 7,234 blocks". */
export function sponsorParts(sponsorship: Sponsorship): TxPart[] {
  return [
    text('Sponsored by '),
    account(sponsorship.sponsor),
    text(
      ` at ${sponsorship.percent} %${
        sponsorship.blocks !== null
          ? ` for ${plural(sponsorship.blocks, 'block')}`
          : ', not removed'
      }`
    ),
  ];
}

/** "Sponsored 48 accounts (May 2023 – Mar 2025)". */
export function sponseesSummary(sponsees: readonly Sponsee[]): string {
  if (!sponsees.length) return 'Sponsored no accounts';
  const starts = sponsees.map((s) => s.start.timestamp);
  return `Sponsored ${plural(sponsees.length, 'account')} (${monthRange(
    Math.min(...starts),
    Math.max(...starts)
  )})`;
}

/** "Minting with B now, in a reward share at 0 %". */
export function mintingWithParts(share: ActiveShare): TxPart[] {
  return [
    text('Minting with '),
    account(share.other),
    text(
      share.role === 'minter'
        ? ` now, in its reward share at ${share.percent} %`
        : ` now, in a reward share from them at ${share.percent} %`
    ),
  ];
}

/** "Bought the name “foo” from B for 1 QORT" / "Sold the name “foo” to B for 1 QORT". */
export function nameDealParts(deal: NameDeal): TxPart[] {
  const price: TxPart = { kind: 'amount', amount: formatAmount(deal.amount), asset: 'QORT' };
  const name: TxPart = { kind: 'name', name: deal.name };
  if (deal.kind === 'bought')
    return deal.other
      ? [text('Bought the name '), name, text(' from '), account(deal.other), text(' for '), price]
      : [text('Bought the name '), name, text(' for '), price];
  return deal.other
    ? [text('Sold the name '), name, text(' to '), account(deal.other), text(' for '), price]
    : [text('Sold the name '), name, text(' for '), price];
}

/** "Also sponsored by A (47 others)". */
export function siblingsParts(sponsor: string, others: number): TxPart[] {
  return [text('Also sponsored by '), account(sponsor), text(` (${plural(others, 'other')})`)];
}

/** "has sent 1,000+ payments", or null under 100. */
export function bandWords(band: PayerBand | undefined): string | null {
  return band ? `has sent ${formatCount(band)}+ payments` : null;
}

/**
 * Where its first QORT came from, worded by the kind of transaction:
 * "First QORT payment received: 5.4321 QORT from H. H has sent 500+ payments."
 */
export function fundingParts(funding: Funding, band?: PayerBand): TxPart[] {
  const from = funding.from;
  const busy = (who: string): TxPart[] => {
    const words = bandWords(band);
    return words ? [text('. '), account(who), text(` ${words}.`)] : [];
  };
  switch (funding.kind) {
    case 'payment':
    case 'multiPayment':
      return from
        ? [
            text('First QORT payment received: '),
            { kind: 'amount', amount: formatAmount(funding.amount ?? '0'), asset: 'QORT' },
            text(' from '),
            account(from),
            ...busy(from),
          ]
        : [text('First QORT payment received: '), text(formatAmount(funding.amount ?? '0'))];
    case 'transferAsset':
      return from
        ? [
            text('Its first incoming transaction: an asset transfer from '),
            account(from),
            ...busy(from),
          ]
        : [text('Its first incoming transaction: an asset transfer')];
    case 'rewardShare':
      return from
        ? [
            text(
              `Its first incoming transaction: a ${formatAmount(funding.sharePercent ?? '0')} % reward share from `
            ),
            account(from),
          ]
        : [text('Its first incoming transaction: a reward share')];
    case 'transferPrivs':
      return from
        ? [text('Got its minting level from '), account(from)]
        : [text('Got its minting level from another account')];
    case 'at':
      return [text('First QORT came from an AT (automated contract)')];
    case 'genesis':
      return [text('Received QORT in the genesis block')];
  }
}

// ---- what was checked ----------------------------------------------------------------

/** A part of the links that was read and found nothing, in the order the page lists them. */
export type EmptyCheck =
  'levelMoves' | 'sponsor' | 'sponsees' | 'mintingWith' | 'nameSales' | 'payments' | 'firstQort';

const EMPTY_WORDS: Record<EmptyCheck, string> = {
  levelMoves: 'level moves',
  sponsor: 'a sponsor',
  sponsees: 'accounts it sponsored',
  mintingWith: 'minting with another account now',
  nameSales: 'name sales',
  payments: 'payments',
  firstQort: 'where its first QORT came from',
};

/** "Also checked, nothing found: level moves, name sales." (null when nothing is empty). */
export function nothingFoundLine(empty: readonly EmptyCheck[]): string | null {
  if (!empty.length) return null;
  return `Also checked, nothing found: ${empty.map((check) => EMPTY_WORDS[check]).join(', ')}.`;
}

/**
 * What the links search found nothing of. `mintingWith` is null while the
 * online list isn't loaded (not checked yet, so not listed).
 */
export function emptyLinkChecks(
  links: Links,
  mintingWith: readonly ActiveShare[] | null
): EmptyCheck[] {
  const empty: EmptyCheck[] = [];
  if (!links.levelMoves.length) empty.push('levelMoves');
  if (!links.sponsors.length) empty.push('sponsor');
  if (!links.sponsees.length) empty.push('sponsees');
  if (mintingWith && !mintingWith.length) empty.push('mintingWith');
  if (!links.nameDeals.length) empty.push('nameSales');
  return empty;
}

// ---- first QORT across a set ------------------------------------------------------------

export interface FirstPayer {
  from: string;
  /** The accounts whose first QORT payment came from it. */
  accounts: string[];
}

/**
 * Who made the first QORT payment to the accounts of a set (payments and
 * multi-payments only), most accounts first; and how many had a different
 * first transaction or none found.
 */
export function groupFirstPayers(funding: ReadonlyMap<string, Funding | null>): {
  payers: FirstPayer[];
  other: number;
  none: number;
} {
  const payers = new Map<string, string[]>();
  let other = 0;
  let none = 0;
  for (const [address, first] of funding) {
    if (!first) none += 1;
    else if ((first.kind === 'payment' || first.kind === 'multiPayment') && first.from) {
      const list = payers.get(first.from);
      if (list) list.push(address);
      else payers.set(first.from, [address]);
    } else other += 1;
  }
  return {
    payers: [...payers]
      .map(([from, accounts]) => ({ from, accounts }))
      .sort((a, b) => b.accounts.length - a.accounts.length || a.from.localeCompare(b.from)),
    other,
    none,
  };
}

// ---- Core's own report, in honest words --------------------------------------------------

/**
 * Core's sponsorship report, each number said for what Core really counts:
 * every account it ever made a reward share to (removed and never-used
 * ones too); names, not accounts; transactions where a sponsee took part
 * either way; trade-portal amounts in whole QORT.
 */
export function sponsorReportLines(report: SponsorshipReport): string[] {
  const lines = [
    `Accounts it ever made a reward share to: ${formatCount(report.sponseeCount)} (removed shares included).`,
    `Names of its sponsees: ${formatCount(report.names.length)}. Core counts names, not accounts: one sponsee can own several, or none.`,
    `Core’s “not registered” figure is ${formatCount(report.nonRegisteredCount)}: the sponsee count minus the number of names, not the number of sponsees without a name.`,
    `Average balance of its sponsees: ${formatCount(report.avgBalance)} QORT (whole QORT; sponsees with no balance are left out).`,
    `Transactions its sponsees took part in, sent or received: ${plural(report.arbitraryCount, 'QDN publish', 'QDN publishes')}, ${plural(report.transferAssetCount, 'asset transfer')}, ${plural(report.transferPrivsCount, 'level move')}. One between two sponsees counts twice.`,
    `Trade portal: its sponsees sold ${formatCount(report.sellAmount)} QORT in ${plural(report.sellCount, 'trade')} and bought ${formatCount(report.buyAmount)} QORT in ${plural(report.buyCount, 'trade')} (whole QORT).`,
  ];
  if (report.transfer)
    lines.push('This account sent or received a minting level (Core doesn’t say which).');
  return lines;
}
