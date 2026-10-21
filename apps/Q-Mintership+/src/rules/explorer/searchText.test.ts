/**
 * What a search sees of an Explorer row: what the row shows (names known
 * for its accounts, amounts, its type, block, date and signature), never
 * what it hides.
 */
import { describe, expect, it } from 'vitest';
import type { TxRow } from '../../data/types';
import { accountSearchText, partSearchText, txSearchText } from './searchText';
import { describeTx } from './txWords';

const A = 'QZJc1V32oFm8tufB4bk7fa3aepu4EdkeDU';
const B = 'QLmZhiKfx6dtf87YXDeCRt7tJYpDTtVnX6';
const names = { nameOf: (address: string) => (address === B ? 'Bob Builder' : null) };

const row = (fields: Partial<TxRow>): TxRow => ({
  type: 'PAYMENT',
  timestamp: Date.UTC(2026, 9, 17, 9, 30),
  signature: 'SIG123',
  txGroupId: 0,
  blockHeight: 2_762_920,
  creatorAddress: A,
  ...fields,
});

describe('a row as text to search', () => {
  it('says an account by its name, when known, and its address', () => {
    expect(accountSearchText(B, names.nameOf)).toBe(`Bob Builder ${B}`);
    expect(accountSearchText(A, names.nameOf)).toBe(A);
    expect(partSearchText({ kind: 'amount', amount: '120', asset: 'QORT' }, names)).toBe(
      '120 QORT'
    );
    expect(partSearchText({ kind: 'group', groupId: 694 }, names)).toBe('MINTER');
    expect(
      partSearchText({ kind: 'group', groupId: 823 }, { ...names, groupNameOf: () => 'Q-Shop' })
    ).toBe('group #823 Q-Shop');
  });

  it('holds the sentence, the type, the block, the date and the signature', () => {
    const tx = row({ recipient: B, amount: '120.00000000' });
    const text = txSearchText(tx, describeTx(tx, { viewpoint: A }), names);
    expect(text).toContain('Sent 120 QORT to Bob Builder');
    expect(text).toContain('Payment');
    expect(text).toContain('Payments');
    expect(text).toContain('block 2,762,920');
    expect(text).toContain('17 Oct 2026');
    expect(text).toContain('SIG123');
  });

  it('never holds what a row hides: a message’s content, an encrypted resource’s identifier', () => {
    const message = row({ type: 'MESSAGE', recipient: B, data: 'SECRET-WORDS', isText: true });
    expect(txSearchText(message, describeTx(message, { viewpoint: A }), names)).not.toContain(
      'SECRET-WORDS'
    );
    const encrypted = row({
      type: 'ARBITRARY',
      service: 801,
      name: 'Bob',
      identifier: 'hidden-identifier',
    });
    expect(txSearchText(encrypted, describeTx(encrypted, { viewpoint: A }), names)).not.toContain(
      'hidden-identifier'
    );
  });
});
