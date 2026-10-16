import { describe, expect, it } from 'vitest';
import type { TxRow } from '../../data/types';
import type { Finding } from './findings';
import { CIRCLE_MAX, NODE_MAX, NODE_MIN, circleLayout, circleNodes, nodeSize } from './circle';

const tx = (n: number) => Array.from({ length: n }, (_, i) => ({ signature: `s${i}` }) as TxRow);
const finding = (kind: Finding['kind'], other: string | null, n: number): Finding =>
  ({
    key: `${kind}:${other}`,
    kind,
    other,
    parts: [],
    height: 1,
    timestamp: 1,
    signature: 's',
    evidence: tx(n),
    evidenceWords: '',
  }) as Finding;

describe('circleNodes', () => {
  it('one node per account, its payments each way and other links counted apart', () => {
    const nodes = circleNodes([
      finding('paidBy', 'QA', 3),
      finding('paidTo', 'QA', 2),
      finding('sponsor', 'QB', 0),
      finding('levelMove', 'QB', 1),
      finding('nameDeal', 'QC', 1),
      finding('sponsees', null, 0),
    ]);
    expect(nodes).toEqual([
      { address: 'QA', count: 5, in: 3, out: 2, other: 0 },
      { address: 'QB', count: 2, in: 0, out: 0, other: 2 },
      { address: 'QC', count: 1, in: 0, out: 0, other: 1 },
    ]);
  });
});

describe('nodeSize', () => {
  it('grows with the count, from the smallest to the biggest', () => {
    expect(nodeSize(1, 100)).toBe(NODE_MIN);
    expect(nodeSize(100, 100)).toBe(NODE_MAX);
    expect(nodeSize(25, 100)).toBeGreaterThan(NODE_MIN);
    expect(nodeSize(25, 100)).toBeLessThan(nodeSize(50, 100));
    expect(nodeSize(1, 1)).toBe((NODE_MIN + NODE_MAX) / 2);
  });
});

describe('circleLayout', () => {
  const nodes = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      address: `Q${i}`,
      count: n - i,
      in: n - i,
      out: 0,
      other: 0,
    }));

  it('a few on one ring, from the top, inside the box', () => {
    const { placed, rest } = circleLayout(nodes(5));
    expect(rest).toBe(0);
    expect(placed.every((p) => p.ring === 1)).toBe(true);
    expect(placed[0].x).toBeCloseTo(50);
    expect(placed[0].y).toBeLessThan(50);
    for (const p of placed) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(100);
    }
  });

  it('more on two rings, the biggest inside, at most CIRCLE_MAX, the rest counted', () => {
    const { placed, rest } = circleLayout(nodes(40));
    expect(placed).toHaveLength(CIRCLE_MAX);
    expect(rest).toBe(40 - CIRCLE_MAX);
    const inner = placed.filter((p) => p.ring === 1);
    expect(inner.map((p) => p.address)).toEqual(['Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7']);
    expect(placed[0].size).toBe(NODE_MAX);
  });
});
