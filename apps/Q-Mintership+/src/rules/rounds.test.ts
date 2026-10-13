import { describe, expect, it } from 'vitest';
import type { TxRow } from '../data/types';
import { nominationRounds } from './rounds';

const ME = 'QMeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'.slice(0, 34);
const OTHER = 'QOtherrrrrrrrrrrrrrrrrrrrrrrrrrrrr'.slice(0, 34);
const ADMIN = 'QAdminnnnnnnnnnnnnnnnnnnnnnnnnnnnn'.slice(0, 34);
const MAX = 10_080;

let n = 0;
function invite(height: number | null, extra: Partial<TxRow> = {}): TxRow {
  n += 1;
  return {
    type: 'GROUP_INVITE',
    signature: `inv${n}`,
    timestamp: 1_000_000 + (height ?? 99_999) * 60_000,
    ...(height === null ? {} : { blockHeight: height }),
    txGroupId: 694,
    groupId: 694,
    creatorAddress: ADMIN,
    invitee: ME,
    approvalStatus: 'PENDING',
    ...extra,
  };
}

describe('nominationRounds', () => {
  it('lists each MINTER invite for them as a round, newest first, numbered from the first', () => {
    const rows = [
      invite(100, { approvalStatus: 'EXPIRED' }),
      invite(20_000, { approvalStatus: 'APPROVED', approvalHeight: 20_500 }),
      invite(50, { approvalStatus: 'NOT_REQUIRED' }),
    ];
    const rounds = nominationRounds(rows, ME, MAX);
    expect(rounds.map((r) => [r.number, r.outcome, r.decidedHeight])).toEqual([
      [3, 'approved', 20_500],
      [2, 'expired', 100 + MAX + 1],
      [1, 'applied', 50],
    ]);
    expect(rounds[0]).toMatchObject({ firstSigner: ADMIN, startedHeight: 20_000 });
  });

  it('leaves out other people’s invites, other groups and other kinds', () => {
    const rows = [
      invite(100, { invitee: OTHER }),
      invite(200, { groupId: 4242 }),
      { ...invite(300), type: 'GROUP_KICK', member: ME },
      invite(400),
    ];
    expect(nominationRounds(rows, ME, MAX).map((r) => r.startedHeight)).toEqual([400]);
  });

  it('adds a waiting invite the history doesn’t list yet, once', () => {
    const old = invite(100, { approvalStatus: 'EXPIRED' });
    const waiting = invite(null);
    const rounds = nominationRounds([old], ME, MAX, waiting);
    expect(rounds.map((r) => [r.number, r.outcome, r.startedHeight])).toEqual([
      [2, 'pending', null],
      [1, 'expired', 100],
    ]);
    // Once confirmed, the history's copy is the one shown.
    const confirmed = { ...waiting, blockHeight: 30_000 };
    expect(nominationRounds([old, confirmed], ME, MAX, waiting)).toHaveLength(2);
    expect(nominationRounds([old, confirmed], ME, MAX, waiting)[0].startedHeight).toBe(30_000);
  });

  it('has no rounds before a first signature', () => {
    expect(nominationRounds([], ME, MAX)).toEqual([]);
  });
});
