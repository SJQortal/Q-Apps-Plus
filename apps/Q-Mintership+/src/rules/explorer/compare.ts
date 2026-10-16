/**
 * Compare: two to four accounts side by side, lettered A–D. What the page
 * lists, worked out from the reads already made (pure, no reads):
 *
 * - the link's accounts: up to 4 valid addresses, each once; whatever else
 *   was in the link is left out and said so;
 * - "Recorded between them", pair by pair: payments each way (with asset
 *   transfers and multi-payments), reward shares, minting levels moved,
 *   names bought or sold, Q-Mintership records, and trade-portal sales,
 *   each a sentence with its numbers and blocks or dates; and what was
 *   checked and found nothing;
 * - "In common": the same sponsor (with how many accounts it sponsored),
 *   the same first payer, accounts both paid or were paid by (with the
 *   direction, the counts, busy payers and AT addresses left out and
 *   counted), shared groups smallest first (MINTER is shown elsewhere), and
 *   how far apart in blocks or time some firsts happened;
 * - "Timeline together": one list of firsts across the accounts, in order,
 *   with the gap to the line before;
 * - "Copy findings": all of it as plain text.
 *
 * Evidence only: numbers, blocks, dates and directions, never a verdict and
 * never a threshold. Nothing here says what a link means.
 */
import type { TxRow } from '../../data/types';
import type { FirstSeen, GroupOf, OnlineShare, PayerBand } from '../../data/explorer/account';
import type { AccountLinks } from '../../data/explorer/links';
import type { AssetTransfers, PaymentPage } from '../../data/explorer/money';
import type { MadeBy } from '../../data/explorer/madeBy';
import type { PairPayments, Trade, TradesOf } from '../../data/explorer/compare';
import { MINTER_GROUP_ID } from '../../data/constants';
import {
  formatCount,
  formatDate,
  formatRoughDuration,
  plural,
  shortAddress,
} from '../../utils/format';
import { isRemoval, linksOf, monthRange, sponseesOf, whenWords } from './connections';
import { partsText } from './findings';
import { flowAmounts, flowsOf, formatAtomic, parseAtomic, type Flow } from './money';
import { txTypeLabel } from './txFamilies';
import { formatAmount, type TxPart } from './txWords';

// ---- letters and the link ------------------------------------------------------------

export const LETTERS = ['A', 'B', 'C', 'D'] as const;
export type Letter = (typeof LETTERS)[number];
export const COMPARE_LIMIT = LETTERS.length;

export const letterOf = (index: number): Letter => LETTERS[index] ?? 'D';

const ADDRESS_RE = /^Q[1-9A-HJ-NP-Za-km-z]{33}$/;
const AT_RE = /^A[1-9A-HJ-NP-Za-km-z]{33}$/;

export type DroppedReason = 'invalid' | 'at' | 'duplicate' | 'extra';

export interface Dropped {
  value: string;
  reason: DroppedReason;
}

export interface ComparePath {
  /** The accounts to compare, in the link's order. */
  addresses: string[];
  /** What else the link held. */
  dropped: Dropped[];
}

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** The accounts in `/explorer/compare/<a>/<b>/…` (the part after `compare/`). */
export function parseComparePath(rest: string | undefined): ComparePath {
  const addresses: string[] = [];
  const dropped: Dropped[] = [];
  for (const segment of (rest ?? '').split('/')) {
    const value = decode(segment).trim();
    if (!value) continue;
    if (AT_RE.test(value)) dropped.push({ value, reason: 'at' });
    else if (!ADDRESS_RE.test(value)) dropped.push({ value, reason: 'invalid' });
    else if (addresses.includes(value)) dropped.push({ value, reason: 'duplicate' });
    else if (addresses.length >= COMPARE_LIMIT) dropped.push({ value, reason: 'extra' });
    else addresses.push(value);
  }
  return { addresses, dropped };
}

/** What was typed, short enough for a sentence. */
function shown(value: string): string {
  if (ADDRESS_RE.test(value) || AT_RE.test(value)) return shortAddress(value);
  return value.length > 24 ? `“${value.slice(0, 20)}…”` : `“${value}”`;
}

/**
 * "Left out of this comparison: “hello” isn't a valid Qortal address;
 * QaBcDe…WxYz was in the link twice." Null when nothing was left out.
 */
export function droppedNote(dropped: readonly Dropped[]): string | null {
  if (!dropped.length) return null;
  const parts = dropped.map(({ value, reason }) => {
    switch (reason) {
      case 'invalid':
        return `${shown(value)} isn't a valid Qortal address`;
      case 'at':
        return `${shown(value)} is an AT address (an automated contract), not a personal account`;
      case 'duplicate':
        return `${shown(value)} was in the link twice`;
      case 'extra':
        return `${shown(value)} was a 5th account (Compare holds 4)`;
    }
  });
  return `Left out of this comparison: ${parts.join('; ')}.`;
}

/** "A", "A and B", "A, B and C". */
export function listWords(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

// ---- pairs ---------------------------------------------------------------------------

export interface PairRef {
  /** Indexes of the two accounts, i < j. */
  i: number;
  j: number;
  /** "A–B". */
  label: string;
  /** "a-b", for ids. */
  id: string;
}

/** Every pair of `count` accounts, in letter order: A–B, A–C, …, C–D. */
export function pairsOf(count: number): PairRef[] {
  const pairs: PairRef[] = [];
  for (let i = 0; i < count; i++)
    for (let j = i + 1; j < count; j++)
      pairs.push({
        i,
        j,
        label: `${letterOf(i)}–${letterOf(j)}`,
        id: `${letterOf(i).toLowerCase()}-${letterOf(j).toLowerCase()}`,
      });
  return pairs;
}

/** One compared account and what has been read about it (undefined: not read yet). */
export interface CompareSide {
  address: string;
  letter: Letter;
  /** Reward shares, level moves, name sales (xlinks). */
  links?: AccountLinks;
  /** Its newest 100 asset transfers and multi-payments (xassets). */
  assets?: AssetTransfers;
  /** Its Q-Mintership+ records under any of its names (xmade). */
  made?: MadeBy;
  /** Trades it sold; null when it has no public key (it never sold one). */
  trades?: TradesOf | null;
  first?: FirstSeen;
  groups?: GroupOf[];
  /** Its newest 100 QORT payments each way (xpay). */
  sent?: PaymentPage;
  recv?: PaymentPage;
}

const text = (value: string): TxPart => ({ kind: 'text', text: value });
const account = (address: string): TxPart => ({ kind: 'account', address });
const qort = (amount: string): TxPart => ({ kind: 'amount', amount, asset: 'QORT' });

// ---- recorded between them -----------------------------------------------------------

export type PairCheck =
  'payments' | 'rewardShares' | 'levelMoves' | 'nameSales' | 'records' | 'trades';

/** The order checks are listed in. */
export const PAIR_CHECKS: readonly PairCheck[] = [
  'payments',
  'rewardShares',
  'levelMoves',
  'nameSales',
  'records',
  'trades',
];

export const PAIR_CHECK_WORDS: Readonly<Record<PairCheck, string>> = {
  payments: 'payments both ways',
  rewardShares: 'reward shares',
  levelMoves: 'level moves',
  nameSales: 'name sales',
  records: 'Q-Mintership records',
  trades: 'trade portal sales',
};

export type PairFindingKind =
  'payment' | 'rewardShare' | 'levelMove' | 'nameDeal' | 'record' | 'trade';

export interface PairFinding {
  /** Stable across loads, for React keys. */
  key: string;
  kind: PairFindingKind;
  /** Who did it: the payer, the sponsor, the sender of the level, the buyer, the publisher, the seller. */
  actor: string;
  other: string;
  parts: TxPart[];
  /** The newest block, when it has one. */
  height?: number;
  /** The oldest block, for several transactions. */
  firstHeight?: number;
  timestamp: number;
  firstTimestamp?: number;
  /** The newest transaction behind it. */
  signature?: string;
  /** How many transactions or records stand behind it, when more than one. */
  count?: number;
  /** The transactions behind it, newest first (none for records and trades). */
  evidence: TxRow[];
  /** "4 payments", "1 transaction", "1 trade"; empty when there is nothing to open. */
  evidenceWords: string;
  /** The trades behind a trade finding, newest first. */
  trades?: Trade[];
}

export interface PairInput {
  x: CompareSide;
  y: CompareSide;
  /** QORT payments x → y and y → x (undefined while reading). */
  xy?: PairPayments;
  yx?: PairPayments;
  /** Who is minting now, for a reward share between them. */
  online?: readonly OnlineShare[];
}

export interface PairResult {
  findings: PairFinding[];
  /** Read and nothing found, in the page's order. */
  empty: PairCheck[];
  /** Not read yet (or a read failed). */
  pending: PairCheck[];
}

function bySignature(rows: readonly TxRow[]): TxRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => (seen.has(row.signature) ? false : (seen.add(row.signature), true)));
}

/** "Kit paid Lou 120 QORT in 4 payments (Mar–May 2025)". */
function paidParts(flow: Flow, payer: string, capped: boolean): TxPart[] {
  const when = whenWords(flow.first.timestamp, flow.last.timestamp);
  const count = capped
    ? `its newest ${plural(flow.count, 'payment')} to them (${when}; older ones not read)`
    : `${plural(flow.count, 'payment')} (${when})`;
  return [
    account(payer),
    text(' paid '),
    account(flow.address),
    text(' '),
    ...flowAmounts(flow),
    text(` in ${count}`),
  ];
}

function paymentFindings(input: PairInput): PairFinding[] {
  const { x, y, xy, yx } = input;
  const rows = [
    ...(xy?.rows ?? []),
    ...(yx?.rows ?? []),
    ...(x.assets?.rows ?? []),
    ...(y.assets?.rows ?? []),
  ];
  const out: PairFinding[] = [];
  for (const [payer, payee, page] of [
    [x.address, y.address, xy],
    [y.address, x.address, yx],
  ] as const) {
    const flow = flowsOf(rows, payer, 'sent').find((f) => f.address === payee);
    if (!flow) continue;
    out.push({
      key: `payment:${payer}>${payee}`,
      kind: 'payment',
      actor: payer,
      other: payee,
      parts: paidParts(flow, payer, Boolean(page?.capped)),
      height: flow.last.height,
      firstHeight: flow.first.height,
      timestamp: flow.last.timestamp,
      firstTimestamp: flow.first.timestamp,
      signature: flow.last.signature,
      count: flow.count,
      evidence: flow.txs,
      evidenceWords: plural(flow.count, 'payment'),
    });
  }
  return out;
}

function onlinePair(online: readonly OnlineShare[] | undefined, minter: string, recipient: string) {
  return Boolean(
    online?.some((s) => s.minterAddress === minter && s.recipientAddress === recipient)
  );
}

function linkFindings(input: PairInput): {
  shares: PairFinding[];
  levels: PairFinding[];
  names: PairFinding[];
} {
  const { x, y } = input;
  const rows = bySignature([...(x.links?.rows ?? []), ...(y.links?.rows ?? [])]);
  const shares: PairFinding[] = [];
  for (const [sponsor, other] of [
    [x.address, y.address],
    [y.address, x.address],
  ] as const) {
    const share = sponseesOf(rows, sponsor).find((s) => s.address === other);
    if (!share) continue;
    const now = share.active && onlinePair(input.online, sponsor, other);
    const tail =
      share.blocks !== null
        ? `, removed after ${plural(share.blocks, 'block')}`
        : share.active
          ? ', not removed'
          : '';
    shares.push({
      key: `share:${sponsor}>${other}`,
      kind: 'rewardShare',
      actor: sponsor,
      other,
      parts: [
        account(sponsor),
        text(' made a reward share to '),
        account(other),
        text(` at ${share.percent} %${tail}${now ? '; they are minting with it now' : ''}`),
      ],
      height: share.start.height,
      timestamp: share.start.timestamp,
      signature: share.start.signature,
      evidence: share.txs,
      evidenceWords: plural(share.txs.length, 'transaction'),
    });
  }

  const levels = new Map<string, PairFinding>();
  const names = new Map<string, PairFinding>();
  for (const [side, other] of [
    [x, y.address],
    [y, x.address],
  ] as const) {
    if (!side.links) continue;
    const parsed = linksOf(side.links.rows, side.address, side.links.privs);
    for (const move of parsed.levelMoves) {
      if (move.other !== other || levels.has(move.tx.signature)) continue;
      const [from, to] = move.direction === 'to' ? [side.address, other] : [other, side.address];
      levels.set(move.tx.signature, {
        key: `level:${move.tx.signature}`,
        kind: 'levelMove',
        actor: from,
        other: to,
        parts: [account(from), text(' moved its minting level to '), account(to)],
        height: move.ref.height,
        timestamp: move.ref.timestamp,
        signature: move.ref.signature,
        evidence: [move.tx],
        evidenceWords: '1 transaction',
      });
    }
    for (const deal of parsed.nameDeals) {
      if (deal.other !== other || names.has(deal.tx.signature)) continue;
      const [buyer, seller] =
        deal.kind === 'bought' ? [side.address, other] : [other, side.address];
      names.set(deal.tx.signature, {
        key: `name:${deal.tx.signature}`,
        kind: 'nameDeal',
        actor: buyer,
        other: seller,
        parts: [
          account(buyer),
          text(' bought the name '),
          { kind: 'name', name: deal.name },
          text(' from '),
          account(seller),
          text(' for '),
          qort(formatAmount(deal.amount)),
        ],
        height: deal.ref.height,
        timestamp: deal.ref.timestamp,
        signature: deal.ref.signature,
        evidence: [deal.tx],
        evidenceWords: '1 transaction',
      });
    }
  }
  const byHeight = (a: PairFinding, b: PairFinding) => (a.height ?? 0) - (b.height ?? 0);
  return {
    shares,
    levels: [...levels.values()].sort(byHeight),
    names: [...names.values()].sort(byHeight),
  };
}

interface RecordMade {
  name: string;
  at: number;
  nominee: string;
  vote?: 'yes' | 'no';
}

function recordFinding(
  kind: 'nomination' | 'support' | 'vote',
  publisher: string,
  nominee: string,
  records: readonly RecordMade[]
): PairFinding | null {
  const mine = records.filter((r) => r.nominee === nominee).sort((a, b) => b.at - a.at);
  if (!mine.length) return null;
  const newest = mine[0];
  const oldest = mine[mine.length - 1];
  const names = [...new Set(mine.map((r) => r.name))];
  const count = mine.length > 1 ? `, ${plural(mine.length, 'record')}` : '';
  const under: TxPart[] =
    names.length === 1
      ? [text(' (as '), { kind: 'name', name: names[0] }, text(`${count})`)]
      : [text(` (under ${formatCount(names.length)} of its names${count})`)];
  const what =
    kind === 'nomination'
      ? [text(' nominated '), account(nominee)]
      : kind === 'support'
        ? [text(' supported '), account(nominee), text('’s nomination')]
        : [
            text(` voted ${newest.vote === 'no' ? 'No' : 'Yes'} on `),
            account(nominee),
            text(mine.length > 1 ? '’s nomination (its newest vote)' : '’s nomination'),
          ];
  return {
    key: `record:${kind}:${publisher}>${nominee}`,
    kind: 'record',
    actor: publisher,
    other: nominee,
    parts: [account(publisher), ...what, ...under],
    timestamp: newest.at,
    firstTimestamp: oldest.at,
    count: mine.length > 1 ? mine.length : undefined,
    evidence: [],
    evidenceWords: '',
  };
}

function recordFindings(input: PairInput): PairFinding[] {
  const out: PairFinding[] = [];
  for (const [side, other] of [
    [input.x, input.y.address],
    [input.y, input.x.address],
  ] as const) {
    const made = side.made;
    if (!made) continue;
    for (const finding of [
      recordFinding('nomination', side.address, other, made.nominations),
      recordFinding('support', side.address, other, made.supports),
      recordFinding('vote', side.address, other, made.votes),
    ])
      if (finding) out.push(finding);
  }
  return out;
}

/** "12.5", exactly (added as whole atomic units). */
function sumQort(trades: readonly Trade[]): string {
  let total = 0n;
  for (const trade of trades) total += parseAtomic(trade.qortAmount) ?? 0n;
  return formatAtomic(total);
}

function tradeFindings(input: PairInput): PairFinding[] {
  const out: PairFinding[] = [];
  for (const [seller, buyer] of [
    [input.x, input.y],
    [input.y, input.x],
  ] as const) {
    const sold = (seller.trades?.rows ?? []).filter(
      (t) => t.seller === seller.address && t.buyer === buyer.address
    );
    if (!sold.length) continue;
    const newest = sold[0];
    const oldest = sold[sold.length - 1];
    const when = whenWords(oldest.timestamp, newest.timestamp);
    const capped = seller.trades?.capped
      ? `, in its newest ${formatCount(seller.trades.rows.length)} sales`
      : '';
    out.push({
      key: `trade:${seller.address}>${buyer.address}`,
      kind: 'trade',
      actor: seller.address,
      other: buyer.address,
      parts: [
        account(seller.address),
        text(' sold '),
        qort(sumQort(sold)),
        text(' to '),
        account(buyer.address),
        text(` on the trade portal in ${plural(sold.length, 'trade')} (${when}${capped})`),
      ],
      timestamp: newest.timestamp,
      firstTimestamp: oldest.timestamp,
      count: sold.length > 1 ? sold.length : undefined,
      evidence: [],
      evidenceWords: plural(sold.length, 'trade'),
      trades: sold,
    });
  }
  return out;
}

/** What was recorded between two accounts, and what was checked and found nothing. */
export function pairFindings(input: PairInput): PairResult {
  const { x, y } = input;
  const payments = paymentFindings(input);
  const { shares, levels, names } = linkFindings(input);
  const records = recordFindings(input);
  const trades = tradeFindings(input);
  const found: Record<PairCheck, PairFinding[]> = {
    payments,
    rewardShares: shares,
    levelMoves: levels,
    nameSales: names,
    records,
    trades,
  };
  const linksRead = Boolean(x.links && y.links);
  const read: Record<PairCheck, boolean> = {
    payments: Boolean(input.xy && input.yx && x.assets && y.assets),
    rewardShares: linksRead,
    levelMoves: linksRead,
    nameSales: linksRead,
    records: Boolean(x.made && y.made),
    trades: x.trades !== undefined && y.trades !== undefined,
  };
  const empty: PairCheck[] = [];
  const pending: PairCheck[] = [];
  for (const check of PAIR_CHECKS) {
    if (found[check].length) continue;
    (read[check] ? empty : pending).push(check);
  }
  return {
    findings: [...payments, ...shares, ...levels, ...names, ...records, ...trades],
    empty,
    pending,
  };
}

/** "Checked, none found: level moves, name sales." (null when nothing is empty). */
export function checkedNoneLine(empty: readonly PairCheck[]): string | null {
  if (!empty.length) return null;
  return `Checked, none found: ${empty.map((check) => PAIR_CHECK_WORDS[check]).join(', ')}.`;
}

/** The pair grid's words: "2 recorded, 1 in common", "none found", or "checking…". */
export function pairSummary(recorded: number, inCommon: number, settled: boolean): string {
  const parts = [
    recorded ? `${formatCount(recorded)} recorded` : null,
    inCommon ? `${formatCount(inCommon)} in common` : null,
  ].filter((part): part is string => part !== null);
  if (parts.length) return settled ? parts.join(', ') : `${parts.join(', ')} so far`;
  return settled ? 'none found' : 'checking…';
}

// ---- in common -------------------------------------------------------------------------

/** "Both" (all of 2), "All 3" (all of 3 or 4), else the letters: "A and C". */
export function whoWords(letters: readonly Letter[], total: number): string {
  if (letters.length === total) return total === 2 ? 'Both' : `All ${total}`;
  return listWords(letters);
}

export interface SameSponsor {
  sponsor: string;
  /** The compared accounts it sponsored, by letter. */
  letters: Letter[];
  /** How many accounts it sponsored (null until its own reward shares are read). */
  sponsees: number | null;
  /** Its reward shares were more than the 500 read: there may be more. */
  capped: boolean;
}

/** Each compared account's sponsor (the first account that made a reward share to it). */
export function sponsorOf(side: CompareSide): string | null {
  if (!side.links) return null;
  return linksOf(side.links.rows, side.address, side.links.privs).sponsors[0]?.sponsor ?? null;
}

/** Sponsors two or more of the compared accounts share. */
export function sameSponsors(
  sides: readonly CompareSide[],
  sponsorLinks: Readonly<Record<string, AccountLinks | undefined>> = {}
): SameSponsor[] {
  const bySponsor = new Map<string, Letter[]>();
  for (const side of sides) {
    const sponsor = sponsorOf(side);
    if (!sponsor) continue;
    bySponsor.set(sponsor, [...(bySponsor.get(sponsor) ?? []), side.letter]);
  }
  return [...bySponsor]
    .filter(([, letters]) => letters.length >= 2)
    .map(([sponsor, letters]) => {
      const links = sponsorLinks[sponsor];
      return {
        sponsor,
        letters,
        sponsees: links ? sponseesOf(links.rows, sponsor).length : null,
        capped: Boolean(links?.truncated),
      };
    });
}

/** "Both sponsored by S, who sponsored 48 accounts." */
export function sameSponsorParts(same: SameSponsor, total: number): TxPart[] {
  const count =
    same.sponsees === null
      ? ''
      : `, who sponsored ${formatCount(same.sponsees)}${same.capped ? '+' : ''} ${
          same.sponsees === 1 && !same.capped ? 'account' : 'accounts'
        }`;
  return [
    text(`${whoWords(same.letters, total)} sponsored by `),
    account(same.sponsor),
    text(count),
  ];
}

export interface SameFirstPayer {
  from: string;
  accounts: Array<{ letter: Letter; address: string; height: number; signature: string }>;
}

/** The accounts whose first QORT payment came from the same account (payments only). */
export function sameFirstPayers(sides: readonly CompareSide[]): SameFirstPayer[] {
  const byPayer = new Map<string, SameFirstPayer['accounts']>();
  for (const side of sides) {
    const funding = side.first?.funding;
    if (!funding?.from || (funding.kind !== 'payment' && funding.kind !== 'multiPayment')) continue;
    byPayer.set(funding.from, [
      ...(byPayer.get(funding.from) ?? []),
      {
        letter: side.letter,
        address: side.address,
        height: funding.height,
        signature: funding.signature,
      },
    ]);
  }
  return [...byPayer]
    .filter(([, accounts]) => accounts.length >= 2)
    .map(([from, accounts]) => ({ from, accounts }));
}

/** "has sent 1,000+ payments", or null under 100. */
function bandWords(band: PayerBand | undefined): string | null {
  return band ? `has sent ${formatCount(band)}+ payments` : null;
}

/**
 * "Both got their first QORT payment from H (blocks 1,364,165 and
 * 1,364,170). H has sent 500+ payments."
 */
export function sameFirstPayerParts(
  same: SameFirstPayer,
  total: number,
  band?: PayerBand
): TxPart[] {
  const letters = same.accounts.map((a) => a.letter);
  const heights = listWords(same.accounts.map((a) => formatCount(a.height)));
  const busy = bandWords(band);
  return [
    text(`${whoWords(letters, total)} got their first QORT payment from `),
    account(same.from),
    text(` (blocks ${heights})`),
    ...(busy ? [text('. '), account(same.from), text(` ${busy}.`)] : []),
  ];
}

export type CounterpartyRelation =
  /** One paid the counterparty, which paid another: A → K → B. */
  | { kind: 'through'; from: Letter; to: Letter }
  | { kind: 'bothPaid'; letters: Letter[] }
  | { kind: 'paidBoth'; letters: Letter[] };

export interface CounterpartyCount {
  letter: Letter;
  address: string;
  /** Payments it sent to the counterparty. */
  sent: number;
  /** Payments the counterparty sent to it. */
  received: number;
}

export interface SharedCounterparty {
  address: string;
  /** The compared accounts that paid it or were paid by it. */
  counts: CounterpartyCount[];
  relation: CounterpartyRelation;
  /** Ranked by the second-highest count (the smaller of the two for a pair). */
  rank: number;
}

export interface SharedCounterparties {
  rows: SharedCounterparty[];
  /** Shared AT addresses (automated contracts), left out. */
  atLeftOut: number;
  /** Shared accounts that have sent 1,000+ payments, left out. */
  busyLeftOut: number;
}

/** Each compared account's flows by counterparty, from its payment pages and asset transfers. */
function flowsBySide(side: CompareSide): { sent: Flow[]; received: Flow[] } | null {
  if (!side.sent || !side.recv) return null;
  const assets = side.assets?.rows ?? [];
  return {
    sent: flowsOf([...side.sent.rows, ...assets], side.address, 'sent'),
    received: flowsOf([...side.recv.rows, ...assets], side.address, 'received'),
  };
}

function relationOf(counts: readonly CounterpartyCount[]): CounterpartyRelation {
  const payers = counts.filter((c) => c.sent > 0);
  const payees = counts.filter((c) => c.received > 0);
  let best: { from: CounterpartyCount; to: CounterpartyCount; size: number } | null = null;
  for (const from of payers)
    for (const to of payees) {
      if (from.address === to.address) continue;
      const size = Math.min(from.sent, to.received);
      if (!best || size > best.size) best = { from, to, size };
    }
  if (best) return { kind: 'through', from: best.from.letter, to: best.to.letter };
  if (payers.length >= 2) return { kind: 'bothPaid', letters: payers.map((c) => c.letter) };
  return { kind: 'paidBoth', letters: payees.map((c) => c.letter) };
}

/**
 * Accounts that two or more of the compared accounts paid or were paid by,
 * in the payments read: the compared accounts themselves are left out, and
 * so are AT addresses and accounts that have sent 1,000+ payments (counted).
 * Most shared first.
 */
export function sharedCounterparties(
  sides: readonly CompareSide[],
  bands: Readonly<Record<string, PayerBand | undefined>> = {}
): SharedCounterparties {
  const compared = new Set(sides.map((side) => side.address));
  const byOther = new Map<string, Map<string, CounterpartyCount>>();
  const ats = new Set<string>();
  const atLinks = new Map<string, Set<string>>();
  for (const side of sides) {
    const flows = flowsBySide(side);
    if (!flows) continue;
    const add = (flow: Flow, key: 'sent' | 'received') => {
      if (compared.has(flow.address)) return;
      if (flow.isAt) {
        atLinks.set(flow.address, new Set([...(atLinks.get(flow.address) ?? []), side.address]));
        return;
      }
      const per = byOther.get(flow.address) ?? new Map<string, CounterpartyCount>();
      const count = per.get(side.address) ?? {
        letter: side.letter,
        address: side.address,
        sent: 0,
        received: 0,
      };
      count[key] += flow.count;
      per.set(side.address, count);
      byOther.set(flow.address, per);
    };
    flows.sent.forEach((flow) => add(flow, 'sent'));
    flows.received.forEach((flow) => add(flow, 'received'));
  }
  for (const [at, linked] of atLinks) if (linked.size >= 2) ats.add(at);
  const rows: SharedCounterparty[] = [];
  let busyLeftOut = 0;
  for (const [other, per] of byOther) {
    if (per.size < 2) continue;
    if (bands[other] === 1000) {
      busyLeftOut += 1;
      continue;
    }
    const counts = [...per.values()].sort((a, b) => a.letter.localeCompare(b.letter));
    const totals = counts.map((c) => c.sent + c.received).sort((a, b) => b - a);
    rows.push({ address: other, counts, relation: relationOf(counts), rank: totals[1] ?? 0 });
  }
  const total = (row: SharedCounterparty) =>
    row.counts.reduce((sum, c) => sum + c.sent + c.received, 0);
  rows.sort((a, b) => b.rank - a.rank || total(b) - total(a) || a.address.localeCompare(b.address));
  return { rows, atLeftOut: ats.size, busyLeftOut };
}

/** "A → K → B", "Both paid K", "K paid A and C". */
export function counterpartyParts(row: SharedCounterparty, total: number): TxPart[] {
  const { relation } = row;
  const k = account(row.address);
  switch (relation.kind) {
    case 'through':
      return [text(`${relation.from} → `), k, text(` → ${relation.to}`)];
    case 'bothPaid':
      return [text(`${whoWords(relation.letters, total)} paid `), k];
    case 'paidBoth':
      return relation.letters.length === total && total === 2
        ? [k, text(' paid both')]
        : [
            k,
            text(
              ` paid ${relation.letters.length === total ? `all ${total}` : listWords(relation.letters)}`
            ),
          ];
  }
}

/** "A sent 3 payments · B received 2 payments" (to and from the counterparty). */
export function counterpartyCounts(row: SharedCounterparty): string {
  return row.counts
    .map((c) => {
      const parts = [
        c.sent ? `sent ${plural(c.sent, 'payment')}` : null,
        c.received ? `received ${plural(c.received, 'payment')}` : null,
      ].filter((part): part is string => part !== null);
      return `${c.letter} ${parts.join(' and ')}`;
    })
    .join(' · ');
}

/** "Left out: 2 AT addresses (automated contracts), 1 account that has sent 1,000+ payments." */
export function leftOutLine(
  shared: Pick<SharedCounterparties, 'atLeftOut' | 'busyLeftOut'>
): string | null {
  const parts = [
    shared.atLeftOut
      ? `${plural(shared.atLeftOut, 'AT address', 'AT addresses')} (automated contracts)`
      : null,
    shared.busyLeftOut
      ? `${formatCount(shared.busyLeftOut)} ${
          shared.busyLeftOut === 1 ? 'account that has' : 'accounts that have'
        } sent 1,000+ payments`
      : null,
  ].filter((part): part is string => part !== null);
  return parts.length ? `Left out: ${parts.join(', ')}.` : null;
}

export interface SharedGroup {
  groupId: number;
  groupName: string;
  memberCount?: number;
  isOpen?: boolean;
  letters: Letter[];
}

/** Groups two or more of the accounts are in, smallest first (MINTER left out: shown above). */
export function sharedGroups(sides: readonly CompareSide[]): SharedGroup[] {
  const byGroup = new Map<number, SharedGroup>();
  for (const side of sides) {
    for (const group of side.groups ?? []) {
      if (group.groupId === MINTER_GROUP_ID) continue;
      const entry = byGroup.get(group.groupId) ?? {
        groupId: group.groupId,
        groupName: group.groupName,
        letters: [],
      };
      if (entry.memberCount === undefined && group.memberCount !== undefined)
        entry.memberCount = group.memberCount;
      if (entry.isOpen === undefined && group.isOpen !== undefined) entry.isOpen = group.isOpen;
      if (!entry.letters.includes(side.letter)) entry.letters.push(side.letter);
      byGroup.set(group.groupId, entry);
    }
  }
  const size = (g: SharedGroup) => g.memberCount ?? Number.POSITIVE_INFINITY;
  return [...byGroup.values()]
    .filter((g) => g.letters.length >= 2)
    .map((g) => ({ ...g, letters: [...g.letters].sort() }))
    .sort((a, b) => size(a) - size(b) || a.groupName.localeCompare(b.groupName));
}

/** "Book Club (12 members)". */
export function groupWords(group: Pick<SharedGroup, 'groupName' | 'memberCount'>): string {
  const name = group.groupName || 'A group without a name';
  return group.memberCount === undefined
    ? name
    : `${name} (${plural(group.memberCount, 'member')})`;
}

/** "Both in 3 groups", "All 3 in 1 group", or "2 groups with two or more of them". */
export function groupsLead(groups: readonly SharedGroup[], total: number): string {
  if (groups.every((g) => g.letters.length === total))
    return `${whoWords(LETTERS.slice(0, total), total)} in ${plural(groups.length, 'group')}`;
  return `${plural(groups.length, 'group')} with two or more of them`;
}

// ---- timing --------------------------------------------------------------------------------

export interface TimingValue {
  letter: Letter;
  /** A block height, or a time (ms). */
  value: number;
}

/** "12 blocks", "the same block", "2 days", "the same time". */
function spanWords(span: number, unit: 'blocks' | 'time'): string {
  if (unit === 'blocks') return span === 0 ? 'in the same block' : `${plural(span, 'block')} apart`;
  return span < 60_000 ? 'within a minute' : `${formatRoughDuration(span)} apart`;
}

/**
 * "First seen 12 blocks apart"; for 3 or 4, or when not all have it:
 * "First seen 1,200 blocks apart, first to last: A, C, B". Null for fewer
 * than two values.
 */
export function timingText(
  label: string,
  values: readonly TimingValue[],
  unit: 'blocks' | 'time',
  total: number
): string | null {
  if (values.length < 2) return null;
  const sorted = [...values].sort((a, b) => a.value - b.value || a.letter.localeCompare(b.letter));
  const span = sorted[sorted.length - 1].value - sorted[0].value;
  const words = `${label} ${spanWords(span, unit)}`;
  if (values.length === 2 && total === 2) return words;
  return `${words}, first to last: ${sorted.map((v) => v.letter).join(', ')}`;
}

/** The block of an account's first self-share (a reward share to itself), if its links have one. */
export function firstSelfShare(side: Pick<CompareSide, 'address' | 'links'>): TxRow | null {
  const rows = (side.links?.rows ?? [])
    .filter(
      (row) =>
        row.type === 'REWARD_SHARE' &&
        row.creatorAddress === side.address &&
        row.recipient === side.address &&
        !isRemoval(row) &&
        typeof row.blockHeight === 'number'
    )
    .sort((a, b) => (a.blockHeight ?? 0) - (b.blockHeight ?? 0));
  return rows[0] ?? null;
}

export interface TimingRow {
  key: 'firstSeen' | 'selfShare' | 'joined';
  text: string;
}

/** Raw differences between the accounts' firsts. `joined`: when each joined MINTER (ms). */
export function timingRows(
  sides: readonly CompareSide[],
  joined: Readonly<Record<string, number | undefined>> = {}
): TimingRow[] {
  const total = sides.length;
  const rows: TimingRow[] = [];
  const firstSeen = sides
    .map((s) => ({ letter: s.letter, value: s.first?.firstSeen?.height }))
    .filter((v): v is TimingValue => typeof v.value === 'number');
  const seen = timingText('First seen', firstSeen, 'blocks', total);
  if (seen) rows.push({ key: 'firstSeen', text: seen });
  const shares = sides
    .map((s) => ({ letter: s.letter, value: firstSelfShare(s)?.blockHeight }))
    .filter((v): v is TimingValue => typeof v.value === 'number');
  const share = timingText('Self-shares created', shares, 'blocks', total);
  if (share) rows.push({ key: 'selfShare', text: share });
  const joins = sides
    .map((s) => ({ letter: s.letter, value: joined[s.address] }))
    .filter((v): v is TimingValue => typeof v.value === 'number' && v.value > 0);
  const join = timingText('Joined MINTER', joins, 'time', total);
  if (join) rows.push({ key: 'joined', text: join });
  return rows;
}

// ---- the timeline ----------------------------------------------------------------------------

export type TimelineKind =
  | 'funding'
  | 'firstOwn'
  | 'primaryName'
  | 'selfShare'
  | 'levelMove'
  | 'asked'
  | 'joined'
  | 'nominated';

export interface TimelineEvent {
  key: string;
  kind: TimelineKind;
  address: string;
  letter: Letter;
  /** Its block, when it is a transaction. */
  height: number | null;
  timestamp: number;
  /** What happened (the account itself is the letter before it). */
  parts: TxPart[];
  /** The transaction behind it, when there is one. */
  signature?: string;
}

export interface TimelineSide {
  address: string;
  letter: Letter;
  first?: FirstSeen;
  links?: AccountLinks;
  /** Its primary name and when it was registered. */
  primary?: { name: string; registered?: number } | null;
  /** When it last asked to join MINTER. */
  askedAt?: number | null;
  /** When it joined MINTER (members only). */
  joinedAt?: number | null;
  /** Who nominated it, and when (one per nomination). */
  nominatedBy?: ReadonlyArray<{ by: string; at: number }>;
}

function fundingEventParts(funding: NonNullable<FirstSeen['funding']>): TxPart[] {
  const from = funding.from;
  switch (funding.kind) {
    case 'payment':
    case 'multiPayment':
      return from
        ? [
            text('first QORT payment from '),
            account(from),
            text(' ('),
            qort(formatAmount(funding.amount ?? '0')),
            text(')'),
          ]
        : [text('first QORT payment')];
    case 'transferAsset':
      return from
        ? [text('first incoming transaction: an asset transfer from '), account(from)]
        : [text('first incoming transaction: an asset transfer')];
    case 'rewardShare':
      return from
        ? [
            text(
              `first incoming transaction: a ${formatAmount(funding.sharePercent ?? '0')} % reward share from `
            ),
            account(from),
          ]
        : [text('first incoming transaction: a reward share')];
    case 'transferPrivs':
      return from
        ? [text('got its minting level from '), account(from)]
        : [text('got its minting level from another account')];
    case 'at':
      return [text('first QORT from an AT (automated contract)')];
    case 'genesis':
      return [text('received QORT in the genesis block')];
  }
}

/** Every first the accounts' reads show, oldest first. */
export function timelineEvents(sides: readonly TimelineSide[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const side of sides) {
    const base = { address: side.address, letter: side.letter };
    const funding = side.first?.funding ?? null;
    const signatures = new Set<string>();
    if (funding) {
      signatures.add(funding.signature);
      events.push({
        ...base,
        key: `${side.address}:funding`,
        kind: 'funding',
        height: funding.height,
        timestamp: funding.timestamp,
        parts: fundingEventParts(funding),
        signature: funding.signature,
      });
    }
    const own = side.first?.firstOwn ?? null;
    if (own && !signatures.has(own.signature)) {
      signatures.add(own.signature);
      events.push({
        ...base,
        key: `${side.address}:firstOwn`,
        kind: 'firstOwn',
        height: own.height,
        timestamp: own.timestamp,
        parts: [text(`first transaction it sent: ${txTypeLabel(own.type)}`)],
        signature: own.signature,
      });
    }
    if (side.primary?.registered) {
      events.push({
        ...base,
        key: `${side.address}:primaryName`,
        kind: 'primaryName',
        height: null,
        timestamp: side.primary.registered,
        parts: [
          text('registered the name '),
          { kind: 'name', name: side.primary.name },
          text(' (its primary name now)'),
        ],
      });
    }
    const self = firstSelfShare(side);
    if (self) {
      events.push({
        ...base,
        key: `${side.address}:selfShare`,
        kind: 'selfShare',
        height: self.blockHeight ?? null,
        timestamp: self.timestamp,
        parts: [text('created a self-share (minting with its own key)')],
        signature: self.signature,
      });
    }
    if (side.links) {
      for (const move of linksOf(side.links.rows, side.address, side.links.privs).levelMoves) {
        if (signatures.has(move.tx.signature)) continue;
        signatures.add(move.tx.signature);
        events.push({
          ...base,
          key: `${side.address}:level:${move.tx.signature}`,
          kind: 'levelMove',
          height: move.ref.height,
          timestamp: move.ref.timestamp,
          parts:
            move.direction === 'to'
              ? move.other
                ? [text('moved its minting level to '), account(move.other)]
                : [text('moved its minting level to another account')]
              : [text('got its minting level from '), account(move.other as string)],
          signature: move.ref.signature,
        });
      }
    }
    if (side.askedAt)
      events.push({
        ...base,
        key: `${side.address}:asked`,
        kind: 'asked',
        height: null,
        timestamp: side.askedAt,
        parts: [text('asked to join MINTER (its newest request)')],
      });
    if (side.joinedAt)
      events.push({
        ...base,
        key: `${side.address}:joined`,
        kind: 'joined',
        height: null,
        timestamp: side.joinedAt,
        parts: [text('joined MINTER')],
      });
    for (const nomination of side.nominatedBy ?? [])
      events.push({
        ...base,
        key: `${side.address}:nominated:${nomination.by}:${nomination.at}`,
        kind: 'nominated',
        height: null,
        timestamp: nomination.at,
        parts: [text('nominated by '), account(nomination.by)],
      });
  }
  return events.sort(
    (a, b) =>
      a.timestamp - b.timestamp ||
      (a.height ?? 0) - (b.height ?? 0) ||
      a.letter.localeCompare(b.letter)
  );
}

/** "5 blocks later", "Same block", "2 days later", between two lines. */
export function gapWords(previous: TimelineEvent, next: TimelineEvent): string {
  if (previous.height !== null && next.height !== null) {
    const blocks = next.height - previous.height;
    return blocks === 0 ? 'Same block' : `${plural(blocks, 'block')} later`;
  }
  const ms = next.timestamp - previous.timestamp;
  return ms < 60_000 ? 'Moments later' : `${formatRoughDuration(ms)} later`;
}

/** "Block 1,364,165", or the date for what has no block. */
export function eventWhen(event: Pick<TimelineEvent, 'height' | 'timestamp'>): string {
  return event.height !== null ? `Block ${formatCount(event.height)}` : formatDate(event.timestamp);
}

/** "Block 1,364,165 · A: first QORT payment from Hal Helper (5.4321 QORT)". */
export function timelineLine(
  event: TimelineEvent,
  nameOf?: (address: string) => string | null | undefined
): string {
  return `${eventWhen(event)} · ${event.letter}: ${partsText(event.parts, nameOf)}`;
}

// ---- copy findings -----------------------------------------------------------------------------

export interface CompareLine {
  parts: TxPart[];
  height?: number;
  firstHeight?: number;
  timestamp?: number;
  firstTimestamp?: number;
  signature?: string;
  count?: number;
}

export interface CompareTextInput {
  accounts: ReadonlyArray<{ letter: Letter; address: string; name: string | null }>;
  /** The chain's height when it was checked, if known. */
  checkedAt: number | null;
  neutralLine: string;
  /** How much was read. */
  coverage: readonly string[];
  /** Pairs with findings, each with its own checked-and-empty line. */
  pairs: ReadonlyArray<{ label: string; lines: readonly CompareLine[]; noneFound: string | null }>;
  /** "A–C, B–C: checked, none found: …", or null. */
  emptyPairs: string | null;
  common: readonly CompareLine[];
  /** Plain lines (shared counterparties' counts, timing rows, left out). */
  commonNotes: readonly string[];
  timeline: readonly string[];
  /** Side by side, one line per fact. */
  side?: readonly string[];
  link: string;
  nameOf?: (address: string) => string | null | undefined;
}

/** " (blocks 1,364,500–2,100,000, 4 transactions, newest 4Kw5V2Zm…)", " (12 Mar 2025)". */
export function whereWords(line: CompareLine): string {
  const sig = line.signature ? `${line.signature.slice(0, 8)}…` : null;
  if (line.height === undefined) {
    if (line.timestamp === undefined) return '';
    const when =
      line.firstTimestamp !== undefined && line.firstTimestamp !== line.timestamp
        ? monthRange(line.firstTimestamp, line.timestamp)
        : formatDate(line.timestamp);
    return ` (${when})`;
  }
  if (line.firstHeight !== undefined && line.firstHeight !== line.height) {
    const count = line.count ? `, ${plural(line.count, 'transaction')}` : '';
    return ` (blocks ${formatCount(line.firstHeight)}–${formatCount(line.height)}${count}${
      sig ? `, newest ${sig}` : ''
    })`;
  }
  return ` (block ${formatCount(line.height)}${sig ? `, ${sig}` : ''})`;
}

function bullet(line: CompareLine, nameOf: CompareTextInput['nameOf']): string {
  return `- ${partsText(line.parts, nameOf).replace(/\.$/, '')}${whereWords(line)}`;
}

/** Compare's findings as plain text, to paste into a chat or a note. */
export function compareText(input: CompareTextInput): string {
  const { nameOf } = input;
  const out: string[] = [
    `Compare accounts${
      input.checkedAt !== null ? `, checked at block ${formatCount(input.checkedAt)}` : ''
    }`,
    input.neutralLine,
    '',
    ...input.accounts.map((a) => `${a.letter}: ${a.name ? `${a.name} (${a.address})` : a.address}`),
  ];
  if (input.coverage.length) {
    out.push('', 'What was read:');
    for (const line of input.coverage) out.push(`- ${line}`);
  }
  if (input.pairs.length || input.emptyPairs) {
    out.push('', 'Recorded between them:');
    for (const pair of input.pairs) {
      out.push(`${pair.label}:`);
      for (const line of pair.lines) out.push(bullet(line, nameOf));
      if (pair.noneFound) out.push(`  ${pair.noneFound}`);
    }
    if (input.emptyPairs) out.push(input.emptyPairs);
  }
  if (input.common.length || input.commonNotes.length) {
    out.push('', 'In common:');
    for (const line of input.common) out.push(bullet(line, nameOf));
    for (const note of input.commonNotes) out.push(`- ${note}`);
  }
  if (input.timeline.length) {
    out.push('', 'Timeline together:');
    for (const line of input.timeline) out.push(`- ${line}`);
  }
  if (input.side?.length) {
    out.push('', 'Side by side:');
    for (const line of input.side) out.push(`- ${line}`);
  }
  out.push('', input.link);
  return out.join('\n');
}
