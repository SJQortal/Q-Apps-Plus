/**
 * The Connections circle (Simon, 2026-10-16; split by direction 2026-10-17:
 * "one side transfers in, other transfers out … easier to read, threads not
 * overlapping"). Pure; ConnectionsCircle draws it.
 *
 * - The account in the middle; the accounts that sent it payments and
 *   transfers on the left, those it sent them to on the right. An account
 *   paid both ways is one node at the bottom, between the two sides
 *   (Simon, 2026-10-17: "fill the empty middle bottom part"), its ring
 *   green and red in proportion to what came in and went out.
 * - Its other links (reward shares, minting level, names) aren't
 *   transfers: they are a row of their own under the circle (`other`).
 * - Each side is one arc of an ellipse, from the top down, the most
 *   transactions first, every node at its own angle: a line runs straight
 *   from the middle to each node, so no two lines cross and none passes
 *   under another node. The nodes of a side are evenly spaced in height,
 *   so a name beside one never runs under the next (Simon, 2026-10-17:
 *   "make sure the names and QORT amounts are not covered"). At most 10 a
 *   side (8 on phones), the rest counted.
 * - A node's size grows with the square root of its count (its area with
 *   the count), within limits that shrink as a side fills.
 * - Or by QORT (Simon, 2026-10-18: "switch the circles order to most QORT
 *   transacted instead of most different QORT Transactions"): the most QORT
 *   first and biggest, both ways added up for an account paid both ways.
 */
import type { TxRow } from '../../data/types';
import type { Finding } from './findings';
import type { AssetSum } from './money';

export type CircleSide = 'in' | 'out' | 'both' | 'other';

/** What puts an account first and draws it biggest: its transactions, or the QORT that moved. */
export type CircleOrder = 'count' | 'qort';

/** One way's part of a node paid both ways. */
export interface WayPart {
  count: number;
  /** QORT, atomic. */
  qort: bigint;
  /** Other assets, by name, atomic. */
  assets: AssetSum[];
}

export interface CircleNode {
  /** `in:Q…`, `out:Q…`, `other:Q…`: one per account and side. */
  key: string;
  address: string;
  side: CircleSide;
  /** Transactions behind it (a link with none listed counts 1). */
  count: number;
  /** The findings behind it: their sentences, for the list it opens. */
  findings: Finding[];
  /** QORT moved that way, in atomic units (Simon, 2026-10-17: "The Cat (500 QORT)"). */
  qort: bigint;
  /** Q-Assets moved that way, by name, atomic (Simon, 2026-10-17: "display Q-Assets ticker and ammounts"). */
  assets: AssetSum[];
  /** Paid both ways: each way's part. */
  split?: { in: WayPart; out: WayPart };
}

export interface CircleGroups {
  in: CircleNode[];
  out: CircleNode[];
  /** Accounts paid both ways: one node each, at the bottom. */
  both: CircleNode[];
  other: CircleNode[];
}

export interface PlacedNode extends CircleNode {
  /** Where its centre is, in % of the drawing's box from its top left. */
  x: number;
  y: number;
  /** Its avatar's size, px. */
  size: number;
}

export interface CircleLayout {
  placed: PlacedNode[];
  /** How many more there are on each side than are drawn. */
  rest: { in: number; out: number; both: number };
}

export interface LayoutOptions {
  /** The ellipse's half width and half height, in % of the box's width and height. */
  rx: number;
  ry: number;
  /** Nodes on a side at most. */
  sideMax: number;
  /** Nodes paid both ways at the bottom at most. */
  bothMax: number;
  /** Avatar sizes: the smallest, and the biggest when a side holds few. */
  minSize: number;
  maxSize: number;
  /** Steps between the bottom avatars' centres: more where their names sit under them. */
  bothSpacing: number;
}

/** A wide screen: a box 4 wide by 3 high, room beside each side for the names. */
export const WIDE_LAYOUT: LayoutOptions = {
  rx: 30,
  ry: 41,
  sideMax: 10,
  bothMax: 4,
  minSize: 28,
  maxSize: 56,
  bothSpacing: 2.5,
};
/** A phone: a box 3 wide by 4 high, no names beside the avatars. */
export const PHONE_LAYOUT: LayoutOptions = {
  rx: 40,
  ry: 41,
  sideMax: 8,
  bothMax: 3,
  minSize: 24,
  maxSize: 44,
  bothSpacing: 1.5,
};

/** The widest the bottom avatars spread, between centres, in degrees. */
const BOTH_STEP_MAX = 36;

const SIDE_OF: Readonly<Record<Finding['kind'], CircleSide>> = {
  paidBy: 'in',
  paidTo: 'out',
  levelMove: 'other',
  sponsor: 'other',
  mintingWith: 'other',
  sponsees: 'other',
  nameDeal: 'other',
  // A trade moves both ways: drawn on both sides (circleNodes).
  traded: 'in',
};

/** What a node weighs in `order`: its transactions, or its QORT (whole QORT). */
export function nodeWeight(node: Pick<CircleNode, 'count' | 'qort'>, order: CircleOrder): number {
  return order === 'qort' ? Number(node.qort) / 1e8 : node.count;
}

/** The most first in `order`, then the most of the other; ties by address. */
function byOrder(order: CircleOrder) {
  const byQort = (a: CircleNode, b: CircleNode) =>
    a.qort === b.qort ? 0 : a.qort > b.qort ? -1 : 1;
  const byCount = (a: CircleNode, b: CircleNode) => b.count - a.count;
  return (a: CircleNode, b: CircleNode) =>
    (order === 'qort' ? byQort(a, b) || byCount(a, b) : byCount(a, b) || byQort(a, b)) ||
    a.address.localeCompare(b.address);
}

/** The other accounts on each side, the most transactions (or QORT) first. */
export function circleNodes(
  findings: readonly Finding[],
  order: CircleOrder = 'count'
): CircleGroups {
  const nodes = new Map<string, CircleNode>();
  for (const finding of findings) {
    if (!finding.other) continue;
    if (finding.trade) {
      // What it got comes in, what it gave goes out: one node each way, the
      // finding listed once (on the incoming one; joined when both are there).
      for (const [side, way] of [
        ['in', finding.trade.got],
        ['out', finding.trade.gave],
      ] as const) {
        const key = `${side}:${finding.other}`;
        const node = nodes.get(key) ?? {
          key,
          address: finding.other,
          side,
          count: 0,
          findings: [],
          qort: 0n,
          assets: [],
        };
        node.count += way.count;
        node.qort += way.qort;
        node.assets = addAssets(node.assets, way.assets);
        if (side === 'in') node.findings.push(finding);
        nodes.set(key, node);
      }
      continue;
    }
    const side = SIDE_OF[finding.kind];
    const key = `${side}:${finding.other}`;
    const node = nodes.get(key) ?? {
      key,
      address: finding.other,
      side,
      count: 0,
      findings: [],
      qort: 0n,
      assets: [],
    };
    node.count += Math.max(1, finding.evidence.length);
    node.qort += finding.qort ?? 0n;
    node.assets = addAssets(node.assets, finding.assets ?? []);
    node.findings.push(finding);
    nodes.set(key, node);
  }
  // Paid both ways: one node, with each way's part.
  for (const [key, received] of nodes) {
    if (received.side !== 'in') continue;
    const sent = nodes.get(`out:${received.address}`);
    if (!sent) continue;
    nodes.delete(key);
    nodes.delete(sent.key);
    nodes.set(`both:${received.address}`, {
      key: `both:${received.address}`,
      address: received.address,
      side: 'both',
      count: received.count + sent.count,
      findings: [...received.findings, ...sent.findings],
      qort: received.qort + sent.qort,
      assets: addAssets(received.assets, sent.assets),
      split: {
        in: { count: received.count, qort: received.qort, assets: received.assets },
        out: { count: sent.count, qort: sent.qort, assets: sent.assets },
      },
    });
  }
  const sorted = [...nodes.values()].sort(byOrder(order));
  return {
    in: sorted.filter((node) => node.side === 'in'),
    out: sorted.filter((node) => node.side === 'out'),
    both: sorted.filter((node) => node.side === 'both'),
    other: sorted.filter((node) => node.side === 'other'),
  };
}

/** `a` and `b` added up, by asset, in the order first seen. */
export function addAssets(a: readonly AssetSum[], b: readonly AssetSum[]): AssetSum[] {
  const out = a.map((sum) => ({ ...sum }));
  for (const sum of b) {
    const same = out.find((x) => x.asset === sum.asset);
    if (same) same.atomic += sum.atomic;
    else out.push({ ...sum });
  }
  return out;
}

/** The transactions behind a node, once each, the newest first. */
export function nodeTransactions(node: Pick<CircleNode, 'findings'>): TxRow[] {
  const seen = new Map<string, TxRow>();
  for (const finding of node.findings)
    for (const tx of finding.evidence) if (!seen.has(tx.signature)) seen.set(tx.signature, tx);
  return [...seen.values()].sort(
    (a, b) =>
      (b.blockHeight ?? Number.MAX_SAFE_INTEGER) - (a.blockHeight ?? Number.MAX_SAFE_INTEGER) ||
      b.timestamp - a.timestamp
  );
}

/** The biggest avatar a side of `n` nodes leaves room for. */
export function sideMaxSize(n: number, options: LayoutOptions): number {
  const room = options.maxSize - Math.max(0, n - 4) * ((options.maxSize - options.minSize) / 10);
  return Math.round(Math.max(options.minSize + 4, Math.min(options.maxSize, room)));
}

/** An avatar's size, from its count and the biggest count drawn. */
export function nodeSize(count: number, maxCount: number, min: number, max: number): number {
  if (maxCount <= 1) return Math.round((min + max) / 2);
  const share = Math.sqrt((Math.max(1, count) - 1) / (maxCount - 1));
  return Math.round(min + share * (max - min));
}

/** An avatar's size by QORT, from the smallest for none: its area grows with the QORT. */
export function qortSize(qort: number, maxQort: number, min: number, max: number): number {
  if (maxQort <= 0) return Math.round((min + max) / 2);
  const share = Math.sqrt(Math.max(0, qort) / maxQort);
  return Math.round(min + share * (max - min));
}

/**
 * What the number on an avatar's corner says: its transactions (from 2), or,
 * by QORT, the QORT that moved, short: "<1", "13", "1.5", "126", "1.2K",
 * "35K", "1.2M". Null for no number.
 */
export function badgeText(
  node: Pick<CircleNode, 'count' | 'qort'>,
  order: CircleOrder
): string | null {
  if (order === 'count')
    return node.count > 1 ? (node.count > 999 ? '999+' : String(node.count)) : null;
  if (node.qort <= 0n) return null;
  const qort = Number(node.qort) / 1e8;
  return qort < 1 ? '<1' : COMPACT.format(qort);
}

const COMPACT = new Intl.NumberFormat('en-US', { notation: 'compact' });

/**
 * Every node on one ring, evenly spaced and mirrored (Simon, 2026-10-17:
 * "make the circles around nicely symetrical"): the sides share one step,
 * the right side from just under the top down, the left one its mirror
 * image, the fewer of the two centred on its side; the accounts paid both
 * ways centred at the bottom; two steps' gap at the top and between the
 * groups.
 */
export function circleLayout(
  groups: CircleGroups,
  options: LayoutOptions = WIDE_LAYOUT,
  /** As `groups` were ordered (circleNodes): what sizes the avatars. */
  order: CircleOrder = 'count'
): CircleLayout {
  const sides = {
    in: groups.in.slice(0, options.sideMax),
    out: groups.out.slice(0, options.sideMax),
    both: (groups.both ?? []).slice(0, options.bothMax),
  };
  const weight = (node: CircleNode) => nodeWeight(node, order);
  const maxWeight = Math.max(
    order === 'qort' ? 0 : 1,
    ...sides.in.map(weight),
    ...sides.out.map(weight),
    ...sides.both.map(weight)
  );
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const at = (angle: number) => ({
    x: 50 + options.rx * Math.cos(angle),
    y: 50 + options.ry * Math.sin(angle),
  });
  const most = Math.max(sides.in.length, sides.out.length);
  const nBoth = sides.both.length;
  const k = options.bothSpacing;
  // One step for every gap: the sides' last slots two steps from the bottom group (or each other).
  const step = nBoth ? Math.PI / (most + 2 + (k * (nBoth - 1)) / 2) : Math.PI / (most + 1);
  // As big as half the ring holds.
  const max = sideMaxSize(most + Math.ceil((k * nBoth) / 2), options);
  const sizeOf = (node: CircleNode) =>
    order === 'qort'
      ? qortSize(weight(node), maxWeight, options.minSize, max)
      : nodeSize(node.count, maxWeight, options.minSize, max);
  const place = (list: readonly CircleNode[], side: 'in' | 'out'): PlacedNode[] => {
    // The fewer side centred on the slots the fuller one fills.
    const offset = (most - list.length) / 2;
    // The fuller side's first and last slots, by angle; the slots between
    // them evenly spaced in height (sin of the angle), each on the ellipse.
    const top = Math.sin(-Math.PI / 2 + step);
    const last = Math.sin(-Math.PI / 2 + step * most);
    return list.map((node, i) => {
      // From the top down; one node alone sits level with the middle.
      const slot = i + offset;
      const sin = most === 1 ? top : top + ((last - top) * slot) / (most - 1);
      const point = at(Math.asin(Math.max(-1, Math.min(1, sin))));
      return {
        ...node,
        x: side === 'out' ? point.x : 100 - point.x,
        y: point.y,
        size: sizeOf(node),
      };
    });
  };
  // Paid both ways: centred at the bottom, the most transactions (or QORT) in the middle.
  const middleOut = [...sides.both].sort((a, b) => weight(b) - weight(a));
  const leftToRight: CircleNode[] = [];
  middleOut.forEach((node, i) => (i % 2 ? leftToRight.unshift(node) : leftToRight.push(node)));
  const bothStep = Math.min(k * step, rad(BOTH_STEP_MAX));
  const bottom = leftToRight.map((node, i) => ({
    ...node,
    // From the left (the larger angle) to the right.
    ...at(Math.PI / 2 + bothStep * ((nBoth - 1) / 2 - i)),
    size: sizeOf(node),
  }));
  return {
    placed: [...place(sides.in, 'in'), ...place(sides.out, 'out'), ...bottom],
    rest: {
      in: Math.max(0, groups.in.length - sides.in.length),
      out: Math.max(0, groups.out.length - sides.out.length),
      both: Math.max(0, (groups.both ?? []).length - sides.both.length),
    },
  };
}

/**
 * A node's QORT (or a Q-Asset's amount), short, for beside its name: "500",
 * "1,234", "76.5", "0.25" (whole from 100 up; two decimals below, four
 * under 1). Null for none.
 */
export function circleQort(atomic: bigint): string | null {
  if (atomic <= 0n) return null;
  const qort = Number(atomic) / 1e8;
  const digits = qort >= 100 ? 0 : qort >= 1 ? 2 : 4;
  return qort.toLocaleString('en-US', { maximumFractionDigits: digits });
}

/**
 * What share of a node paid both ways came in (0 to 1): by QORT when QORT
 * went either way, else by transactions. 1 for received only, 0 for sent.
 */
export function receivedShare(node: Pick<CircleNode, 'side' | 'split'>): number {
  if (node.side === 'in') return 1;
  if (node.side !== 'both' || !node.split) return 0;
  const { in: received, out: sent } = node.split;
  const qort = received.qort + sent.qort;
  if (qort > 0n) return Number((received.qort * 10_000n) / qort) / 10_000;
  const count = received.count + sent.count;
  return count ? received.count / count : 0.5;
}
