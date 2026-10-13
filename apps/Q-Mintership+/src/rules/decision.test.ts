import { describe, expect, it } from 'vitest';
import { KIND_LABEL, decisionTitle, isOwnAdminChange, type DecisionKind } from './decision';

const A = 'QAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'.slice(0, 34);
const B = 'QBbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'.slice(0, 34);

describe('decisionTitle', () => {
  it('says Become a Minter Admin or Step down as Minter Admin for one’s own admin change', () => {
    expect(decisionTitle({ kind: 'addAdmin', subject: A, creatorAddress: A })).toBe(
      'Become a Minter Admin'
    );
    expect(decisionTitle({ kind: 'removeAdmin', subject: A, creatorAddress: A })).toBe(
      'Step down as Minter Admin'
    );
  });

  it('keeps the kind’s own words otherwise', () => {
    expect(decisionTitle({ kind: 'addAdmin', subject: A, creatorAddress: B })).toBe(
      'Make a Minter Admin'
    );
    expect(decisionTitle({ kind: 'removeAdmin', subject: A, creatorAddress: B })).toBe(
      'Remove a Minter Admin'
    );
    const kinds: DecisionKind[] = ['invite', 'cancelInvite', 'kick', 'ban', 'cancelBan', 'other'];
    for (const kind of kinds)
      expect(decisionTitle({ kind, subject: A, creatorAddress: A })).toBe(KIND_LABEL[kind]);
  });

  it('never calls a change with no subject someone’s own', () => {
    expect(isOwnAdminChange({ kind: 'addAdmin', subject: null, creatorAddress: null })).toBe(false);
    expect(isOwnAdminChange({ kind: 'removeAdmin', subject: A, creatorAddress: null })).toBe(false);
  });
});
