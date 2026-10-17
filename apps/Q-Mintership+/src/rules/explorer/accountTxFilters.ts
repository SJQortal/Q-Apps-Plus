/**
 * An account's Transactions tab filters and order, and how they live in the
 * URL (each left out at its default, so a plain tab link stays plain):
 *
 *   ?kind=names        a family (default All)
 *   &type=BUY_NAME     one exact type of that family
 *   &name=Q-Maps       transactions about one of its names (primary or not)
 *   &when=7d           24h, 7d, 30d, 1y, dates (from/to: 2026-09-01) or
 *                      blocks (from/to: block numbers); default any time
 *   &from=…&to=…       either may be left empty (open on that side)
 *   &order=oldest      newest (default), oldest, or amount
 *
 * Core filters the type and the order (newest or oldest first); a time
 * or blocks picked is a window over the account's list (data/explorer/
 * txWindow.ts), dates by each transaction's own time. A name
 * is matched here, on the rows read: only the types that carry a name are
 * asked for (names and QDN data), so most rows read are about some name.
 * "Biggest amount first" sorts the rows read so far, and says so. Pure.
 */
import type { TxRow } from '../../data/types';
import { blockNumber, formatCount, formatDate } from '../../utils/format';
import { visibleName } from './nameNotes';
import { isTxFamilyKey, txTypeLabel, typesFor, type TxFamilyKey } from './txFamilies';
import { toAtomic } from './txWords';

export type TxOrder = 'newest' | 'oldest' | 'amount';
export type TxWhen = 'any' | '24h' | '7d' | '30d' | '1y' | 'dates' | 'blocks';

export interface TxFilters {
  kind: TxFamilyKey;
  /** One exact type of `kind`, or null for every type of it. */
  type: string | null;
  /** One name the transactions are about, or null. */
  name: string | null;
  when: TxWhen;
  /** `dates`: YYYY-MM-DD; `blocks`: a block number; empty on an open side. */
  from: string | null;
  to: string | null;
  order: TxOrder;
}

export const DEFAULT_FILTERS: TxFilters = {
  kind: 'all',
  type: null,
  name: null,
  when: 'any',
  from: null,
  to: null,
  order: 'newest',
};

export const ORDERS: ReadonlyArray<{ value: TxOrder; label: string }> = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'amount', label: 'Biggest amount first' },
];

export const WHENS: ReadonlyArray<{ value: TxWhen; label: string }> = [
  { value: 'any', label: 'Any time' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '1y', label: 'Last 12 months' },
  { value: 'dates', label: 'Between dates…' },
  { value: 'blocks', label: 'Between blocks…' },
];

/** How far back each "last …" reaches (ms). */
export const WHEN_SPAN: Readonly<Partial<Record<TxWhen, number>>> = {
  '24h': 24 * 3_600_000,
  '7d': 7 * 86_400_000,
  '30d': 30 * 86_400_000,
  '1y': 365 * 86_400_000,
};

/** The types that carry a name (`name`, and a rename's `newName`). */
export const NAMED_TYPES: readonly string[] = [
  'REGISTER_NAME',
  'UPDATE_NAME',
  'SELL_NAME',
  'CANCEL_SELL_NAME',
  'BUY_NAME',
  'ARBITRARY',
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BLOCK_RE = /^\d{1,9}$/;

function isOrder(value: unknown): value is TxOrder {
  return ORDERS.some((order) => order.value === value);
}
function isWhen(value: unknown): value is TxWhen {
  return WHENS.some((when) => when.value === value);
}

/** A side of a range as the URL gives it: kept only when it fits `when`. */
function side(when: TxWhen, value: string | null): string | null {
  if (!value) return null;
  if (when === 'dates') return DATE_RE.test(value) && !Number.isNaN(dayStart(value)) ? value : null;
  if (when === 'blocks') return BLOCK_RE.test(value) && Number(value) >= 1 ? value : null;
  return null;
}

/** The filters in the URL; anything unknown reads as its default. */
export function parseFilters(get: (key: string) => string | null): TxFilters {
  const kind = isTxFamilyKey(get('kind')) ? (get('kind') as TxFamilyKey) : 'all';
  const rawType = get('type');
  const type =
    rawType && kind !== 'all' && typesFor(kind).includes(rawType as never) ? rawType : null;
  const when = isWhen(get('when')) ? (get('when') as TxWhen) : 'any';
  const name = get('name');
  return {
    kind,
    type,
    name: name ? name : null,
    when,
    from: side(when, get('from')),
    to: side(when, get('to')),
    order: isOrder(get('order')) ? (get('order') as TxOrder) : 'newest',
  };
}

/** What to write to the URL: each key, or null to leave it out. */
export function filtersToParams(filters: TxFilters): Record<string, string | null> {
  const ranged = filters.when === 'dates' || filters.when === 'blocks';
  return {
    kind: filters.kind === 'all' ? null : filters.kind,
    type: filters.type,
    name: filters.name,
    when: filters.when === 'any' ? null : filters.when,
    from: ranged ? filters.from : null,
    to: ranged ? filters.to : null,
    order: filters.order === 'newest' ? null : filters.order,
  };
}

/** Is anything other than the defaults picked? */
export function isFiltered(filters: TxFilters): boolean {
  return Object.values(filtersToParams(filters)).some((value) => value !== null);
}

/**
 * The types to ask Core for (none: every type), or null when none can
 * match (a name with payments: payments are never about a name).
 */
export function typesToAsk(filters: TxFilters): readonly string[] | null {
  const picked: readonly string[] = filters.type ? [filters.type] : typesFor(filters.kind);
  if (!filters.name) return picked;
  const named = picked.length ? picked.filter((t) => NAMED_TYPES.includes(t)) : NAMED_TYPES;
  return named.length ? named : null;
}

/** Is this transaction about `name` (its name, or a rename's new name)? */
export function isAboutName(tx: TxRow, name: string): boolean {
  return tx.name === name || tx.newName === name;
}

/** The QORT it moves (atomic units), for "Biggest amount first"; null when it moves none. */
export function qortAmount(tx: TxRow): bigint | null {
  const isQort = (assetId: unknown) =>
    assetId === undefined || assetId === null || Number(assetId) === 0;
  switch (tx.type) {
    case 'PAYMENT':
    case 'BUY_NAME':
    case 'AT':
      return toAtomic(tx.amount);
    case 'TRANSFER_ASSET':
      return isQort(tx.assetId) ? toAtomic(tx.amount) : null;
    case 'MULTI_PAYMENT': {
      const rows = Array.isArray(tx.payments)
        ? (tx.payments as Array<Record<string, unknown>>)
        : [];
      let sum: bigint | null = null;
      for (const row of rows)
        if (isQort(row.assetId)) {
          const amount = toAtomic(row.amount);
          if (amount !== null) sum = (sum ?? 0n) + amount;
        }
      return sum;
    }
    default:
      return null;
  }
}

/** The rows read, biggest QORT amount first; rows that move none after, newest first. */
export function byAmount(rows: readonly TxRow[]): TxRow[] {
  const amounts = new Map(rows.map((row) => [row.signature, qortAmount(row)]));
  return [...rows].sort((a, b) => {
    const x = amounts.get(a.signature) ?? null;
    const y = amounts.get(b.signature) ?? null;
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
    return x === y ? 0 : x > y ? -1 : 1;
  });
}

/** Local midnight at the start of a YYYY-MM-DD day (ms). */
export function dayStart(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const at = new Date(y, m - 1, d).getTime();
  return new Date(at).getDate() === d ? at : NaN;
}

/** A date for an <input type="date">: YYYY-MM-DD, local. */
export function dateValue(ms: number): string {
  const at = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** Why a typed range can't be used, or null. `today`: YYYY-MM-DD; `tip`: the chain's height. */
export function rangeProblem(
  when: 'dates' | 'blocks',
  from: string,
  to: string,
  today: string,
  tip: number | null
): string | null {
  if (!from && !to)
    return when === 'dates'
      ? 'Pick a first day, a last day, or both.'
      : 'Enter a first block, a last block, or both.';
  if (when === 'dates') {
    if ((from && Number.isNaN(dayStart(from))) || (to && Number.isNaN(dayStart(to))))
      return 'Pick dates from the calendar.';
    if (from && from > today) return 'The first day is in the future.';
    if (from && to && from > to) return 'The first day is after the last day.';
    return null;
  }
  // As typed: "1,519,621" too (blockNumber).
  const [first, last] = [from, to].map((value) => (value ? blockNumber(value) : null));
  if ((from && first === null) || (to && last === null))
    return 'Enter block numbers, like 2700000 or 2,700,000.';
  if (first !== null && tip !== null && first > tip)
    return `The chain is at block ${formatCount(tip)}.`;
  if (first !== null && last !== null && first > last)
    return 'The first block is after the last block.';
  return null;
}

/** "1 Sept 2026 – 30 Sept 2026", "from 1 Sept 2026", "until block 2,700,000". */
export function rangeLabel(filters: TxFilters): string | null {
  const { when, from, to } = filters;
  if (when === 'any') return null;
  if (when !== 'dates' && when !== 'blocks')
    return WHENS.find((w) => w.value === when)?.label.toLowerCase() ?? null;
  const show = (value: string) =>
    when === 'dates' ? formatDate(dayStart(value)) : `block ${formatCount(Number(value))}`;
  if (from && to) {
    if (from === to) return when === 'dates' ? `on ${show(from)}` : `in ${show(from)}`;
    return when === 'dates'
      ? `${show(from)} – ${show(to)}`
      : `blocks ${formatCount(Number(from))}–${formatCount(Number(to))}`;
  }
  if (from) return `from ${show(from)}`;
  if (to) return `until ${show(to)}`;
  return null;
}

/**
 * What is shown, in one line: "Name transactions about “Q-Maps” · last 7
 * days · oldest first". Null for the defaults.
 */
export function filterSummary(filters: TxFilters, kindLabel: string): string | null {
  if (!isFiltered(filters)) return null;
  const what = filters.type
    ? txTypeLabel(filters.type)
    : filters.kind === 'all'
      ? 'All transactions'
      : kindLabel;
  const parts = [
    filters.name ? `${what} about “${visibleName(filters.name)}”` : what,
    rangeLabel(filters),
    filters.order === 'newest'
      ? null
      : ORDERS.find((o) => o.value === filters.order)?.label.toLowerCase(),
  ].filter(Boolean);
  return parts.join(' · ');
}
