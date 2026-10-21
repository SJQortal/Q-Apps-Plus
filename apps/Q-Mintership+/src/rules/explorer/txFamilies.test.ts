import { describe, expect, it } from 'vitest';
import {
  ALL_TX_TYPES,
  familyOf,
  isTxFamilyKey,
  TX_FAMILIES,
  TX_TYPE_LABELS,
  txTypeLabel,
  typesFor,
} from './txFamilies';

describe('transaction families', () => {
  it("lists Core's 41 types once each", () => {
    expect(ALL_TX_TYPES).toHaveLength(41);
    expect(new Set(ALL_TX_TYPES).size).toBe(41);
    expect(ALL_TX_TYPES[0]).toBe('GENESIS');
    expect(ALL_TX_TYPES[37]).toBe('REWARD_SHARE'); // type 38
    expect(ALL_TX_TYPES[40]).toBe('PRESENCE'); // type 41
  });

  it('puts every type in exactly one family, and nothing else in any', () => {
    const seen = TX_FAMILIES.flatMap((family) => family.types);
    expect([...seen].sort()).toEqual([...ALL_TX_TYPES].sort());
    for (const type of ALL_TX_TYPES)
      expect(TX_FAMILIES.filter((family) => family.types.includes(type))).toHaveLength(1);
  });

  it('shows the families in order with plain labels', () => {
    expect(TX_FAMILIES.map((family) => family.label)).toEqual([
      'All',
      'Payments',
      'Names',
      'Minting',
      'Groups',
      'QDN data',
      'Trading',
      'Messages',
      'Other',
    ]);
  });

  it('finds the family of a type; unknown types are Other', () => {
    expect(familyOf('PAYMENT')).toBe('payments');
    expect(familyOf('MULTI_PAYMENT')).toBe('payments');
    expect(familyOf('BUY_NAME')).toBe('names');
    expect(familyOf('TRANSFER_PRIVS')).toBe('minting');
    expect(familyOf('ENABLE_FORGING')).toBe('minting');
    expect(familyOf('SET_GROUP')).toBe('groups');
    expect(familyOf('GROUP_APPROVAL')).toBe('groups');
    expect(familyOf('ARBITRARY')).toBe('qdn');
    expect(familyOf('AT')).toBe('trading');
    expect(familyOf('UPDATE_ASSET')).toBe('trading');
    expect(familyOf('CHAT')).toBe('messages');
    expect(familyOf('PUBLICIZE')).toBe('other');
    expect(familyOf('PRESENCE')).toBe('other');
    expect(familyOf('SOMETHING_NEW')).toBe('other');
  });

  it('gives the types to ask Core for; All asks for no type at all', () => {
    expect(typesFor('all')).toEqual([]);
    expect(typesFor('nope')).toEqual([]);
    expect(typesFor('payments')).toEqual(['PAYMENT', 'TRANSFER_ASSET', 'MULTI_PAYMENT']);
    expect(typesFor('messages')).toEqual(['MESSAGE', 'CHAT']);
    expect(typesFor('groups')).toHaveLength(13);
    expect(isTxFamilyKey('qdn')).toBe(true);
    expect(isTxFamilyKey('QDN')).toBe(false);
  });

  it('has words for every type', () => {
    for (const type of ALL_TX_TYPES) {
      const label = TX_TYPE_LABELS[type];
      expect(label, type).toMatch(/^[A-Z][^_]*$/);
      expect(txTypeLabel(type)).toBe(label);
    }
    expect(txTypeLabel('PAYMENT')).toBe('Payment');
    expect(txTypeLabel('REWARD_SHARE')).toBe('Reward share');
    expect(txTypeLabel('TRANSFER_PRIVS')).toBe('Minting level move');
    expect(txTypeLabel('REGISTER_NAME')).toBe('Name registration');
    expect(txTypeLabel('ARBITRARY')).toBe('QDN publish');
    expect(txTypeLabel('SOMETHING_NEW')).toBe('Something new');
    expect(txTypeLabel('')).toBe('Transaction');
  });
});
