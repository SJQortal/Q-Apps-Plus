import { describe, expect, it } from 'vitest';
import type { TxRow } from '../../data/types';
import type { Finding } from './findings';
import {
  PHONE_LAYOUT,
  WIDE_LAYOUT,
  circleLayout,
  circleNodes,
  nodeSize,
  nodeTransactions,
  sideMaxSize,
  type CircleGroups,
} from './circle';

const tx = (n: number, from = 0) =>
  Array.from(
    { length: n },
    (_, i) => ({ signature: `s${from + i}`, blockHeight: from + i, timestamp: from + i }) as TxRow
  );
const finding = (kind: Finding['kind'], other: string | null, txs: TxRow[]): Finding =>
  ({
    key: `${kind}:${other}`,
    kind,
    other,
    parts: [],
    height: 1,
    timestamp: 1,
    signature: 's',
    evidence: txs,
    evidenceWords: '',
  }) as Finding;

describe('circleNodes', () => {
  it('puts payments in on one side, payments out on the other, and every other link apart', () => {
    const groups = circleNodes([
      finding('paidBy', 'QA', tx(3)),
      finding('paidTo', 'QA', tx(2, 10)),
      finding('paidTo', 'QD', tx(5, 20)),
      finding('sponsor', 'QB', []),
      finding('levelMove', 'QB', tx(1, 30)),
      finding('nameDeal', 'QC', tx(1, 40)),
      finding('sponsees', null, []),
    ]);
    // An account paid both ways is on both sides, each counting its own way.
    expect(groups.in.map((n) => [n.key, n.count])).toEqual([['in:QA', 3]]);
    expect(groups.out.map((n) => [n.key, n.count])).toEqual([
      ['out:QD', 5],
      ['out:QA', 2],
    ]);
    expect(groups.other.map((n) => [n.key, n.count, n.findings.length])).toEqual([
      ['other:QB', 2, 2],
      ['other:QC', 1, 1],
    ]);
  });

  it('lists a node’s transactions once each, the newest first', () => {
    const shared = tx(2, 5);
    const node = {
      findings: [
        finding('levelMove', 'QB', shared),
        finding('sponsor', 'QB', [shared[1], ...tx(1, 9)]),
      ],
    };
    expect(nodeTransactions(node).map((t) => t.signature)).toEqual(['s9', 's6', 's5']);
  });
});

describe('sizes', () => {
  it('grow with the count, within a side’s room', () => {
    expect(nodeSize(1, 100, 28, 56)).toBe(28);
    expect(nodeSize(100, 100, 28, 56)).toBe(56);
    expect(nodeSize(25, 100, 28, 56)).toBeLessThan(nodeSize(50, 100, 28, 56));
    expect(nodeSize(1, 1, 28, 56)).toBe(42);
    expect(sideMaxSize(3, WIDE_LAYOUT)).toBe(56);
    expect(sideMaxSize(10, WIDE_LAYOUT)).toBeLessThan(44);
    expect(sideMaxSize(8, PHONE_LAYOUT)).toBeLessThan(PHONE_LAYOUT.maxSize);
  });
});

describe('circleLayout', () => {
  const side = (prefix: 'in' | 'out', n: number) =>
    Array.from({ length: n }, (_, i) => ({
      key: `${prefix}:Q${i}`,
      address: `Q${i}`,
      side: prefix,
      count: n - i,
      findings: [],
    }));
  const groups = (inCount: number, outCount: number): CircleGroups => ({
    in: side('in', inCount),
    out: side('out', outCount),
    other: [],
  });

  it('draws what came in on the left and what went out on the right, from the top down', () => {
    const { placed, rest } = circleLayout(groups(3, 2));
    expect(rest).toEqual({ in: 0, out: 0 });
    const left = placed.filter((p) => p.side === 'in');
    const right = placed.filter((p) => p.side === 'out');
    expect(left.every((p) => p.x < 50)).toBe(true);
    expect(right.every((p) => p.x > 50)).toBe(true);
    // The most transactions first, at the top.
    expect(left.map((p) => p.y)).toEqual([...left.map((p) => p.y)].sort((a, b) => a - b));
    // One node sits level with the middle.
    expect(circleLayout(groups(1, 0)).placed[0].y).toBeCloseTo(50);
  });

  it('gives every node its own angle, so the lines from the middle never cross or pass under one', () => {
    const { placed } = circleLayout(groups(12, 12));
    const angles = placed.map((p) => Math.atan2(p.y - 50, p.x - 50));
    expect(new Set(angles.map((a) => a.toFixed(4))).size).toBe(placed.length);
    // Each line keeps clear of every other node on its side (in the box's own units).
    for (const p of placed)
      for (const q of placed) {
        if (p === q || p.side !== q.side) continue;
        const length = Math.hypot(p.x - 50, p.y - 50);
        const cross = Math.abs((p.x - 50) * (q.y - 50) - (p.y - 50) * (q.x - 50)) / length;
        expect(cross).toBeGreaterThan(5);
      }
  });

  it('draws at most a side’s maximum, counts the rest, and fewer on phones', () => {
    expect(circleLayout(groups(20, 3)).rest).toEqual({ in: 10, out: 0 });
    expect(circleLayout(groups(20, 3), PHONE_LAYOUT).rest).toEqual({ in: 12, out: 0 });
    const { placed } = circleLayout(groups(20, 3));
    expect(placed.filter((p) => p.side === 'in')).toHaveLength(WIDE_LAYOUT.sideMax);
    for (const p of placed) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(100);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(100);
    }
  });
});
