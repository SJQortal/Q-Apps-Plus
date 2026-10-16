/**
 * QORT and assets between an account and others, grouped by the other
 * account: how many transactions, how much (exact: amounts are added as
 * whole atomic units, 1 QORT = 100,000,000, never as floats), first and
 * last. Sent and received are kept apart. AT addresses (automated
 * contracts) are split out; accounts that have sent 1,000+ payments are
 * collapsed into one line, and 100+ or 500+ are marked, so a busy payer
 * reads as one.
 *
 * Pure: no reads.
 */
import type { TxRow } from '../../data/types';
import type { PayerBand } from '../../data/explorer/account';
import { formatCount, plural } from '../../utils/format';
import { refOf, whenWords, type TxRef } from './connections';
import { assetLabel, formatAmount, type TxPart } from './txWords';

const ATOMIC = 100_000_000n;
const ADDRESS_RE = /^[QA][1-9A-HJ-NP-Za-km-z]{33}$/;
const AT_RE = /^A[1-9A-HJ-NP-Za-km-z]{33}$/;

/** "4.3" → 430000000n; null for anything that isn't a plain non-negative decimal. */
export function parseAtomic(value: unknown): bigint | null {
  const match = String(value ?? '')
    .trim()
    .match(/^(\d+)(?:\.(\d{1,8}))?$/);
  if (!match) return null;
  return BigInt(match[1]) * ATOMIC + BigInt((match[2] ?? '').padEnd(8, '0'));
}

/** 430000000n → "4.3"; 120000000000n → "1,200". */
export function formatAtomic(value: bigint): string {
  return formatAmount(`${value / ATOMIC}.${(value % ATOMIC).toString().padStart(8, '0')}`);
}

export type FlowDirection = 'sent' | 'received';

export interface AssetSum {
  asset: string;
  atomic: bigint;
}

/** What moved one way between the account and one other account. */
export interface Flow {
  /** The other account. */
  address: string;
  /** An AT (automated contract), not a personal account. */
  isAt: boolean;
  /** Transactions. */
  count: number;
  /** QORT, in atomic units. */
  qort: bigint;
  /** Other assets, in the order first seen. */
  assets: AssetSum[];
  first: TxRef;
  last: TxRef;
  /** The transactions, newest first. */
  txs: TxRow[];
}

interface Part {
  other: string;
  asset: string;
  atomic: bigint;
}

/** What `tx` moved between `address` and others, one way. */
function partsOf(tx: TxRow, address: string, direction: FlowDirection): Part[] {
  const creator = typeof tx.creatorAddress === 'string' ? tx.creatorAddress : null;
  const sent = creator === address;
  if (direction === 'sent' ? !sent : sent || !creator) return [];
  const one = (recipient: unknown, amount: unknown, asset: string): Part[] => {
    if (typeof recipient !== 'string' || !ADDRESS_RE.test(recipient)) return [];
    if (direction === 'sent' ? recipient === address : recipient !== address) return [];
    const atomic = parseAtomic(amount);
    if (atomic === null) return [];
    return [{ other: direction === 'sent' ? recipient : (creator as string), asset, atomic }];
  };
  switch (tx.type) {
    case 'PAYMENT':
      return one(tx.recipient, tx.amount, 'QORT');
    case 'TRANSFER_ASSET':
      return one(tx.recipient, tx.amount, assetLabel(tx.assetId, tx.assetName));
    case 'MULTI_PAYMENT':
      return (Array.isArray(tx.payments) ? (tx.payments as Array<Record<string, unknown>>) : [])
        .filter(Boolean)
        .flatMap((payment) =>
          one(payment.recipient, payment.amount, assetLabel(payment.assetId, payment.assetName))
        );
    default:
      return [];
  }
}

/** Group `rows` by the other account, one way. Each transaction counts once per account. */
export function flowsOf(rows: readonly TxRow[], address: string, direction: FlowDirection): Flow[] {
  const seen = new Set<string>();
  const flows = new Map<string, Flow>();
  const ordered = rows
    .filter((row) => typeof row.blockHeight === 'number')
    .filter((row) => (seen.has(row.signature) ? false : (seen.add(row.signature), true)))
    .sort((a, b) => (b.blockHeight ?? 0) - (a.blockHeight ?? 0) || b.timestamp - a.timestamp);
  for (const tx of ordered) {
    const parts = partsOf(tx, address, direction);
    const counted = new Set<string>();
    for (const part of parts) {
      let flow = flows.get(part.other);
      if (!flow) {
        flow = {
          address: part.other,
          isAt: AT_RE.test(part.other),
          count: 0,
          qort: 0n,
          assets: [],
          first: refOf(tx),
          last: refOf(tx),
          txs: [],
        };
        flows.set(part.other, flow);
      }
      if (!counted.has(part.other)) {
        counted.add(part.other);
        flow.count += 1;
        flow.txs.push(tx);
        // Newest first: each older one moves `first` back.
        flow.first = refOf(tx);
      }
      if (part.asset === 'QORT') flow.qort += part.atomic;
      else {
        const sum = flow.assets.find((a) => a.asset === part.asset);
        if (sum) sum.atomic += part.atomic;
        else flow.assets.push({ asset: part.asset, atomic: part.atomic });
      }
    }
  }
  return [...flows.values()];
}

export type FlowSort = 'count' | 'total';

/** Most transactions first, or most QORT first; ties by the other, then the newest. */
export function sortFlows(flows: readonly Flow[], sort: FlowSort): Flow[] {
  const byQort = (a: Flow, b: Flow) => (a.qort === b.qort ? 0 : a.qort > b.qort ? -1 : 1);
  return [...flows].sort(
    (a, b) =>
      (sort === 'count' ? b.count - a.count || byQort(a, b) : byQort(a, b) || b.count - a.count) ||
      b.last.height - a.last.height ||
      a.address.localeCompare(b.address)
  );
}

/** Personal accounts and AT addresses apart. */
export function splitAt(flows: readonly Flow[]): { people: Flow[]; ats: Flow[] } {
  return {
    people: flows.filter((flow) => !flow.isAt),
    ats: flows.filter((flow) => flow.isAt),
  };
}

/** Accounts that have sent 1,000+ payments, collapsed out of the list (in the same order). */
export function collapseBusy(
  flows: readonly Flow[],
  bands: Readonly<Record<string, PayerBand | undefined>>
): { shown: Flow[]; busy: Flow[] } {
  return {
    shown: flows.filter((flow) => bands[flow.address] !== 1000),
    busy: flows.filter((flow) => bands[flow.address] === 1000),
  };
}

/** "3 more with accounts that have sent 1,000+ payments". */
export function busyLine(count: number): string {
  return `${formatCount(count)} more with ${count === 1 ? 'an account that has' : 'accounts that have'} sent 1,000+ payments`;
}

/** "120 QORT", "120 QORT and 50 Bean Token", as sentence parts. */
export function flowAmounts(flow: Flow): TxPart[] {
  const sums: TxPart[] = [];
  if (flow.qort > 0n || flow.assets.length === 0)
    sums.push({ kind: 'amount', amount: formatAtomic(flow.qort), asset: 'QORT' });
  for (const sum of flow.assets)
    sums.push({ kind: 'amount', amount: formatAtomic(sum.atomic), asset: sum.asset });
  return sums.flatMap((part, i) =>
    i === 0 ? [part] : [{ kind: 'text', text: i === sums.length - 1 ? ' and ' : ', ' }, part]
  );
}

/** "4 payments". */
export function flowCountWords(flow: Flow): string {
  return plural(flow.count, 'payment');
}

/** "Paid Bob 120 QORT in 4 payments (Mar–May 2025)" / "Received 10 QORT from Bob in 1 payment (12 Mar 2025)". */
export function flowParts(flow: Flow, direction: FlowDirection): TxPart[] {
  const other: TxPart = { kind: 'account', address: flow.address };
  const tail: TxPart = {
    kind: 'text',
    text: ` in ${flowCountWords(flow)} (${whenWords(flow.first.timestamp, flow.last.timestamp)})`,
  };
  return direction === 'sent'
    ? [
        { kind: 'text', text: 'Paid ' },
        other,
        { kind: 'text', text: ' ' },
        ...flowAmounts(flow),
        tail,
      ]
    : [
        { kind: 'text', text: 'Received ' },
        ...flowAmounts(flow),
        { kind: 'text', text: ' from ' },
        other,
        tail,
      ];
}

// ---- how far it read -------------------------------------------------------------------

export interface PageCoverage {
  /** Transactions read. */
  count: number;
  /** Core has no older ones. */
  done: boolean;
}

function one(page: PageCoverage, verb: 'sent' | 'received'): string {
  if (!page.done) return `its latest ${formatCount(page.count)} QORT payments ${verb}`;
  if (page.count === 0) return `no QORT payments ${verb}`;
  if (page.count === 1) return `the only QORT payment it ${verb}`;
  return `all ${formatCount(page.count)} QORT payments it ${verb}`;
}

/**
 * How much of its payments was read: "In its latest 100 QORT payments each
 * way, and its latest 100 asset transfers and multi-payments."
 */
export function paymentsCoverage(
  sent: PageCoverage,
  received: PageCoverage,
  assets?: { count: number; truncated: boolean }
): string {
  const payments =
    !sent.done && !received.done && sent.count === received.count
      ? `its latest ${formatCount(sent.count)} QORT payments each way`
      : `${one(sent, 'sent')} and ${one(received, 'received')}`;
  const rest = !assets
    ? ''
    : assets.truncated
      ? `, and its latest ${formatCount(assets.count)} asset transfers and multi-payments`
      : assets.count > 1
        ? `, and all ${formatCount(assets.count)} of its asset transfers and multi-payments`
        : assets.count === 1
          ? ', and its only asset transfer or multi-payment'
          : ', and its asset transfers and multi-payments (none)';
  return `In ${payments}${rest}.`;
}

// ---- across a set of accounts ------------------------------------------------------------

export interface WentTo {
  address: string;
  /** The accounts of the set that paid it. */
  from: string[];
  /** Payments. */
  count: number;
  qort: bigint;
}

/**
 * Where a set of accounts sent QORT, from each one's payments sent: the
 * accounts paid by the most of them first. AT addresses are left out and
 * counted.
 */
export function wentTo(paymentsSent: ReadonlyMap<string, readonly TxRow[]>): {
  recipients: WentTo[];
  atLeftOut: number;
} {
  const recipients = new Map<string, { from: Set<string>; count: number; qort: bigint }>();
  const ats = new Set<string>();
  for (const [payer, rows] of paymentsSent) {
    for (const flow of flowsOf(rows, payer, 'sent')) {
      if (flow.isAt) {
        ats.add(flow.address);
        continue;
      }
      const entry = recipients.get(flow.address) ?? { from: new Set(), count: 0, qort: 0n };
      entry.from.add(payer);
      entry.count += flow.count;
      entry.qort += flow.qort;
      recipients.set(flow.address, entry);
    }
  }
  return {
    recipients: [...recipients]
      .map(([address, entry]) => ({
        address,
        from: [...entry.from],
        count: entry.count,
        qort: entry.qort,
      }))
      .sort(
        (a, b) =>
          b.from.length - a.from.length ||
          b.count - a.count ||
          (a.qort === b.qort ? 0 : a.qort > b.qort ? -1 : 1) ||
          a.address.localeCompare(b.address)
      ),
    atLeftOut: ats.size,
  };
}

/** "K received QORT from 9 of these 48 accounts: 23 payments, 1,200 QORT". */
export function wentToParts(entry: WentTo, total: number): TxPart[] {
  return [
    { kind: 'account', address: entry.address },
    {
      kind: 'text',
      text: ` received QORT from ${formatCount(entry.from.length)} of these ${formatCount(total)} accounts: ${plural(entry.count, 'payment')}, `,
    },
    { kind: 'amount', amount: formatAtomic(entry.qort), asset: 'QORT' },
  ];
}
