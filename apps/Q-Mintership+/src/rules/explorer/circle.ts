/**
 * The Connections circle (Simon, 2026-10-16): every account linked to this
 * one by what was recorded between them, around it, sized by how many
 * transactions link them. Pure; ConnectionsCircle draws it.
 *
 * - One node per other account: payments it received from it (`in`), sent
 *   to it (`out`), and its other links (reward shares, minting level, names:
 *   `other`), each counted in transactions (a link with none listed counts 1).
 * - The most linked first; at most CIRCLE_MAX on two rings (the inner one
 *   for the biggest), the rest counted.
 * - A node's size grows with the square root of its count (its area with
 *   the count), from NODE_MIN to NODE_MAX px.
 */
import type { Finding } from './findings';

export interface CircleNode {
  address: string;
  /** Transactions in all. */
  count: number;
  /** Payments and transfers it received from that account. */
  in: number;
  /** Payments and transfers it sent to that account. */
  out: number;
  /** Its other links' transactions: reward shares, minting level, names. */
  other: number;
}

export interface PlacedNode extends CircleNode {
  ring: 1 | 2;
  /** Where it sits, in % of the circle's box from its top left (its centre). */
  x: number;
  y: number;
  /** Its avatar's size, px. */
  size: number;
}

export const CIRCLE_MAX = 24;
const INNER_MAX = 8;
export const NODE_MIN = 30;
export const NODE_MAX = 64;
/** Each ring's radius, in % of the box's width. */
const RADIUS = { 1: 26, 2: 42 } as const;

/** The other accounts and how they are linked, the most transactions first. */
export function circleNodes(findings: readonly Finding[]): CircleNode[] {
  const nodes = new Map<string, CircleNode>();
  for (const f of findings) {
    if (!f.other) continue;
    const node = nodes.get(f.other) ?? { address: f.other, count: 0, in: 0, out: 0, other: 0 };
    const count = Math.max(1, f.evidence.length);
    if (f.kind === 'paidBy') node.in += count;
    else if (f.kind === 'paidTo') node.out += count;
    else node.other += count;
    node.count += count;
    nodes.set(f.other, node);
  }
  return [...nodes.values()].sort(
    (a, b) => b.count - a.count || a.address.localeCompare(b.address)
  );
}

/** Its size, from its count and the biggest count. */
export function nodeSize(count: number, maxCount: number): number {
  if (maxCount <= 1) return Math.round((NODE_MIN + NODE_MAX) / 2);
  const share = Math.sqrt((count - 1) / (maxCount - 1));
  return Math.round(NODE_MIN + share * (NODE_MAX - NODE_MIN));
}

/** The nodes on their rings, and how many more there are. */
export function circleLayout(
  nodes: readonly CircleNode[],
  max = CIRCLE_MAX
): { placed: PlacedNode[]; rest: number } {
  const shown = nodes.slice(0, max);
  const maxCount = shown[0]?.count ?? 1;
  // Few enough for one ring: all on the inner one; else the biggest inside.
  const inner = shown.length <= INNER_MAX + 2 ? shown : shown.slice(0, INNER_MAX);
  const outer = shown.slice(inner.length);
  const ring = (list: readonly CircleNode[], which: 1 | 2): PlacedNode[] =>
    list.map((node, i) => {
      // From the top, clockwise; the outer ring starts half a step on.
      const step = (2 * Math.PI) / list.length;
      const angle = -Math.PI / 2 + step * i + (which === 2 ? step / 2 : 0);
      const r = list.length === 1 && which === 1 ? RADIUS[1] : RADIUS[which];
      return {
        ...node,
        ring: which,
        x: 50 + r * Math.cos(angle),
        y: 50 + r * Math.sin(angle),
        size: nodeSize(node.count, maxCount),
      };
    });
  return {
    placed: [...ring(inner, 1), ...ring(outer, 2)],
    rest: Math.max(0, nodes.length - shown.length),
  };
}
