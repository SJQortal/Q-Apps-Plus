/**
 * Base58 (Bitcoin alphabet), the encoding Qortal uses for addresses, public
 * keys, references, signatures and raw transaction bytes.
 */
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const INDEX = new Map<string, number>([...ALPHABET].map((char, i) => [char, i]));

export function base58Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  // Base-256 → base-58, most significant digit last.
  const digits: number[] = [];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = '1'.repeat(zeros);
  for (let k = digits.length - 1; k >= 0; k--) out += ALPHABET[digits[k]];
  return out;
}

/** Decode, or throw on a character outside the alphabet. */
export function base58Decode(text: string): Uint8Array {
  if (text.length === 0) return new Uint8Array(0);
  let zeros = 0;
  while (zeros < text.length && text[zeros] === '1') zeros++;
  const bytes: number[] = [];
  for (let i = zeros; i < text.length; i++) {
    const value = INDEX.get(text[i]);
    if (value === undefined) throw new Error(`Invalid base58 character "${text[i]}"`);
    let carry = value;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  const out = new Uint8Array(zeros + bytes.length);
  for (let k = 0; k < bytes.length; k++) out[zeros + k] = bytes[bytes.length - 1 - k];
  return out;
}

/** Decode and check the length, e.g. 32 for a public key or 64 for a signature. */
export function base58DecodeExact(text: string, length: number, what: string): Uint8Array {
  let bytes: Uint8Array;
  try {
    bytes = base58Decode(text);
  } catch {
    throw new Error(`${what} is not valid base58`);
  }
  if (bytes.length !== length) {
    throw new Error(`${what} must be ${length} bytes, got ${bytes.length}`);
  }
  return bytes;
}

/** Unsigned, byte-by-byte comparison (how Core's database orders binary values). */
export function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}
