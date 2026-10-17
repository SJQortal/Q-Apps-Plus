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
  type CircleNode,
  circleQort,
  receivedShare,
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
    // An account paid both ways is one node, with each way's part.
    expect(groups.in).toEqual([]);
    expect(groups.out.map((n) => [n.key, n.count])).toEqual([['out:QD', 5]]);
    expect(groups.both.map((n) => [n.key, n.count, n.split])).toEqual([
      ['both:QA', 5, { in: { count: 3, qort: 0n }, out: { count: 2, qort: 0n } }],
    ]);
    expect(nodeTransactions(groups.both[0])).toHaveLength(5);
    expect(groups.other.map((n) => [n.key, n.count, n.findings.length])).toEqual([
      ['other:QB', 2, 2],
      ['other:QC', 1, 1],
    ]);
  });

  it('adds up the QORT that went each way', () => {
    const groups = circleNodes([
      { ...finding('paidBy', 'QA', tx(3)), qort: 300_000_000n },
      { ...finding('paidTo', 'QA', tx(2, 10)), qort: 50_000_000_000n },
      finding('levelMove', 'QA', tx(1, 30)),
    ]);
    expect(groups.both[0].split?.in.qort).toBe(300_000_000n);
    expect(circleQort(groups.both[0].split?.out.qort ?? 0n)).toBe('500');
    expect(groups.both[0].qort).toBe(50_300_000_000n);
    expect(groups.other[0].qort).toBe(0n);
  });

  it('says what share came in: by QORT, else by transactions', () => {
    const node = (inCount: number, inQort: bigint, outCount: number, outQort: bigint) => ({
      side: 'both' as const,
      split: { in: { count: inCount, qort: inQort }, out: { count: outCount, qort: outQort } },
    });
    expect(receivedShare(node(1, 300n, 9, 100n))).toBeCloseTo(0.75);
    expect(receivedShare(node(3, 0n, 1, 0n))).toBeCloseTo(0.75);
    expect(receivedShare(node(0, 0n, 0, 0n))).toBe(0.5);
    expect(receivedShare({ side: 'in' })).toBe(1);
    expect(receivedShare({ side: 'out' })).toBe(0);
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
      qort: 0n,
    }));
  const groups = (inCount: number, outCount: number, bothCount = 0): CircleGroups => ({
    in: side('in', inCount),
    out: side('out', outCount),
    both: Array.from({ length: bothCount }, (_, i): CircleNode => ({
      key: `both:B${i}`,
      address: `B${i}`,
      side: 'both',
      count: bothCount - i,
      findings: [],
      qort: 0n,
    })),
    other: [],
  });

  it('draws what came in on the left and what went out on the right, from the top down', () => {
    const { placed, rest } = circleLayout(groups(3, 2));
    expect(rest).toEqual({ in: 0, out: 0, both: 0 });
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
    expect(circleLayout(groups(20, 3)).rest).toEqual({ in: 10, out: 0, both: 0 });
    expect(circleLayout(groups(20, 3), PHONE_LAYOUT).rest).toEqual({ in: 12, out: 0, both: 0 });
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

describe('circleLayout, both ways', () => {
  const both = (n: number): CircleGroups => ({
    in: [],
    out: [],
    both: Array.from({ length: n }, (_, i): CircleNode => ({
      key: `both:B${i}`,
      address: `B${i}`,
      side: 'both',
      count: n - i,
      findings: [],
      qort: 0n,
    })),
    other: [],
  });

  it('fills the bottom between the sides, the most transactions in the middle, with room for names', () => {
    const { placed, rest } = circleLayout(both(6));
    expect(rest.both).toBe(6 - WIDE_LAYOUT.bothMax);
    expect(placed).toHaveLength(WIDE_LAYOUT.bothMax);
    for (const p of placed) {
      expect(p.y).toBeGreaterThan(75);
      expect(p.y).toBeLessThan(100);
      expect(Math.abs(p.x - 50)).toBeLessThanOrEqual(WIDE_LAYOUT.rx);
    }
    const byX = [...placed].sort((a, b) => a.x - b.x).map((p) => p.address);
    expect(byX.slice(1, 3).sort()).toEqual(['B0', 'B1']);
    // Far enough apart for a name under each (in the box's own units: about 130 px at 830).
    const xs = placed.map((p) => p.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThan(15);
    // One alone sits straight under the middle.
    expect(circleLayout(both(1)).placed[0].x).toBeCloseTo(50);
    expect(circleLayout(both(5), PHONE_LAYOUT).placed).toHaveLength(PHONE_LAYOUT.bothMax);
  });

  it('lifts the sides off the bottom to make room', () => {
    const lowest = (g: CircleGroups) =>
      Math.max(
        ...circleLayout(g)
          .placed.filter((p) => p.side === 'in')
          .map((p) => p.y)
      );
    const sides = (extra: CircleNode[]) => ({
      ...both(0),
      in: [...Array(10)].map((_, i): CircleNode => ({
        key: `in:Q${i}`,
        address: `Q${i}`,
        side: 'in',
        count: 1,
        findings: [],
        qort: 0n,
      })),
      both: extra,
    });
    expect(lowest(sides(both(2).both))).toBeLessThan(lowest(sides([])));
  });
});

describe('circleQort', () => {
  it('says the QORT beside a name short: whole from 100 up, two decimals below, four under 1', () => {
    expect(circleQort(500n * 100_000_000n)).toBe('500');
    expect(circleQort(123_456_789_000n)).toBe('1,235');
    expect(circleQort(7_650_000_000n)).toBe('76.5');
    expect(circleQort(25_000_000n)).toBe('0.25');
    expect(circleQort(0n)).toBeNull();
  });
});
