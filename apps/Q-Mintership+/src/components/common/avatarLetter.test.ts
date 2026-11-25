import { describe, expect, it } from 'vitest';
import { avatarLetter } from './avatarLetter';

// Hub's Explorer port (2026-11-22): a name starting with an invisible character got an empty
// circle, and a combining mark was split off its letter.
describe('an avatar’s letter', () => {
  it('is the first visible letter, whole', () => {
    expect(avatarLetter('igorcoin')).toBe('I');
    expect(avatarLetter('​stone')).toBe('S');
    expect(avatarLetter('⁠﻿ golem')).toBe('G');
    expect(avatarLetter('éclair')).toBe('É');
    expect(avatarLetter('́x')).toBe('X');
    expect(avatarLetter('🐉 Dragon')).toBe('🐉');
    expect(avatarLetter('​')).toBe('?');
  });
});
