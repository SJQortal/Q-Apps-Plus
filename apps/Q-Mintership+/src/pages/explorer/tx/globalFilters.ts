/**
 * Transactions on Qortal's filters and words. The type is All, a family
 * (Payments, the default) or one exact type; the blocks are the latest
 * 1,000 (the default), the latest 10,000, or 10,000 from a block. Both live
 * in the URL (`?type=names`, `?type=REGISTER_NAME`, `?blocks=10000`,
 * `?blocks=from-2700000`), the defaults left out; anything else reads as
 * the default.
 */
import type { BlockRange, BlocksChoice } from '../../../data/explorer/globalTx';
import {
  ALL_TX_TYPES,
  isTxFamilyKey,
  TX_FAMILIES,
  txTypeLabel,
  typesFor,
  type TxFamilyKey,
} from '../../../rules/explorer/txFamilies';
import { formatCount } from '../../../utils/format';
import { FAMILY_NOUN } from '../account/transactions/txTabWords';

/** A family key, or one of Core's type names. */
export type GlobalType = string;

export const DEFAULT_TYPE: GlobalType = 'payments';
export const DEFAULT_BLOCKS: BlocksChoice = { kind: 'latest', blocks: 1000 };

/**
 * Messages aren't offered here: an account's own Transactions tab lists the
 * ones it took part in (never their content), but a chain-wide feed of who
 * messages whom is more than an explorer of accounts needs.
 */
const NOT_OFFERED: ReadonlySet<string> = new Set(['messages', ...typesFor('messages')]);

const EXACT: ReadonlySet<string> = new Set(ALL_TX_TYPES.filter((type) => !NOT_OFFERED.has(type)));

/** `?type=`: a family key or an exact type, else Payments. */
export function parseTypeParam(value: string | null): GlobalType {
  if (value && !NOT_OFFERED.has(value) && (isTxFamilyKey(value) || EXACT.has(value))) return value;
  return DEFAULT_TYPE;
}

/** The value written to `?type=`, or null for the default. */
export function typeParam(type: GlobalType): string | null {
  return type === DEFAULT_TYPE ? null : type;
}

/** The types to ask Core for; All is every type that is offered (not messages). */
export function typesOfChoice(type: GlobalType): readonly string[] {
  if (type === 'all') return [...EXACT];
  return isTxFamilyKey(type) ? typesFor(type) : [type];
}

/** `?blocks=`: the latest 1,000 or 10,000 blocks, or from a block; else the latest 1,000. */
export function parseBlocksParam(value: string | null): BlocksChoice {
  if (value === '10000') return { kind: 'latest', blocks: 10000 };
  const from = value?.match(/^from-(\d{1,9})$/);
  if (from && Number(from[1]) >= 1) return { kind: 'from', start: Number(from[1]) };
  return DEFAULT_BLOCKS;
}

/** The value written to `?blocks=`, or null for the default. */
export function blocksParam(choice: BlocksChoice): string | null {
  if (choice.kind === 'from') return `from-${choice.start}`;
  return choice.blocks === 1000 ? null : String(choice.blocks);
}

interface Noun {
  one: string;
  many: string;
}

/** What the picked type's transactions are called. */
export function typeNoun(type: GlobalType): Noun {
  if (isTxFamilyKey(type)) return FAMILY_NOUN[type as TxFamilyKey];
  const label = txTypeLabel(type);
  return { one: `transaction of the type “${label}”`, many: `transactions of the type “${label}”` };
}

/** The type picker's options: All, then each family with its exact types under it. */
export interface TypeGroup {
  label: string;
  options: Array<{ value: GlobalType; label: string }>;
}

export const TYPE_GROUPS: readonly TypeGroup[] = TX_FAMILIES.filter(
  (f) => f.key !== 'all' && !NOT_OFFERED.has(f.key)
).map((family) => ({
  label: family.label,
  options: [
    { value: family.key, label: `${family.label} (every type)` },
    ...family.types.map((type) => ({ value: type, label: txTypeLabel(type) })),
  ],
}));

/** "blocks 2,756,501–2,757,500", or "block 2,757,500". */
export function rangeWords(range: BlockRange): string {
  const end = range.start + range.limit - 1;
  return end > range.start
    ? `blocks ${formatCount(range.start)}–${formatCount(end)}`
    : `block ${formatCount(range.start)}`;
}

/** "The newest 40 payments in blocks …", "All 7 …", "The only payment in …". */
export function globalCoverage(
  type: GlobalType,
  count: number,
  done: boolean,
  range: BlockRange
): string {
  const noun = typeNoun(type);
  const where = rangeWords(range);
  if (!done) return `The newest ${formatCount(count)} ${noun.many} in ${where}.`;
  return count === 1
    ? `The only ${noun.one} in ${where}.`
    : `All ${formatCount(count)} ${noun.many} in ${where}.`;
}

/** "No payments in blocks …." */
export function globalEmpty(type: GlobalType, range: BlockRange): string {
  return `No ${typeNoun(type).many} in ${rangeWords(range)}.`;
}

/** "20 older payments loaded". */
export function globalOlderLoaded(type: GlobalType, count: number): string {
  const noun = typeNoun(type);
  return count <= 0
    ? `No older ${noun.many}`
    : `${formatCount(count)} older ${count === 1 ? noun.one : noun.many} loaded`;
}
