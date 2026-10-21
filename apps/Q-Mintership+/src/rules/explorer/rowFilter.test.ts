import { describe, expect, it } from 'vitest';
import type { TxRow } from '../../data/types';
import { filterOn, NO_ROW_FILTER, rowMatches, shareKindOf } from './rowFilter';

const A = 'QZJc1V32oFm8tufB4bk7fa3aepu4EdkeDU';
const B = 'QLmZhiKfx6dtf87YXDeCRt7tJYpDTtVnX6';

const row = (fields: Partial<TxRow>): TxRow => ({
  type: 'PAYMENT',
  timestamp: 1,
  signature: 'sig',
  txGroupId: 0,
  ...fields,
});

describe('narrowing the rows read', () => {
  it('tells a self share, a share to another account and a removal apart', () => {
    const self = row({ type: 'REWARD_SHARE', creatorAddress: A, recipient: A, sharePercent: '0' });
    const other = row({ type: 'REWARD_SHARE', creatorAddress: A, recipient: B, sharePercent: '0' });
    const removal = row({
      type: 'REWARD_SHARE',
      creatorAddress: A,
      recipient: A,
      sharePercent: '-1.00',
    });
    expect([self, other, removal].map(shareKindOf)).toEqual(['self', 'other', 'removal']);
    expect(shareKindOf(row({}))).toBeNull();
    expect(rowMatches(self, { text: '', share: 'self' })).toBe(true);
    expect(rowMatches(removal, { text: '', share: 'self' })).toBe(false);
    expect(rowMatches(row({}), { text: '', share: 'other' })).toBe(false);
  });

  it('matches text anywhere in a transaction, ignoring case, and numbers whole', () => {
    const kick = row({ type: 'GROUP_KICK', groupId: 823, member: A, reason: 'Spam Bot' });
    expect(rowMatches(kick, { text: '823', share: 'any' })).toBe(true);
    expect(rowMatches(kick, { text: '#823', share: 'any' })).toBe(true);
    expect(rowMatches(kick, { text: '82', share: 'any' })).toBe(false);
    expect(rowMatches(kick, { text: 'spam', share: 'any' })).toBe(true);
    expect(rowMatches(kick, { text: A.toLowerCase(), share: 'any' })).toBe(true);
    const multi = row({ type: 'MULTI_PAYMENT', payments: [{ recipient: B, amount: '5.6789' }] });
    expect(rowMatches(multi, { text: '5.6789', share: 'any' })).toBe(true);
    expect(rowMatches(multi, { text: B, share: 'any' })).toBe(true);
  });

  it('matches the rows of a name’s owner, though no row holds the name', () => {
    const paid = row({ creatorAddress: A, recipient: B, amount: '1' });
    expect(rowMatches(paid, { text: 'Ravenstone', share: 'any' })).toBe(false);
    expect(rowMatches(paid, { text: 'Ravenstone', owner: B, share: 'any' })).toBe(true);
  });

  it('is off with no text and every kind', () => {
    expect(filterOn(NO_ROW_FILTER)).toBe(false);
    expect(filterOn({ text: '  ', share: 'any' })).toBe(false);
    expect(filterOn({ text: '', share: 'removal' })).toBe(true);
  });
});
