/**
 * Transactions on Qortal's filters and words. The type is All, a family
 * (Payments, the default) or one exact type; the blocks are the latest
 * 1,000 (the default), the latest 10,000, or 1 to 10,000 from a block; the
 * order is newest first (the default) or oldest first. All live in the URL
 * (`?type=names`, `?type=REGISTER_NAME`, `?blocks=10000`,
 * `?blocks=from-2700000`, `&span=1` for just that block, `?order=oldest`),
 * the defaults left out; anything else reads as the default.
 */
import {
  FROM_SPAN,
  FROM_SPANS,
  type BlockRange,
  type BlocksChoice,
  type FromSpan,
  type GlobalOrder,
} from '../../../data/explorer/globalTx';
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

/**
 * `?blocks=` (and `?span=`): the latest 1,000 or 10,000 blocks, or 1 to
 * 10,000 blocks from a block; else the latest 1,000.
 */
export function parseBlocksParam(value: string | null, span: string | null = null): BlocksChoice {
  if (value === '10000') return { kind: 'latest', blocks: 10000 };
  const from = value?.match(/^from-(\d{1,9})$/);
  if (from && Number(from[1]) >= 1) {
    const spanned = FROM_SPANS.find((n) => String(n) === span);
    return spanned && spanned !== FROM_SPAN
      ? { kind: 'from', start: Number(from[1]), span: spanned }
      : { kind: 'from', start: Number(from[1]) };
  }
  return DEFAULT_BLOCKS;
}

/** The value written to `?blocks=`, or null for the default. */
export function blocksParam(choice: BlocksChoice): string | null {
  if (choice.kind === 'from') return `from-${choice.start}`;
  return choice.blocks === 1000 ? null : String(choice.blocks);
}

/** The value written to `?span=`: how many blocks from a block, or null for 10,000. */
export function spanParam(choice: BlocksChoice): string | null {
  return choice.kind === 'from' && choice.span && choice.span !== FROM_SPAN
    ? String(choice.span)
    : null;
}

/** "Just this block", "10 blocks", "10,000 blocks". */
export function spanWords(span: FromSpan): string {
  return span === 1 ? 'Just this block' : `${formatCount(span)} blocks`;
}

/** `?order=`: oldest first, else newest first. */
export function parseOrderParam(value: string | null): GlobalOrder {
  return value === 'oldest' ? 'oldest' : 'newest';
}

/** The value written to `?order=`, or null for newest first. */
export function orderParam(order: GlobalOrder): string | null {
  return order === 'oldest' ? 'oldest' : null;
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

/** All, in the lines that say what was searched: it never holds messages, and says so. */
const ALL_EXCEPT_MESSAGES: Noun = {
  one: 'transaction of any type except messages',
  many: 'transactions of every type except messages',
};

/**
 * "The newest 40 payments in blocks …" (the oldest, oldest first), "All 7
 * …", "The only payment in …"; for All, "All 37 transactions of every type
 * except messages in …".
 */
export function globalCoverage(
  type: GlobalType,
  count: number,
  done: boolean,
  range: BlockRange,
  order: GlobalOrder = 'newest'
): string {
  const noun = type === 'all' ? ALL_EXCEPT_MESSAGES : typeNoun(type);
  const where = rangeWords(range);
  if (!done) return `The ${order} ${formatCount(count)} ${noun.many} in ${where}.`;
  return count === 1
    ? `The only ${noun.one} in ${where}.`
    : `All ${formatCount(count)} ${noun.many} in ${where}.`;
}

/** "No payments in blocks …."; for All, "No transactions of any type except messages in …". */
export function globalEmpty(type: GlobalType, range: BlockRange): string {
  const what = type === 'all' ? 'transactions of any type except messages' : typeNoun(type).many;
  return `No ${what} in ${rangeWords(range)}.`;
}

/** "20 older payments loaded" ("newer", oldest first). */
export function globalOlderLoaded(
  type: GlobalType,
  count: number,
  order: GlobalOrder = 'newest'
): string {
  const noun = typeNoun(type);
  const which = order === 'oldest' ? 'newer' : 'older';
  return count <= 0
    ? `No ${which} ${noun.many}`
    : `${formatCount(count)} ${which} ${count === 1 ? noun.one : noun.many} loaded`;
}

/**
 * The coverage line when the rows are narrowed: "Showing 3 that match, out
 * of the newest 40 payments in …", "None match, out of all 7 …".
 */
export function filteredCoverage(shown: number, coverage: string): string {
  const lead =
    shown === 0
      ? 'None match'
      : `Showing ${formatCount(shown)} that ${shown === 1 ? 'matches' : 'match'}`;
  return `${lead}, out of ${coverage.charAt(0).toLowerCase()}${coverage.slice(1)}`;
}

/** Said after looking further: "Read 60 older transactions: 2 match". */
export function lookedFurtherWords(read: number, matched: number, order: GlobalOrder): string {
  const which = order === 'oldest' ? 'newer' : 'older';
  if (read <= 0) return `No ${which} transactions`;
  const found =
    matched === 0 ? 'none match' : matched === 1 ? '1 matches' : `${formatCount(matched)} match`;
  return `Read ${formatCount(read)} ${which} ${read === 1 ? 'transaction' : 'transactions'}: ${found}`;
}
