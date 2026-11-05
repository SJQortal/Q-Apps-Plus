import { describe, expect, it } from 'vitest';
import { base64ToObject, objectToBase64, objectToUint8Array, uint8ArrayToBase64, uint8ArrayToObject } from './toBase64';

// Orders and store data cross QDN as base64 JSON. The round trip must stay
// byte-compatible with the original app.
describe('base64 helpers', () => {
  const order = { created: 1700000000000, details: { p1: { quantity: 2 } }, payment: { coin: 'QORT', total: 1.5 }, note: 'ünïcode ✓' };

  it('objectToBase64 -> base64ToObject round-trips an order', async () => {
    const encoded = await objectToBase64(order);
    expect(encoded).not.toContain('data:');
    expect(await base64ToObject(encoded)).toEqual(order);
  });

  it('uint8 helpers agree with the blob-based encoder', async () => {
    const viaBlob = await objectToBase64(order);
    const viaBytes = uint8ArrayToBase64(objectToUint8Array(order));
    expect(viaBytes).toBe(viaBlob);
    expect(uint8ArrayToObject(objectToUint8Array(order))).toEqual(order);
  });

  it('base64ToObject rejects non-JSON payloads', async () => {
    await expect(base64ToObject(btoa('not json'))).rejects.toBeInstanceOf(SyntaxError);
  });
});
