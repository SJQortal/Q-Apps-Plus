/**
 * "Copy findings": what the Connections tab found, as plain text to paste
 * into a chat or a note. It says which account and at which block it was
 * checked, how much was read, every finding with its block and short
 * signature, what was checked and found nothing, the fixed neutral line,
 * and the link that opens the same tab. Facts only: the words are the
 * page's own sentences, so no verdict is added here.
 *
 * Pure: names come from `nameOf` (the names already loaded).
 */
import { shortAddress, formatCount } from '../../utils/format';
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
