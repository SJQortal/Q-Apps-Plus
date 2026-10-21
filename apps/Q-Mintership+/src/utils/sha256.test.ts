import { describe, expect, it } from 'vitest';
import { qappHash, sha256 } from './sha256';

const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const utf8 = (text: string) => new TextEncoder().encode(text);

describe('SHA-256', () => {
  it('matches the standard digests, across block boundaries', () => {
    expect(hex(sha256(utf8('')))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
    expect(hex(sha256(utf8('abc')))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
    expect(hex(sha256(utf8('qtube_vid_test_abc_metadata')))).toBe(
      'bff16ee6b556e25a7b1d690f57e686a19ed18e9d411324b6be1fb25968da3051'
    );
    expect(hex(sha256(utf8('x'.repeat(100))))).toBe(
      '09ecb6ebc8bcefc733f6f2ec44f791abeed6a99edf0cc31519637898aebd52d8'
    );
  });

  it('hashes as qapp-core does: Quitter’s app hash, from its name and salt', () => {
    expect(qappHash('quitter', 14, '6hMqDBxky6j1G2wZEHgIiOeApj3x3CP8LQwg0Ok0RVc=')).toBe(
      'MhNiRYdzkaP9dz'
    );
    expect(qappHash('quitter', 20, '6hMqDBxky6j1G2wZEHgIiOeApj3x3CP8LQwg0Ok0RVc=')).toBe(
      'MhNiRYdzkaP9dzJuk0F9'
    );
  });
});
