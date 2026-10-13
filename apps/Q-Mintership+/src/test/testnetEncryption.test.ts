/**
 * The testnet's test signer encrypts and decrypts with Hub's own group
 * encryption (testnet/lib/encryption.mjs), so Minter Admin polls written on
 * the testnet are what Hub would write. Dev-only code, checked here without
 * a node: a fixed vector made by running Hub's group-encryption.ts, and
 * round trips with fresh keys.
 */
import { describe, expect, it } from 'vitest';
import {
  HUB_ENCRYPTION_TEXT,
  base64ToUint8Array,
  decryptDataRequest,
  encryptDataGroup,
  encryptDataRequest,
  hubBase58Decode,
  hubKeyPair,
  publishData64,
  uint8ArrayToBase64,
  type HubKeyPair,
} from '../../testnet/lib/encryption.mjs';

const fromHex = (hex: string) => Uint8Array.from(hex.match(/../g) ?? [], (b) => parseInt(b, 16));
const toData64 = (text: string) => uint8ArrayToBase64(new TextEncoder().encode(text));
const fromData64 = (data64: string) => new TextDecoder().decode(base64ToUint8Array(data64));
const freshKeys = (): HubKeyPair =>
  hubKeyPair(globalThis.crypto.getRandomValues(new Uint8Array(32)));

/**
 * Made by Qortal-Hub's src/qdn/encryption/group-encryption.ts itself
 * (encryptDataGroup, with crypto.getRandomValues returning these bytes):
 * A encrypts a vote to A, B and C. D is no reader.
 */
const HUB_VECTOR = {
  seeds: {
    A: '8ffe40149355718115920e46bb4fadba144ffa092904a915c2738318ea0bda09',
    B: '4897159fd5f317953f1cd99f527700cc930d39e246d911fb1ad43192a51041e7',
    C: '1254ed7797191f579b5a9594d8abe63649f14d0f69672926d44a7a298e2f97b5',
    D: '89561d89fe0a4da86d2b0e607e59523544b26613eba2bf6da8ceda955703920f',
  },
  publicKeys: {
    A: '6J4f2MrvmHY8U83Mw4G7a6yuJFpxTPj2P6R6DpuExYqN',
    B: '3USKYu6cTiGB8gsiJURhioxZ8otvjrx9Z3tjcpa48GRC',
    C: '7vkCHXffrR6azYWin8FWvnNSC9XaQt6RToJGTJU7pMuH',
    D: '87pNUJH1eg1obwJ5RLuSUd1LM6vqTEMomMFKGMRFbQ71',
  },
  messageKey: '1e2e4052630ef4fd0411c793b70e14f05551d24199563b1de7e13cd72daacd88',
  nonce: '1a8485a87a1e825bbb646f0f54789181d1e3379be70ed355',
  keyNonce: '25c853560bd5a33aa8635f25cde64c3be392ae043b9d709b',
  body: '{"v":1,"pollId":"abcd1234","vote":"yes"}',
  encrypted:
    'cW9ydGFsR3JvdXBFbmNyeXB0ZWREYXRhGoSFqHoeglu7ZG8PVHiRgdHjN5vnDtNVJchTVgvVozqoY18lzeZMO+OSrgQ7nXCbTqlxFylwkCjVk5y4aT1nw+Q1sK706OjX1Ic1Fts1G/lmMmFupWzpXUy79lIVws/7uE8bz/ltyx3UCQ8RV8ji6mip325iip0BQS2hJzeMo+i1DweKxiSMnauP2z65tLPmR5R2oWS2ob9AGTKR3VHPUnddV7okj9zETVOZ2wulO0nXdTkldhgnnPgTtIdoAusDwGTahNJ0cOJ4upLr4eM32lSFVhSb2ciHGMJNpIMzm4vxmUd4IKZ89UWn4/YLz+gpMXShsSU1gEeM4t76u21TppehxCcQfA3cDQu/0o1b72kBNdZLXQfOpwMAAAA=',
};

const vectorKeys = Object.fromEntries(
  Object.entries(HUB_VECTOR.seeds).map(([label, seed]) => [label, hubKeyPair(fromHex(seed))])
) as Record<'A' | 'B' | 'C' | 'D', HubKeyPair>;

/** Hands out the vector's random bytes in Hub's order: messageKey, nonce, keyNonce. */
function fixedRandom() {
  const bytes = [HUB_VECTOR.messageKey, HUB_VECTOR.nonce, HUB_VECTOR.keyNonce].map(fromHex);
  return (array: Uint8Array) => {
    const next = bytes.shift();
    if (!next || next.length !== array.length) throw new Error('unexpected random request');
    array.set(next);
  };
}

const failure = (run: () => unknown): string => {
  try {
    run();
  } catch (error) {
    return (error as Error).message;
  }
  return 'no error';
};

describe('the test signer’s encryption is Hub’s', () => {
  it('makes the same key pairs as Hub (Base58 public key of each seed)', () => {
    for (const label of ['A', 'B', 'C', 'D'] as const)
      expect(vectorKeys[label].publicKey).toBe(HUB_VECTOR.publicKeys[label]);
  });

  it('writes byte for byte what Hub’s encryptDataGroup wrote (fixed vector)', () => {
    const { A, B, C } = vectorKeys;
    const encrypted = encryptDataGroup(
      {
        data64: toData64(HUB_VECTOR.body),
        publicKeys: [A.publicKey, B.publicKey, C.publicKey],
        privateKey: A.privateKey,
        userPublicKey: A.publicKey,
      },
      { random: fixedRandom() }
    );
    expect(encrypted).toBe(HUB_VECTOR.encrypted);
  });

  it('decrypts Hub’s vector for each of its three readers, and not for a fourth key', () => {
    for (const label of ['A', 'B', 'C'] as const)
      expect(
        fromData64(decryptDataRequest({ encryptedData: HUB_VECTOR.encrypted }, vectorKeys[label]))
      ).toBe(HUB_VECTOR.body);
    expect(
      failure(() => decryptDataRequest({ encryptedData: HUB_VECTOR.encrypted }, vectorKeys.D))
    ).toBe(HUB_ENCRYPTION_TEXT.decrypt);
  });

  it('round-trips a publish encrypted to three keys: each reader decrypts, a fourth key fails', () => {
    const [writer, second, third, outsider] = [freshKeys(), freshKeys(), freshKeys(), freshKeys()];
    const body = JSON.stringify({ v: 1, pollId: 'k3x9q2m7', vote: 'neutral' });
    const encrypted = publishData64(
      {
        action: 'PUBLISH_QDN_RESOURCE',
        service: 'DOCUMENT_PRIVATE',
        data64: toData64(body),
        encrypt: true,
        publicKeys: [writer.publicKey, second.publicKey, third.publicKey],
      },
      writer
    );
    const bytes = base64ToUint8Array(encrypted);
    // Core takes it as a private service's data: it starts with Hub's marker.
    expect(new TextDecoder().decode(bytes.slice(0, 24))).toBe('qortalGroupEncryptedData');
    // marker, nonce, keyNonce, sender's key, data + tag, 3 keys of 48, the count.
    expect(bytes.length).toBe(24 + 24 + 24 + 32 + (body.length + 16) + 3 * 48 + 4);
    expect([...bytes.slice(72, 104)]).toEqual([...hubBase58Decode(writer.publicKey)]);
    expect(new DataView(bytes.buffer).getUint32(bytes.length - 4, true)).toBe(3);
    for (const reader of [writer, second, third])
      expect(fromData64(decryptDataRequest({ encryptedData: encrypted }, reader))).toBe(body);
    expect(failure(() => decryptDataRequest({ encryptedData: encrypted }, outsider))).toBe(
      'Unable to decrypt'
    );
  });

  it('always adds the writer, as Hub does, even when they leave their own key out', () => {
    const [writer, reader] = [freshKeys(), freshKeys()];
    const encrypted = publishData64(
      { data64: toData64('hello'), encrypt: true, publicKeys: [reader.publicKey] },
      writer
    );
    const bytes = base64ToUint8Array(encrypted);
    expect(new DataView(bytes.buffer).getUint32(bytes.length - 4, true)).toBe(2);
    expect(fromData64(decryptDataRequest({ encryptedData: encrypted }, writer))).toBe('hello');
    expect(fromData64(decryptDataRequest({ encryptedData: encrypted }, reader))).toBe('hello');
  });

  it('ENCRYPT_DATA without keys encrypts to the account alone', () => {
    const [me, other] = [freshKeys(), freshKeys()];
    const encrypted = encryptDataRequest({ data64: toData64('only me') }, me);
    expect(fromData64(decryptDataRequest({ encryptedData: encrypted }, me))).toBe('only me');
    expect(failure(() => decryptDataRequest({ encryptedData: encrypted }, other))).toBe(
      'Unable to decrypt'
    );
  });

  it('leaves a publish without `encrypt` as it was', () => {
    const data64 = toData64('{"v":1}');
    expect(publishData64({ data64 }, freshKeys())).toBe(data64);
  });

  it('fails with Hub’s words', () => {
    const me = freshKeys();
    const data64 = toData64('x');
    expect(failure(() => publishData64({ data64, encrypt: true }, me))).toBe(
      'Encrypting data requires public keys'
    );
    expect(failure(() => publishData64({ data64, encrypt: true, publicKeys: [] }, me))).toBe(
      'Encrypting data requires public keys'
    );
    expect(failure(() => publishData64({ data64, encrypt: true, publicKeys: ['0OIl'] }, me))).toBe(
      'Encryption failed'
    );
    expect(failure(() => encryptDataRequest({}, me))).toBe('Please include data to encrypt');
    expect(failure(() => decryptDataRequest({}, me))).toBe('Missing fields: encryptedData');
    expect(failure(() => decryptDataRequest({ encryptedData: data64 }, me))).toBe(
      'Unable to encrypt'
    );
  });
});
