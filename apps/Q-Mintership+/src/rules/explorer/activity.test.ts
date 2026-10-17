import { describe, expect, it } from 'vitest';
import type { TimelineEvent } from '../../data/timeline';
import type { TxRow } from '../../data/types';
import {
  activityBuckets,
  axisTicks,
  chainMarks,
  familyCounts,
  minterMarks,
  rowsIn,
} from './activity';

const ME = 'QmeAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
let n = 0;
const tx = (type: string, timestamp: number, extra: Partial<TxRow> = {}): TxRow =>
  ({
    type,
    timestamp,
    signature: `sig${n++}`,
    txGroupId: 0,
    creatorAddress: ME,
    ...extra,
  }) as TxRow;

describe('activityBuckets', () => {
  const rows = [
    tx('PAYMENT', 5),
    tx('PAYMENT', 15),
    tx('ARBITRARY', 16),
    tx('REGISTER_NAME', 99),
    tx('PAYMENT', 150), // after `to`: left out
  ];

  it('counts each period by family, from `from` to `to`', () => {
    const b = activityBuckets(rows, { from: 0, to: 100, count: 10 });
    expect(b).toHaveLength(10);
    expect(b[0]).toMatchObject({ start: 0, end: 10, total: 1, byFamily: { payments: 1 } });
    expect(b[1]).toMatchObject({ total: 2, byFamily: { payments: 1, qdn: 1 } });
    expect(b[9]).toMatchObject({ total: 1, byFamily: { names: 1 }, end: 100 });
    expect(b.reduce((sum, x) => sum + x.total, 0)).toBe(4);
  });

  it('marks the periods before the oldest read as unread, never as empty', () => {
    const b = activityBuckets(rows, { from: 0, to: 100, count: 10, readFrom: 30 });
    expect(b.slice(0, 3).map((x) => x.unread)).toEqual([true, true, true]);
    expect(b[3].unread).toBe(false);
  });

  it('leaves hidden families out', () => {
    const b = activityBuckets(rows, { from: 0, to: 100, count: 10, hidden: new Set(['qdn']) });
    expect(b[1]).toMatchObject({ total: 1, byFamily: { payments: 1 } });
  });

  it('counts families, lists a period newest first, and spaces the axis', () => {
    expect(familyCounts(rows)).toMatchObject({ payments: 3, qdn: 1, names: 1, minting: 0 });
    expect(rowsIn(rows, 10, 20).map((r) => r.type)).toEqual(['ARBITRARY', 'PAYMENT']);
    expect(axisTicks(0, 100, 640)).toEqual([0, 25, 50, 75, 100]);
    expect(axisTicks(0, 100, 100)).toHaveLength(3);
  });
});

describe('chainMarks', () => {
  it('names, its first reward share and level moves, oldest first', () => {
    const marks = chainMarks(
      [
        tx('REWARD_SHARE', 50),
        tx('REGISTER_NAME', 10, { name: 'Ada' }),
        tx('REWARD_SHARE', 40),
        tx('BUY_NAME', 60, { name: 'Bob', creatorAddress: 'Qother', seller: ME }),
        tx('BUY_NAME', 70, { name: 'Cy' }),
        tx('UPDATE_NAME', 80, { name: 'Ada', newName: 'Ada L' }),
        tx('REGISTER_NAME', 90, { name: 'NotMine', creatorAddress: 'Qother' }),
        tx('TRANSFER_PRIVS', 95, { creatorAddress: 'Qother' }),
      ],
      ME
    );
    expect(marks.map((m) => [m.at, m.kind, m.label])).toEqual([
      [10, 'name', 'Registered the name “Ada”'],
      [40, 'minting', 'First reward share (minting)'],
      [60, 'name', 'Sold the name “Bob”'],
      [70, 'name', 'Bought the name “Cy”'],
      [80, 'name', 'Renamed “Ada” to “Ada L”'],
      [95, 'minting', 'Got a minting level'],
    ]);
    expect(marks.every((m) => m.signature)).toBe(true);
  });

  it('level moves in one block as one milestone, with how many', () => {
    const marks = chainMarks(
      [1, 2, 3].map((i) =>
        tx('TRANSFER_PRIVS', 100 + i, { creatorAddress: 'Qother', blockHeight: 1_585_006 })
      ),
      ME
    );
    expect(marks.map((m) => [m.at, m.label])).toEqual([
      [101, 'Got a minting level (3 transactions)'],
    ]);
  });

  it('names registered the same day as one milestone', () => {
    const DAY = 86_400_000;
    const marks = chainMarks(
      ['A', 'B', 'C', 'D'].map((name, i) => tx('REGISTER_NAME', 10 * DAY + i * 1000, { name })),
      ME
    );
    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({
      kind: 'name',
      names: 4,
      label: 'Registered 4 names: “A”, “B”, “C”, …',
    });
  });
});

describe('minterMarks', () => {
  const event = (over: Partial<TimelineEvent>): TimelineEvent =>
    ({
      signature: `e${n++}`,
      kind: 'join',
      outcome: 'done',
      subject: ME,
      at: 1,
      title: 'Joined MINTER',
      becameMember: false,
      endedMembership: false,
      joinRequest: false,
      decline: false,
      ...over,
    }) as TimelineEvent;

  it('the events about it that took effect, each kind its own', () => {
    const marks = minterMarks(
      [
        event({ at: 30, kind: 'addAdmin', title: 'Made a Minter Admin' }),
        event({ at: 10, joinRequest: true, title: 'Asked to join MINTER' }),
        event({ at: 20, becameMember: true, title: 'Joined MINTER' }),
        event({ at: 40, kind: 'kick', title: 'Removed from MINTER' }),
        event({ at: 50, kind: 'ban', outcome: 'expired', title: 'Ban proposed' }),
        event({ at: 60, kind: 'ban', subject: 'Qother', title: 'Banned from MINTER' }),
      ],
      ME
    );
    expect(marks.map((m) => [m.at, m.kind, m.label])).toEqual([
      [10, 'asked', 'Asked to join MINTER'],
      [20, 'joined', 'Joined MINTER'],
      [30, 'admin', 'Made a Minter Admin'],
      [40, 'removed', 'Removed from MINTER'],
    ]);
  });
});
