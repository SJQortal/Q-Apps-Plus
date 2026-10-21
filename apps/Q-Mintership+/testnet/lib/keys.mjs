/**
 * Keys for the private testnet (dev-only; never imported by the app).
 *
 * - Ed25519 keys from a 32-byte seed, as Qortal uses them.
 * - Qortal addresses: version 58 + RIPEMD160(SHA256(publicKey)) + a 4-byte
 *   double-SHA256 checksum, in Base58 (Core crypto/Crypto.java toAddress).
 * - The reward-share key a self-share mints with: SHA256 of the X25519 shared
 *   secret between the minter's key and the recipient's public key (Core
 *   PrivateKeyAccount.getRewardSharePrivateKey).
 *
 * Seeds are generated fresh for each testnet and stay in ~/.qmp-testnet
 * (mode 600). Nothing here ever prints a seed.
 */
import crypto from 'node:crypto';

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function base58Encode(bytes) {
  const input = Uint8Array.from(bytes);
  let zeros = 0;
  while (zeros < input.length && input[zeros] === 0) zeros++;
  let value = 0n;
  for (const byte of input) value = value * 256n + BigInt(byte);
  let out = '';
  while (value > 0n) {
    out = ALPHABET[Number(value % 58n)] + out;
    value /= 58n;
  }
  return '1'.repeat(zeros) + out;
}

export function base58Decode(text) {
  let value = 0n;
  for (const char of text) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error('Not Base58');
    value = value * 58n + BigInt(index);
  }
  const bytes = [];
  while (value > 0n) {
    bytes.unshift(Number(value % 256n));
    value /= 256n;
  }
  let zeros = 0;
  while (zeros < text.length && text[zeros] === '1') zeros++;
  return Uint8Array.from([...new Array(zeros).fill(0), ...bytes]);
}

const sha256 = (data) => crypto.createHash('sha256').update(data).digest();

const ED_PKCS8 = Buffer.from('302e020100300506032b657004220420', 'hex');
const X_PKCS8 = Buffer.from('302e020100300506032b656e04220420', 'hex');
const X_SPKI = Buffer.from('302a300506032b656e032100', 'hex');

function edPrivateKey(seed) {
  return crypto.createPrivateKey({
    key: Buffer.concat([ED_PKCS8, Buffer.from(seed)]),
    format: 'der',
    type: 'pkcs8',
  });
}

export function publicKeyOf(seed) {
  const jwk = crypto.createPublicKey(edPrivateKey(seed)).export({ format: 'jwk' });
  return Buffer.from(jwk.x, 'base64url');
}

export function addressOf(publicKey) {
  const hash = crypto.createHash('ripemd160').update(sha256(publicKey)).digest();
  const versioned = Buffer.concat([Buffer.from([58]), hash]);
  const checksum = sha256(sha256(versioned)).subarray(0, 4);
  return base58Encode(Buffer.concat([versioned, checksum]));
}

export function sign(seed, bytes) {
  return crypto.sign(null, Buffer.from(bytes), edPrivateKey(seed));
}

export function newSeed() {
  return crypto.randomBytes(32);
}

/** An account from a seed: seed (Buffer), publicKey (Base58), address. */
export function accountOf(seed) {
  const publicKey = publicKeyOf(seed);
  return { seed: Buffer.from(seed), publicKey: base58Encode(publicKey), address: addressOf(publicKey) };
}

// Curve25519 field prime.
const P = 2n ** 255n - 19n;

function modPow(base, exp) {
  let result = 1n;
  let b = ((base % P) + P) % P;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % P;
    b = (b * b) % P;
    e >>= 1n;
  }
  return result;
}

/** Ed25519 public key → X25519 public key: u = (1 + y) / (1 − y) mod p. */
function toX25519Public(edPublicKey) {
  const bytes = Buffer.from(edPublicKey);
  bytes[31] &= 0x7f;
  let y = 0n;
  for (let i = 31; i >= 0; i--) y = (y << 8n) + BigInt(bytes[i]);
  const u = ((1n + y) * modPow((1n - y + P) % P, P - 2n)) % P;
  const out = Buffer.alloc(32);
  let v = u;
  for (let i = 0; i < 32; i++) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

/** Ed25519 seed → X25519 scalar (SHA-512 of the seed, clamped). */
function toX25519Private(seed) {
  const h = crypto.createHash('sha512').update(seed).digest();
  const s = Buffer.from(h.subarray(0, 32));
  s[0] &= 0xf8;
  s[31] &= 0x7f;
  s[31] |= 0x40;
  return s;
}

/** The reward-share private key (a 32-byte seed) for minter → recipient. */
export function rewardShareSeed(minterSeed, recipientPublicKey) {
  const privateKey = crypto.createPrivateKey({
    key: Buffer.concat([X_PKCS8, toX25519Private(minterSeed)]),
    format: 'der',
    type: 'pkcs8',
  });
  const publicKey = crypto.createPublicKey({
    key: Buffer.concat([X_SPKI, toX25519Public(recipientPublicKey)]),
    format: 'der',
    type: 'spki',
  });
  return sha256(crypto.diffieHellman({ privateKey, publicKey }));
}
