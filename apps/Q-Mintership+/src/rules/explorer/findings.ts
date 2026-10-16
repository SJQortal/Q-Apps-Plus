/**
 * The Connections tab's findings, in the order the page lists them, and
 * "Copy findings": the same as plain text to paste into a chat or a note.
 *
 * "Recorded between them": level moves, sponsors, minting with another
 * account now, the accounts it sponsored, names bought or sold, then
 * payments by the other account (most first, both ways). Overview's
 * Direct links shows the first three.
 *
 * The text says which account and at which block it was checked, how much
 * was read, every finding with its block and short signature, what was
 * checked and found nothing, the fixed neutral line, and the link that
 * opens the same tab. Facts only: the words are the page's own sentences,
 * so no verdict is added here.
 *
 * Pure: names come from `nameOf` (the names already loaded).
 */
import type { TxRow } from '../../data/types';
import { formatCount, plural, shortAddress } from '../../utils/format';
import {
  levelMoveParts,
  mintingWithParts,
  nameDealParts,
  sponseesSummary,
  sponsorParts,
  type ActiveShare,
  type Links,
} from './connections';
import { flowParts, type Flow } from './money';
import { visibleName } from './nameNotes';
import { groupWords, type TxPart } from './txWords';

export interface FindingLine {
  parts: TxPart[];
  /** The block it happened in (the newest one, for several transactions). */
  height?: number;
  /** The oldest block, for several transactions. */
  firstHeight?: number;
  /** Its transaction (the newest one, for several). */
  signature?: string;
  /** How many transactions stand behind it, when more than one. */
  count?: number;
}

export interface FindingsInput {
  address: string;
  name: string | null;
  /** The chain's height when it was checked, if known. */
  checkedAt: number | null;
  /** The fixed line about what links mean. */
  neutralLine: string;
  /** How much was read ("In its latest 100 QORT payments each way."). */
  coverage: string[];
  recorded: FindingLine[];
  common: FindingLine[];
  /** "Also checked, nothing found: …", or null. */
  noneFound: string | null;
  /** The `qortal://` link to the tab. */
  link: string;
  /** A loaded name for an account, if any. */
  nameOf?: (address: string) => string | null | undefined;
}

/** "Bob (QaBcDe…WxYz)", or the short address when it has no name loaded. */
function who(address: string, nameOf?: FindingsInput['nameOf']): string {
  const name = nameOf?.(address);
  return name ? `${visibleName(name)} (${shortAddress(address)})` : shortAddress(address);
}

/** A sentence's parts as one line, accounts with their names when known. */
export function partsText(parts: readonly TxPart[], nameOf?: FindingsInput['nameOf']): string {
  return parts
    .map((part) => {
      switch (part.kind) {
        case 'text':
          return part.text;
        case 'account':
          return who(part.address, nameOf);
        case 'amount':
          return `${part.amount} ${part.asset}`;
        case 'name':
          return `“${visibleName(part.name)}”`;
        case 'group':
          return groupWords(part.groupId);
        case 'tx':
          return `transaction ${part.signature.slice(0, 8)}…`;
      }
    })
    .join('');
}

/** " (block 1,371,641, 4Kw5V2Zm…)" or " (blocks 1,364,500–2,100,000, 6 transactions, newest 4Kw5V2Zm…)". */
function where(line: FindingLine): string {
  const sig = line.signature ? `${line.signature.slice(0, 8)}…` : null;
  if (line.height === undefined) return '';
  if (line.firstHeight !== undefined && line.firstHeight !== line.height) {
    const count = line.count ? `, ${formatCount(line.count)} transactions` : '';
    return ` (blocks ${formatCount(line.firstHeight)}–${formatCount(line.height)}${count}${sig ? `, newest ${sig}` : ''})`;
  }
  return ` (block ${formatCount(line.height)}${sig ? `, ${sig}` : ''})`;
}

function bullet(line: FindingLine, nameOf?: FindingsInput['nameOf']): string {
  const sentence = partsText(line.parts, nameOf).replace(/\.$/, '');
  return `- ${sentence}${where(line)}`;
}

export function findingsText(input: FindingsInput): string {
  const { nameOf } = input;
  const name = input.name ? `${visibleName(input.name)} (${input.address})` : input.address;
  const out: string[] = [
    `Explorer findings for ${name}${
      input.checkedAt !== null ? `, checked at block ${formatCount(input.checkedAt)}` : ''
    }`,
    input.neutralLine,
  ];
  if (input.coverage.length) {
    out.push('', 'What was read:');
    for (const line of input.coverage) out.push(`- ${line}`);
  }
  if (input.recorded.length) {
    out.push('', 'Recorded between them:');
    for (const line of input.recorded) out.push(bullet(line, nameOf));
  }
  if (input.common.length) {
    out.push('', 'In common:');
    for (const line of input.common) out.push(bullet(line, nameOf));
  }
  if (!input.recorded.length && !input.common.length)
    out.push('', 'No links found in the data checked.');
  if (input.noneFound) out.push('', input.noneFound);
  out.push('', input.link);
  return out.join('\n');
}

// ---- the findings list ----------------------------------------------------------

export type FindingKind =
  'levelMove' | 'sponsor' | 'mintingWith' | 'sponsees' | 'nameDeal' | 'paidTo' | 'paidBy';

export interface Finding extends FindingLine {
  /** Stable across loads, for React keys. */
  key: string;
  kind: FindingKind;
  /** The other account; null for the accounts it sponsored (a set). */
  other: string | null;
  height: number;
  timestamp: number;
  /** The oldest transaction's time, for several. */
  firstTimestamp?: number;
  signature: string;
  /** The transactions behind it, newest first (none for the set of sponsees). */
  evidence: TxRow[];
  /** "4 payments", "2 transactions". */
  evidenceWords: string;
}

export interface RecordedInput {
  links?: Links | null;
  /** Its active shares that mint now (null while the online list loads). */
  mintingWith?: readonly ActiveShare[] | null;
  /** Payments and transfers by the other account, each way. */
  sent?: readonly Flow[] | null;
  received?: readonly Flow[] | null;
  /** Each account's level now, where loaded (for "P is now level 0."). */
  levels?: Readonly<Record<string, number | undefined>>;
}

const one = (tx: TxRow) => ({
  height: tx.blockHeight ?? 0,
  timestamp: tx.timestamp,
  signature: tx.signature,
});

/** What was recorded between this account and others, in the page's order. */
export function recordedFindings(input: RecordedInput): Finding[] {
  const out: Finding[] = [];
  const links = input.links;
  if (links) {
    for (const move of links.levelMoves)
      out.push({
        key: `level:${move.ref.signature}`,
        kind: 'levelMove',
        other: move.other,
        parts: levelMoveParts(move, move.other ? input.levels?.[move.other] : undefined),
        ...one(move.tx),
        evidence: [move.tx],
        evidenceWords: '1 transaction',
      });
    for (const sponsorship of links.sponsors)
      out.push({
        key: `sponsor:${sponsorship.sponsor}`,
        kind: 'sponsor',
        other: sponsorship.sponsor,
        parts: sponsorParts(sponsorship),
        height: sponsorship.start.height,
        timestamp: sponsorship.start.timestamp,
        signature: sponsorship.start.signature,
        evidence: sponsorship.txs,
        evidenceWords: plural(sponsorship.txs.length, 'transaction'),
      });
  }
  for (const share of input.mintingWith ?? [])
    out.push({
      key: `minting:${share.other}`,
      kind: 'mintingWith',
      other: share.other,
      parts: mintingWithParts(share),
      ...one(share.tx),
      evidence: [share.tx],
      evidenceWords: '1 transaction',
    });
  if (links?.sponsees.length) {
    const first = links.sponsees[0];
    const last = links.sponsees[links.sponsees.length - 1];
    out.push({
      key: 'sponsees',
      kind: 'sponsees',
      other: null,
      parts: [{ kind: 'text', text: sponseesSummary(links.sponsees) }],
      height: last.start.height,
      firstHeight: first.start.height,
      timestamp: last.start.timestamp,
      firstTimestamp: first.start.timestamp,
      signature: last.start.signature,
      count: links.sponsees.length,
      evidence: [],
      evidenceWords: '',
    });
  }
  for (const deal of links?.nameDeals ?? [])
    out.push({
      key: `name:${deal.ref.signature}`,
      kind: 'nameDeal',
      other: deal.other,
      parts: nameDealParts(deal),
      ...one(deal.tx),
      evidence: [deal.tx],
      evidenceWords: '1 transaction',
    });
  const flows = [
    ...(input.sent ?? []).map((flow) => ({ flow, kind: 'paidTo' as const })),
    ...(input.received ?? []).map((flow) => ({ flow, kind: 'paidBy' as const })),
  ]
    .filter(({ flow }) => !flow.isAt)
    .sort(
      (a, b) =>
        b.flow.count - a.flow.count ||
        b.flow.last.height - a.flow.last.height ||
        a.flow.address.localeCompare(b.flow.address)
    );
  for (const { flow, kind } of flows)
    out.push({
      key: `${kind}:${flow.address}`,
      kind,
      other: flow.address,
      parts: flowParts(flow, kind === 'paidTo' ? 'sent' : 'received'),
      height: flow.last.height,
      firstHeight: flow.first.height,
      timestamp: flow.last.timestamp,
      firstTimestamp: flow.first.timestamp,
      signature: flow.last.signature,
      count: flow.count,
      evidence: flow.txs,
      evidenceWords: plural(flow.count, 'payment'),
    });
  return out;
}

/** How much of its links was read, for Copy findings. */
export function linksCoverage(links: { rows: readonly unknown[]; truncated: boolean }): string {
  return links.truncated
    ? `Reward shares, level moves and name sales: its newest ${formatCount(links.rows.length)} (every level move read).`
    : `Reward shares, level moves and name sales: all ${plural(links.rows.length, 'transaction')}.`;
}
