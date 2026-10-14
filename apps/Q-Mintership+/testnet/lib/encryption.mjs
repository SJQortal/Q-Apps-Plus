/**
 * Hub's QDN encryption, for the private testnet's test signer (lib/hub.mjs).
 * Dev-only: the app never imports it, and the build never contains it.
 *
 * Ported from Qortal-Hub, keeping its steps and its English error texts:
 *
 * - src/qdn/encryption/group-encryption.ts: encryptDataGroup,
 *   decryptGroupDataQortalRequest, decryptDeprecatedSingle,
 *   uint8ArrayStartsWith, base64ToUint8Array, uint8ArrayToBase64;
 * - src/qortal/get.ts: what ENCRYPT_DATA (encryptData), DECRYPT_DATA
 *   (decryptData) and PUBLISH_QDN_RESOURCE with `encrypt` do with them;
 * - the helpers they use: Hub's copies of TweetNaCl's nacl-fast (secretbox,
 *   scalarmult) and of ed2curve (Ed25519 keys to X25519) are the npm
 *   packages tweetnacl 1.0.3 and ed2curve 0.3.0 here (dev dependencies, the
 *   same code), and Hub's Base58.decode is copied below.
 *
 * The group format Hub writes ("qortalGroupEncryptedData"):
 *
 *   marker (24 bytes) | nonce (24) | keyNonce (24) | sender's public key (32)
 *   | secretbox(data, nonce, messageKey)
 *   | per reader, 48 bytes: secretbox(messageKey, keyNonce, X25519(sender, reader))
 *   | the number of readers (Uint32, in the machine's byte order)
 *
 * Hub always adds the sender's own key to the readers. A reader's key pair
 * is Hub's: Base58 of the 64-byte TweetNaCl secret key and the public key.
 */
import crypto from 'node:crypto';
import ed2curve from 'ed2curve';
import nacl from 'tweetnacl';
import { base58Encode } from './keys.mjs';

/** Hub's English texts (i18n keys question:… and auth:…, first letter capitalised). */
export const HUB_ENCRYPTION_TEXT = {
  encryptionFailed: 'Encryption failed',
  encrypt: 'Unable to encrypt',
  decrypt: 'Unable to decrypt',
  retrieveKeys: 'Unable to retrieve keys',
  invalidUint8: "The Uint8ArrayData you've submitted is invalid",
  symmetricKey: 'Cannot create symmetric key',
  includeData: 'Please include data to encrypt',
  needsPublicKeys: 'Encrypting data requires public keys',
  uploadEncryption: 'Upload failed due to failed encryption',
};

const GROUP_MARKER = 'qortalGroupEncryptedData';
const SINGLE_MARKER = 'qortalEncryptedData';

// ---- Hub's Base58.decode (src/encryption/Base58.ts) ------------------------------

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const ALPHABET_MAP = Object.create(null);
for (let i = 0; i < ALPHABET.length; i++) ALPHABET_MAP[ALPHABET.charAt(i)] = i;

export function hubBase58Decode(string) {
  if (string.length === 0) return new Uint8Array(0);
  const bytes = [0];
  let i = 0;
  while (i < string.length) {
    const c = string[i];
    if (!(c in ALPHABET_MAP)) {
      throw new Error(
        "Base58.decode received unacceptable input. Character '" +
          c +
          "' is not in the Base58 alphabet."
      );
    }
    let j = 0;
    while (j < bytes.length) {
      bytes[j] *= 58;
      j++;
    }
    bytes[0] += ALPHABET_MAP[c];
    let carry = 0;
    j = 0;
    while (j < bytes.length) {
      bytes[j] += carry;
      carry = bytes[j] >> 8;
      bytes[j] &= 0xff;
      ++j;
    }
    while (carry) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
    i++;
  }
  i = 0;
  while (string[i] === '1' && i < string.length - 1) {
    bytes.push(0);
    i++;
  }
  return new Uint8Array(bytes.reverse());
}

// ---- group-encryption.ts ---------------------------------------------------------

export function base64ToUint8Array(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

export function uint8ArrayToBase64(uint8Array) {
  const length = uint8Array.length;
  let binaryString = '';
  const chunkSize = 1024 * 1024;
  for (let i = 0; i < length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, length));
    binaryString += Array.from(chunk, (byte) => String.fromCharCode(byte)).join('');
  }
  return btoa(binaryString);
}

export function uint8ArrayStartsWith(uint8Array, string) {
  const stringUint8Array = new TextEncoder().encode(string);
  if (uint8Array.length < stringUint8Array.length) return false;
  for (let i = 0; i < stringUint8Array.length; i++) {
    if (uint8Array[i] !== stringUint8Array[i]) return false;
  }
  return true;
}

const webRandom = (array) => globalThis.crypto.getRandomValues(array);

/**
 * Hub's encryptDataGroup: `data64` encrypted to `publicKeys` and the
 * sender (`userPublicKey`, with `privateKey`), as Base64. `random` stands in
 * for crypto.getRandomValues (tests pass fixed bytes): messageKey, nonce,
 * keyNonce, in that order.
 */
export function encryptDataGroup(
  { data64, publicKeys, privateKey, userPublicKey, customSymmetricKey },
  { random = webRandom } = {}
) {
  const combinedPublicKeys = [...publicKeys, userPublicKey];
  const decodedPrivateKey = hubBase58Decode(privateKey);
  const publicKeysDuplicateFree = [...new Set(combinedPublicKeys)];
  const Uint8ArrayData = base64ToUint8Array(data64);
  if (!(Uint8ArrayData instanceof Uint8Array)) throw new Error(HUB_ENCRYPTION_TEXT.invalidUint8);
  try {
    let messageKey;
    if (customSymmetricKey) {
      messageKey = base64ToUint8Array(customSymmetricKey);
    } else {
      messageKey = new Uint8Array(32);
      random(messageKey);
    }
    if (!messageKey) throw new Error(HUB_ENCRYPTION_TEXT.symmetricKey);
    const nonce = new Uint8Array(24);
    random(nonce);
    const encryptedData = nacl.secretbox(Uint8ArrayData, nonce, messageKey);
    const keyNonce = new Uint8Array(24);
    random(keyNonce);
    const encryptedKeys = [];
    publicKeysDuplicateFree.forEach((recipientPublicKey) => {
      const publicKeyUint8Array = hubBase58Decode(recipientPublicKey);
      const convertedPrivateKey = ed2curve.convertSecretKey(decodedPrivateKey);
      const convertedPublicKey = ed2curve.convertPublicKey(publicKeyUint8Array);
      const sharedSecret = new Uint8Array(32);
      nacl.lowlevel.crypto_scalarmult(sharedSecret, convertedPrivateKey, convertedPublicKey);
      encryptedKeys.push(nacl.secretbox(messageKey, keyNonce, sharedSecret));
    });
    const strUint8Array = new TextEncoder().encode(GROUP_MARKER);
    const senderPublicKeyUint8Array = hubBase58Decode(userPublicKey);
    let combinedDataSize =
      strUint8Array.length +
      nonce.length +
      keyNonce.length +
      senderPublicKeyUint8Array.length +
      encryptedData.length +
      4;
    for (const key of encryptedKeys) combinedDataSize += key.length;
    const combinedData = new Uint8Array(combinedDataSize);
    combinedData.set(strUint8Array);
    combinedData.set(nonce, strUint8Array.length);
    combinedData.set(keyNonce, strUint8Array.length + nonce.length);
    combinedData.set(
      senderPublicKeyUint8Array,
      strUint8Array.length + nonce.length + keyNonce.length
    );
    combinedData.set(
      encryptedData,
      strUint8Array.length + nonce.length + keyNonce.length + senderPublicKeyUint8Array.length
    );
    let encryptedKeysOffset =
      strUint8Array.length +
      nonce.length +
      keyNonce.length +
      senderPublicKeyUint8Array.length +
      encryptedData.length;
    for (const key of encryptedKeys) {
      combinedData.set(key, encryptedKeysOffset);
      encryptedKeysOffset += key.length;
    }
    const countArray = new Uint8Array(new Uint32Array([publicKeysDuplicateFree.length]).buffer);
    combinedData.set(countArray, combinedData.length - 4);
    return uint8ArrayToBase64(combinedData);
  } catch {
    throw new Error(HUB_ENCRYPTION_TEXT.encryptionFailed);
  }
}

/**
 * Hub's decryptGroupDataQortalRequest: the plain bytes, when `privateKey`'s
 * account is one of the readers; "Unable to decrypt" otherwise.
 */
export function decryptGroupDataQortalRequest(data64EncryptedData, privateKey) {
  const allCombined = base64ToUint8Array(data64EncryptedData);
  const strUint8Array = new TextEncoder().encode(GROUP_MARKER);
  const nonceStartPosition = strUint8Array.length;
  const nonceEndPosition = nonceStartPosition + 24;
  const nonce = allCombined.slice(nonceStartPosition, nonceEndPosition);
  const keyNonceStartPosition = nonceEndPosition;
  const keyNonceEndPosition = keyNonceStartPosition + 24;
  const keyNonce = allCombined.slice(keyNonceStartPosition, keyNonceEndPosition);
  const senderPublicKeyStartPosition = keyNonceEndPosition;
  const senderPublicKeyEndPosition = senderPublicKeyStartPosition + 32;
  const senderPublicKey = allCombined.slice(
    senderPublicKeyStartPosition,
    senderPublicKeyEndPosition
  );
  const countStartPosition = allCombined.length - 4;
  const countArray = allCombined.slice(countStartPosition, countStartPosition + 4);
  const count = new Uint32Array(countArray.buffer)[0];
  const encryptedDataStartPosition = senderPublicKeyEndPosition;
  const encryptedDataEndPosition = allCombined.length - (count * (32 + 16) + 4);
  const encryptedData = allCombined.slice(encryptedDataStartPosition, encryptedDataEndPosition);
  const combinedKeys = allCombined.slice(
    encryptedDataEndPosition,
    encryptedDataEndPosition + count * 48
  );
  if (!privateKey) throw new Error(HUB_ENCRYPTION_TEXT.retrieveKeys);
  const decodedPrivateKey = hubBase58Decode(privateKey);
  const convertedPrivateKey = ed2curve.convertSecretKey(decodedPrivateKey);
  const convertedSenderPublicKey = ed2curve.convertPublicKey(senderPublicKey);
  const sharedSecret = new Uint8Array(32);
  nacl.lowlevel.crypto_scalarmult(sharedSecret, convertedPrivateKey, convertedSenderPublicKey);
  for (let i = 0; i < count; i++) {
    const encryptedKey = combinedKeys.slice(i * 48, (i + 1) * 48);
    const decryptedKey = nacl.secretbox.open(encryptedKey, keyNonce, sharedSecret);
    if (decryptedKey) {
      const decryptedData = nacl.secretbox.open(encryptedData, nonce, decryptedKey);
      if (decryptedData) return decryptedData;
    }
  }
  throw new Error(HUB_ENCRYPTION_TEXT.decrypt);
}

/** Hub's decryptDeprecatedSingle (the older one-to-one "qortalEncryptedData"). */
export function decryptDeprecatedSingle(uint8Array, publicKey, privateKey) {
  const strUint8Array = new TextEncoder().encode(SINGLE_MARKER);
  const nonce = uint8Array.slice(strUint8Array.length, strUint8Array.length + 24);
  const _encryptedData = uint8Array.slice(strUint8Array.length + 24);
  const _publicKey = hubBase58Decode(publicKey);
  if (!privateKey || !_publicKey) throw new Error(HUB_ENCRYPTION_TEXT.retrieveKeys);
  const convertedPrivateKey = ed2curve.convertSecretKey(privateKey);
  const convertedPublicKey = ed2curve.convertPublicKey(_publicKey);
  const sharedSecret = new Uint8Array(32);
  nacl.lowlevel.crypto_scalarmult(sharedSecret, convertedPrivateKey, convertedPublicKey);
  const chatEncryptionSeed = new Uint8Array(
    crypto.createHash('sha256').update(sharedSecret).digest()
  );
  const decrypted = nacl.secretbox.open(_encryptedData, nonce, chatEncryptionSeed);
  if (!decrypted) throw new Error(HUB_ENCRYPTION_TEXT.decrypt);
  return uint8ArrayToBase64(decrypted);
}

// ---- the requests (get.ts) -------------------------------------------------------

/** An account's key pair as Hub keeps it (getKeyPair): Base58 secret key (64 bytes) and public key. */
export function hubKeyPair(seed) {
  const pair = nacl.sign.keyPair.fromSeed(Uint8Array.from(seed));
  return { privateKey: base58Encode(pair.secretKey), publicKey: base58Encode(pair.publicKey) };
}

/**
 * ENCRYPT_DATA (get.ts encryptData): `data64` (or `base64`) encrypted to
 * `publicKeys` and the account itself. No dialog. A file or blob can't reach
 * the test signer (its requests are JSON), so only data64 is taken.
 */
export function encryptDataRequest(data, keyPair, options) {
  const data64 = data.data64 || data.base64;
  const publicKeys = data.publicKeys || [];
  if (!data64) throw new Error(HUB_ENCRYPTION_TEXT.includeData);
  const encrypted = encryptDataGroup(
    { data64, publicKeys, privateKey: keyPair.privateKey, userPublicKey: keyPair.publicKey },
    options
  );
  if (encrypted) return encrypted;
  throw new Error(HUB_ENCRYPTION_TEXT.encrypt);
}

/**
 * DECRYPT_DATA (get.ts decryptData): the plain data as Base64, decrypted
 * with the account's own key. No dialog. Data not encrypted to the account
 * fails with "Unable to decrypt", and data in neither format with Hub's
 * "Unable to encrypt".
 */
export function decryptDataRequest(data, keyPair) {
  const { encryptedData, publicKey } = data;
  if (!encryptedData) throw new Error('Missing fields: encryptedData');
  const uint8PrivateKey = hubBase58Decode(keyPair.privateKey);
  const uint8Array = base64ToUint8Array(encryptedData);
  if (uint8ArrayStartsWith(uint8Array, SINGLE_MARKER)) {
    if (!publicKey) throw new Error('Missing fields: publicKey');
    return decryptDeprecatedSingle(uint8Array, publicKey, uint8PrivateKey);
  }
  if (uint8ArrayStartsWith(uint8Array, GROUP_MARKER)) {
    return uint8ArrayToBase64(decryptGroupDataQortalRequest(encryptedData, keyPair.privateKey));
  }
  throw new Error(HUB_ENCRYPTION_TEXT.encrypt);
}

/**
 * PUBLISH_QDN_RESOURCE's encryption (get.ts publishQDNResource), done before
 * Hub's dialog opens: the data64 to upload, encrypted to `publicKeys` and
 * the publisher when `encrypt` is set, as it was otherwise.
 */
export function publishData64(data, keyPair, options) {
  let data64 = data.data64 || data.base64;
  if (
    data.encrypt &&
    (!data.publicKeys || (Array.isArray(data.publicKeys) && data.publicKeys.length === 0))
  ) {
    throw new Error(HUB_ENCRYPTION_TEXT.needsPublicKeys);
  }
  if (!data.encrypt) return data64;
  try {
    const encrypted = encryptDataGroup(
      {
        data64,
        publicKeys: data.publicKeys,
        privateKey: keyPair.privateKey,
        userPublicKey: keyPair.publicKey,
      },
      options
    );
    if (encrypted) data64 = encrypted;
  } catch (error) {
    throw new Error(error?.message || HUB_ENCRYPTION_TEXT.uploadEncryption);
  }
  return data64;
}
