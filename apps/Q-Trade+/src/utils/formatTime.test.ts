import { describe, expect, it } from 'vitest';
import { formatTime } from './formatTime';
import { cropAddress } from './cropAddress';

describe('formatTime', () => {
  it('formats seconds as m:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(600)).toBe('10:00');
  });
});

describe('cropAddress', () => {
  it('keeps the first and last five characters', () => {
    expect(cropAddress('QdSnUy6sUiEnaN87dWmE4rTaaUXn9dgv7d')).toBe('QdSnU...dgv7d');
  });
  it('accepts a custom range', () => {
    expect(cropAddress('QdSnUy6sUiEnaN87dWmE4rTaaUXn9dgv7d', 3)).toBe('QdS...v7d');
  });
});
