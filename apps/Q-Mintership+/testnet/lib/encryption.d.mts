/* Types for testnet/lib/encryption.mjs, for its TypeScript test. */
export interface HubKeyPair {
  /** Base58 of the 64-byte TweetNaCl secret key. */
  privateKey: string;
  /** Base58 public key. */
  publicKey: string;
}
export interface RandomOption {
  /** Stands in for crypto.getRandomValues (messageKey, nonce, keyNonce). */
  random?: (array: Uint8Array) => unknown;
}
export const HUB_ENCRYPTION_TEXT: Record<
  | 'encryptionFailed'
  | 'encrypt'
  | 'decrypt'
  | 'retrieveKeys'
  | 'invalidUint8'
  | 'symmetricKey'
  | 'includeData'
  | 'needsPublicKeys'
  | 'uploadEncryption',
  string
>;
export function hubBase58Decode(text: string): Uint8Array;
export function base64ToUint8Array(base64: string): Uint8Array;
export function uint8ArrayToBase64(bytes: Uint8Array): string;
export function uint8ArrayStartsWith(bytes: Uint8Array, text: string): boolean;
export function encryptDataGroup(
  input: {
    data64: string;
    publicKeys: string[];
    privateKey: string;
    userPublicKey: string;
    customSymmetricKey?: string;
  },
  options?: RandomOption
): string;
export function decryptGroupDataQortalRequest(data64: string, privateKey: string): Uint8Array;
export function decryptDeprecatedSingle(
  bytes: Uint8Array,
  publicKey: string,
  privateKey: Uint8Array
): string;
export function hubKeyPair(seed: Uint8Array): HubKeyPair;
export function encryptDataRequest(
  data: Record<string, unknown>,
  keyPair: HubKeyPair,
  options?: RandomOption
): string;
export function decryptDataRequest(data: Record<string, unknown>, keyPair: HubKeyPair): string;
export function publishData64(
  data: Record<string, unknown>,
  keyPair: HubKeyPair,
  options?: RandomOption
): string;
