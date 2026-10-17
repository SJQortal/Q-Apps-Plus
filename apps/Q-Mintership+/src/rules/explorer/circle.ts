/**
 * The Connections circle (Simon, 2026-10-16; split by direction 2026-10-17:
 * "one side transfers in, other transfers out … easier to read, threads not
 * overlapping"). Pure; ConnectionsCircle draws it.
 *
 * - The account in the middle; the accounts that sent it payments and
 *   transfers on the left, those it sent them to on the right. An account
 *   paid both ways is on both sides, each node counting that way's
 *   transactions only.
 * - Its other links (reward shares, minting level, names) aren't
 *   transfers: they are a row of their own under the circle (`other`).
 * - Each side is one arc of an ellipse, from the top down, the most
 *   transactions first, every node at its own angle: a line runs straight
 *   from the middle to each node, so no two lines cross and none passes
 *   under another node. At most 10 a side (8 on phones), the rest counted.
 * - A node's size grows with the square root of its count (its area with
 *   the count), within limits that shrink as a side fills.
 */
import type { TxRow } from '../../data/types';
import type { Finding } from './findings';

export type CircleSide = 'in' | 'out' | 'other';

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
}

export interface CircleGroups {
  in: CircleNode[];
  out: CircleNode[];
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
  rest: { in: number; out: number };
}

export interface LayoutOptions {
  /** The ellipse's half width and half height, in % of the box's width and height. */
  rx: number;
  ry: number;
  /** Nodes on a side at most. */
  sideMax: number;
  /** Avatar sizes: the smallest, and the biggest when a side holds few. */
  minSize: number;
  maxSize: number;
}

/** A wide screen: a box 4 wide by 3 high, room beside each side for the names. */
export const WIDE_LAYOUT: LayoutOptions = { rx: 30, ry: 41, sideMax: 10, minSize: 28, maxSize: 56 };
/** A phone: a box 3 wide by 4 high, no names beside the avatars. */
export const PHONE_LAYOUT: LayoutOptions = { rx: 35, ry: 41, sideMax: 8, minSize: 24, maxSize: 44 };

/** The gap left at the top and the bottom between the two sides, in degrees. */
const GAP_DEGREES = 20;

const SIDE_OF: Readonly<Record<Finding['kind'], CircleSide>> = {
  paidBy: 'in',
  paidTo: 'out',
  levelMove: 'other',
  sponsor: 'other',
  mintingWith: 'other',
  sponsees: 'other',
  nameDeal: 'other',
};

/** The other accounts on each side, the most transactions first. */
export function circleNodes(findings: readonly Finding[]): CircleGroups {
  const nodes = new Map<string, CircleNode>();
  for (const finding of findings) {
    if (!finding.other) continue;
    const side = SIDE_OF[finding.kind];
    const key = `${side}:${finding.other}`;
    const node = nodes.get(key) ?? {
      key,
      address: finding.other,
      side,
      count: 0,
      findings: [],
      qort: 0n,
    };
    node.count += Math.max(1, finding.evidence.length);
    node.qort += finding.qort ?? 0n;
    node.findings.push(finding);
    nodes.set(key, node);
  }
  const sorted = [...nodes.values()].sort(
    (a, b) => b.count - a.count || a.address.localeCompare(b.address)
  );
  return {
    in: sorted.filter((node) => node.side === 'in'),
    out: sorted.filter((node) => node.side === 'out'),
    other: sorted.filter((node) => node.side === 'other'),
  };
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

/**
 * The nodes of both sides on their arcs: the right side from just under
 * the top to just above the bottom, the left one its mirror image.
 */
export function circleLayout(
  groups: CircleGroups,
  options: LayoutOptions = WIDE_LAYOUT
): CircleLayout {
  const sides = {
    in: groups.in.slice(0, options.sideMax),
    out: groups.out.slice(0, options.sideMax),
  };
  const maxCount = Math.max(1, ...sides.in.map((n) => n.count), ...sides.out.map((n) => n.count));
  const gap = (GAP_DEGREES * Math.PI) / 180;
  const span = Math.PI - 2 * gap;
  const place = (list: readonly CircleNode[], side: 'in' | 'out'): PlacedNode[] => {
    const max = sideMaxSize(list.length, options);
    return list.map((node, i) => {
      // From the top down; one node sits level with the middle.
      const t = (i + 0.5) / list.length;
      const angle = -Math.PI / 2 + gap + t * span;
      const across = options.rx * Math.cos(angle);
      return {
        ...node,
        x: side === 'out' ? 50 + across : 50 - across,
        y: 50 + options.ry * Math.sin(angle),
        size: nodeSize(node.count, maxCount, options.minSize, max),
      };
    });
  };
  return {
    placed: [...place(sides.in, 'in'), ...place(sides.out, 'out')],
    rest: {
      in: Math.max(0, groups.in.length - sides.in.length),
      out: Math.max(0, groups.out.length - sides.out.length),
    },
  };
}

/**
 * A node's QORT, short, for beside its name: "500", "1,234", "76.5",
 * "0.25" (whole QORT from 100 up; two decimals below, four under 1). Null
 * for none (a link of other assets only).
 */
export function circleQort(atomic: bigint): string | null {
  if (atomic <= 0n) return null;
  const qort = Number(atomic) / 1e8;
  const digits = qort >= 100 ? 0 : qort >= 1 ? 2 : 4;
  return qort.toLocaleString('en-US', { maximumFractionDigits: digits });
}
