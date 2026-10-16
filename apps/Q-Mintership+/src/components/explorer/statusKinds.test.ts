import { describe, expect, it } from 'vitest';
import { statusKindOf } from './statusKinds';

describe('statusKindOf', () => {
  it('reads each chip’s kind from the words the Explorer uses', () => {
    expect(statusKindOf('Minter Admin')).toBe('admin');
    expect(statusKindOf('Dev Admin')).toBe('devAdmin');
    expect(statusKindOf('MINTER member')).toBe('member');
    expect(statusKindOf('In MINTER')).toBe('member');
    expect(statusKindOf('In MINTER since 4 Aug 2026')).toBe('member');
    expect(statusKindOf('Minting now')).toBe('minting');
    expect(statusKindOf('Banned from MINTER')).toBe('banned');
    expect(statusKindOf('Minting penalty')).toBe('penalty');
    expect(statusKindOf('Former member')).toBe('former');
    expect(statusKindOf('Not in MINTER')).toBe('outside');
    expect(statusKindOf('Level 8')).toBe('level');
    expect(statusKindOf('its sponsor')).toBe('plain');
    expect(statusKindOf('has sent 500+ payments')).toBe('plain');
  });
});
