import { describe, expect, it } from 'vitest';
import { circleNodes } from './circle';
import { recordedFindings } from './findings';
import { partsText } from './findings';
import {
  fillParts,
  tradeParts,
  tradesByAccount,
  tradesCoverage,
  tradesFindingParts,
  type AssetTrade,
} from './trades';

const A = `Q${'a'.repeat(33)}`;
const B = `Q${'b'.repeat(33)}`;
const C = `Q${'c'.repeat(33)}`;
const names: Record<string, string> = { [A]: 'Simon', [B]: 'igorcoin', [C]: 'Cleo' };
const nameOf = (address: string) => names[address] ?? null;
const text = (parts: Parameters<typeof partsText>[0]) =>
  partsText(parts, nameOf).replace(/ \(Q\w+…\w+\)/g, '');

const QORT = (amount: string) => ({ assetId: 0, asset: 'QORT', amount });
const IGOR = (amount: string) => ({ assetId: 11, asset: 'igorcoin', amount });
const GBC = (amount: string) => ({ assetId: 6, asset: 'GBC', amount });

function trade(over: Partial<AssetTrade>): AssetTrade {
  return {
    orderId: 'mine',
    otherOrderId: 'theirs',
    self: A,
    other: B,
    timestamp: Date.UTC(2026, 6, 29),
    height: 2_667_000,
    initiated: true,
    gave: QORT('529.00000000'),
    got: IGOR('23.00000000'),
    txs: [],
    ...over,
  };
}

describe('a trade in words (Simon, 2026-10-21)', () => {
  it('buying with QORT, selling for QORT, and two assets', () => {
    expect(text(tradeParts(trade({})))).toBe('Bought 23 igorcoin from igorcoin for 529 QORT');
    expect(text(tradeParts(trade({ self: B, other: A, gave: IGOR('23'), got: QORT('529') })))).toBe(
      'Sold 23 igorcoin to Simon for 529 QORT'
    );
    expect(text(tradeParts(trade({ gave: GBC('5'), got: IGOR('2') })))).toBe(
      'Traded 5 GBC for 2 igorcoin with igorcoin'
    );
    expect(text(tradeParts(trade({ other: null })))).toBe(
      'Bought 23 igorcoin from an account that couldn’t be read for 529 QORT'
    );
    expect(text(fillParts(trade({})))).toBe(
      'Bought 23 igorcoin from igorcoin for 529 QORT · 29 Jul 2026'
    );
  });

  it('several with one account add up, by what came in and went out', () => {
    const trades = [
      trade({}),
      trade({ gave: QORT('100'), got: IGOR('4') }),
      trade({ gave: GBC('2'), got: QORT('10') }),
    ];
    expect(text(tradesFindingParts(B, trades))).toBe(
      '3 asset trades with igorcoin: got 27 igorcoin and 10 QORT, gave 2 GBC and 629 QORT'
    );
  });

  it('groups by the other account, the busiest first, and leaves out trades with itself', () => {
    const grouped = tradesByAccount([
      trade({ other: C, timestamp: 5 }),
      trade({ timestamp: 1 }),
      trade({ timestamp: 3 }),
      trade({ other: A }),
      trade({ other: null }),
    ]);
    expect(grouped.map(([other, list]) => [other, list.map((t) => t.timestamp)])).toEqual([
      [B, [3, 1]],
      [C, [5]],
    ]);
  });

  it('says how much was read', () => {
    expect(tradesCoverage({ orders: 7, truncated: false })).toBe(
      'Asset trades: every filled order (7).'
    );
    expect(tradesCoverage({ orders: 0, truncated: false })).toBe(
      'Asset trades: every filled order (none).'
    );
    expect(tradesCoverage({ orders: 200, truncated: true })).toBe(
      'Asset trades: its newest 200 filled orders.'
    );
  });
});

describe('trades among the findings and on the circle', () => {
  it('one finding per account, after names and before payments; drawn both ways', () => {
    const findings = recordedFindings({
      trades: [
        trade({}),
        trade({
          gave: QORT('100'),
          got: IGOR('4'),
          height: 2_668_000,
          timestamp: Date.UTC(2026, 7, 2),
        }),
      ],
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ kind: 'traded', other: B, count: 2, height: 2_668_000 });
    const circle = circleNodes(findings);
    expect(circle.both).toHaveLength(1);
    const node = circle.both[0];
    expect(node.findings).toHaveLength(1);
    expect(node.split?.in).toMatchObject({
      count: 2,
      qort: 0n,
      assets: [{ asset: 'igorcoin', atomic: 2_700_000_000n }],
    });
    expect(node.split?.out).toMatchObject({ count: 2, qort: 62_900_000_000n, assets: [] });
  });
});
