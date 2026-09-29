import { describe, expect, it } from 'vitest';
import {
  base64EncodeString,
  base64ToBlob,
  base64ToObject,
  base64ToUint8Array,
  formatLegacyTimestamp,
  isBase58,
  isBase64,
  isQortalAddress,
  objectToBase64,
  randomID,
  uid,
  uint8ArrayToObject,
} from './util';

describe('randomID', () => {
  it('is six characters from the legacy alphabet', async () => {
    for (let i = 0; i < 50; i++) {
      expect(randomID()).toMatch(/^[A-Za-z0-9]{6}$/);
    }
    expect(await uid()).toMatch(/^[A-Za-z0-9]{6}$/);
  });
});

describe('formatLegacyTimestamp', () => {
  it('formats as YYYY-MM-DD @ HH:mm:ss in local time', () => {
    const date = new Date(2026, 8, 29, 7, 5, 9);
    expect(formatLegacyTimestamp(date)).toBe('2026-09-29 @ 07:05:09');
    expect(formatLegacyTimestamp(date.getTime())).toBe('2026-09-29 @ 07:05:09');
  });
});

describe('base58 / base64 / address checks', () => {
  it('recognises base58', () => {
    expect(isBase58('QdSnUy6sUiEnaN87dWmE92g1uQjrvPgrWG')).toBe(true);
    expect(isBase58('0OIl')).toBe(false);
    expect(isBase58('')).toBe(false);
    expect(isBase58(12)).toBe(false);
  });

  it('recognises base64 and can attempt a decode', () => {
    expect(isBase64('aGVsbG8=')).toBe(true);
    expect(isBase64('aGVsbG8')).toBe(false);
    expect(isBase64('not base64!')).toBe(false);
    expect(isBase64('====', true)).toBe(false);
  });

  it('recognises a Qortal address', () => {
    expect(isQortalAddress('QdSnUy6sUiEnaN87dWmE92g1uQjrvPgrWG')).toBe(true);
    expect(isQortalAddress('QdSnUy6sUiEnaN87dWmE92g1uQjrvPgrW')).toBe(false);
    expect(isQortalAddress('AdSnUy6sUiEnaN87dWmE92g1uQjrvPgrWG')).toBe(false);
  });
});

describe('base64 helpers', () => {
  it('encodes UTF-8 the way the legacy FileReader path did', () => {
    expect(base64EncodeString('hello')).toBe('aGVsbG8=');
    // "é" is two UTF-8 bytes; btoa alone would throw on it.
    expect(base64EncodeString('é')).toBe('w6k=');
  });

  it('round-trips objects, including non-Latin-1 text', () => {
    const value = { messageHtml: '<p>Salut é ✓</p>', attachments: [], replyTo: null };
    const encoded = objectToBase64(value);
    expect(encoded).toBe(btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value)))));
    expect(base64ToObject(encoded)).toEqual(value);
    expect(uint8ArrayToObject(base64ToUint8Array(encoded))).toEqual(value);
  });

  it('matches btoa(JSON.stringify()) for plain ASCII data, the legacy fallback', () => {
    const value = { header: 'x', content: 'y', timestamp: 1 };
    expect(objectToBase64(value)).toBe(btoa(JSON.stringify(value)));
  });

  it('builds a Blob with the given mime type', () => {
    const blob = base64ToBlob('aGVsbG8=', 'text/plain');
    expect(blob.type).toBe('text/plain');
    expect(blob.size).toBe(5);
  });
});
