/**
 * The Overview's words: the parts of its summary sentence, the facts'
 * second lines, the minting line and the notes. Plain facts with their
 * numbers; where an account stands in MINTER comes from the app's own
 * status (rules/status.ts), never worked out here.
 */
import type { NamesOf, OnlineShare } from '../../../../data/explorer/account';
import { formatAmount } from '../../../../rules/explorer/txWords';
import type { MyStatus } from '../../../../rules/status';
import { formatCount, formatRelative, formatRoughDuration } from '../../../../utils/format';
import { PENALTY_WHY } from '../../../../constants/chipExplanations';

const MONTH_YEAR = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' });

/** "Mar 2024". */
export function monthYear(timestamp: number): string {
  return MONTH_YEAR.format(new Date(timestamp));
}

/** "+12,000", "−5,000,000" (a real minus sign), "0". */
export function signedCount(value: number): string {
  if (value === 0) return '0';
  return `${value > 0 ? '+' : '−'}${formatCount(Math.abs(value))}`;
}

// ---- the summary sentence -------------------------------------------------------

/** "Level 7". */
export function levelPart(level: number): string {
  return `Level ${level}`;
}

/**
 * Where it stands in MINTER, for the summary sentence (lower case: it
 * follows "Level 7 · "): "in MINTER since Mar 2024", "banned from MINTER".
 */
export function minterPart(
  status: Pick<MyStatus, 'kind' | 'wasMember'>,
  memberSince: number | null
): string {
  const since = memberSince ? ` since ${monthYear(memberSince)}` : '';
  switch (status.kind) {
    case 'admin':
      return `Minter Admin, in MINTER${since}`;
    case 'member':
    case 'memberNominator':
      return `in MINTER${since}`;
    case 'formerBanned':
      return 'banned from MINTER';
    case 'formerLeft':
      return 'former MINTER member';
    case 'formerKicked':
      return status.wasMember ? 'former MINTER member' : 'not in MINTER';
    case 'nominated':
      return 'nominated for MINTER';
    case 'approvedInvite':
      return 'approved for MINTER';
    default:
      return 'not in MINTER';
  }
}

/** "owns 88 names", "owns 500+ names", "owns 1 name"; null for none. */
export function namesPart(names: NamesOf): string | null {
  const count = names.names.length;
  if (count === 0) return null;
  const many = count > 1 || names.truncated;
  return `owns ${formatCount(count)}${names.truncated ? '+' : ''} ${many ? 'names' : 'name'}`;
}

/** For an account with no names: said plainly, with nothing to open. */
export const NO_NAMES_PART = 'no registered name';

/** "first seen Oct 2021". */
export function firstSeenPart(timestamp: number): string {
  return `first seen ${monthYear(timestamp)}`;
}

/** From 8 weeks, a gap reads in months and years (utils/format formatRoughDuration). */
const ROUGH_FROM_MS = 56 * 86_400_000;

/** "last sent a transaction 3 days ago", "… 11 months ago" (long gaps in round words). */
export function lastSentPart(timestamp: number, now = Date.now()): string {
  const ago = now - timestamp;
  const when =
    ago >= ROUGH_FROM_MS ? `${formatRoughDuration(ago)} ago` : formatRelative(timestamp, now);
  return `last sent a transaction ${when}`;
}

// ---- facts ------------------------------------------------------------------------

/** "Adjustment +12,000 · Penalty −5,000,000", or null when both are 0. */
export function blocksDetail(adjustment: number, penalty: number): string | null {
  const parts = [
    adjustment ? `Adjustment ${signedCount(adjustment)}` : null,
    penalty ? `Penalty ${signedCount(penalty)}` : null,
  ].filter((part): part is string => part !== null);
  return parts.length ? parts.join(' · ') : null;
}

const TWO_DECIMALS = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

/**
 * A balance with thousands separators: `short` rounded to 2 decimals from 1
 * QORT up ("6,480.54"), `full` with every decimal Core keeps
 * ("6,480.54123456"). Below 1 QORT the short one is the full one.
 */
export function balanceWords(qort: number): { short: string; full: string } {
  const full = formatAmount(qort.toFixed(8));
  const short = qort >= 1 ? TWO_DECIMALS.format(qort) : full;
  return { short, full };
}

/** "120,000 blocks to level 8", or "Top level". */
export function levelNextWords(level: number, blocksToNext: number | null): string {
  if (blocksToNext === null) return 'Top level';
  return `${formatCount(blocksToNext)} ${blocksToNext === 1 ? 'block' : 'blocks'} to level ${level + 1}`;
}

/** "In 45 groups", "In 1 group", "In no groups". */
export function groupsWords(count: number): string {
  if (count === 0) return 'In no groups';
  return `In ${formatCount(count)} ${count === 1 ? 'group' : 'groups'}`;
}

/** "5,200 members". */
/**
 * The Transactions fact (Simon, 2026-10-17: "every transactions should
 * be the main number, and QDN should be the smaller number below"): the
 * `read` transactions of its list and the QDN data ones among them, exact
 * once `done` (the whole history is in), else floors ("1,000+").
 */
export function qdnTxWords(
  qdn: number,
  read: number,
  done: boolean
): { value: string; detail: string } {
  if (done) return { value: formatCount(read), detail: `${formatCount(qdn)} of them on QDN.` };
  return {
    value: `${formatCount(read)}+`,
    detail: `${formatCount(qdn)}+ of them on QDN. Activity below reads further back.`,
  };
}

export function membersWords(count: number): string {
  return `${formatCount(count)} ${count === 1 ? 'member' : 'members'}`;
}

// ---- minting ----------------------------------------------------------------------

export interface MintingNow {
  /** It mints with its own key (a self-share). */
  self: boolean;
  /** The other accounts it shares a reward-share key with, online now. */
  others: string[];
}

/** What the online list says about `address`; null when it isn't in it. */
export function mintingNowOf(shares: readonly OnlineShare[], address: string): MintingNow | null {
  let self = false;
  const others: string[] = [];
  for (const share of shares) {
    const mine = share.minterAddress === address || share.recipientAddress === address;
    if (!mine) continue;
    if (share.minterAddress === share.recipientAddress) self = true;
    else {
      const other = share.minterAddress === address ? share.recipientAddress : share.minterAddress;
      if (!others.includes(other)) others.push(other);
    }
  }
  return self || others.length ? { self, others } : null;
}

export const NOT_MINTING = 'Not minting right now.';

// ---- notes ------------------------------------------------------------------------

/**
 * "Core recorded a minting penalty of −5,000,000 blocks on this account:
 * its self-sponsorship check …" (constants/chipExplanations.ts says what
 * that check looked for, after the figure).
 */
export function penaltySentence(penalty: number): string {
  return `Core recorded a minting penalty of ${signedCount(penalty)} blocks on this account, set by its self-sponsorship check, which holds it at level 0. ${PENALTY_WHY}`;
}

/** "2 of its 29 other names have notes", "Its other name has notes". */
export function otherNotesWords(withNotes: number, others: number): string {
  if (others === 1) return 'Its other name has notes';
  return `${formatCount(withNotes)} of its ${formatCount(others)} other names ${
    withNotes === 1 ? 'has notes' : 'have notes'
  }`;
}
