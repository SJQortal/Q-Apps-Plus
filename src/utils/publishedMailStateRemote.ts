/**
 * Reads the published `qmail_state_v1` document straight from QDN, for a
 * publish on a device that has not loaded it this session (the publish must
 * merge it, not replace it). Same calls as the load path: an exact-name
 * search, FETCH_QDN_RESOURCE, then DECRYPT_DATA with a plaintext fallback.
 */
import { searchResources } from "./qdnSearch";
import { base64ToUint8Array, uint8ArrayToObject } from "./toBase64";
import {
  MAIL_STATE_DOCUMENT_IDENTIFIER,
  MAIL_STATE_DOCUMENT_SERVICE,
  parsePublishedMailStateDocument,
  type ParsedPublishedState,
} from "./mailStateDocument";

export const REMOTE_STATE_FETCH_TIMEOUT_MS = 30_000;

/** Decrypts (or, for an old plaintext document, decodes) a fetched resource. */
export const decodeMailStateResource = async (
  encodedResource: string
): Promise<unknown> => {
  try {
    const decryptRequest: any = {
      action: "DECRYPT_DATA",
      encryptedData: encodedResource,
    };
    const decrypted = await qortalRequest(decryptRequest);
    return uint8ArrayToObject(base64ToUint8Array(decrypted));
  } catch {
    return uint8ArrayToObject(base64ToUint8Array(encodedResource));
  }
};

/**
 * Resolves to the parsed document, or null when the name has never published
 * one. Throws when the document exists but could not be read (peers offline,
 * timeout), so the caller can refuse to overwrite it.
 */
export const readPublishedMailStateFromQdn = async (
  name: string
): Promise<ParsedPublishedState | null> => {
  const rows = await searchResources(
    {
      mode: "ALL",
      service: MAIL_STATE_DOCUMENT_SERVICE,
      identifier: MAIL_STATE_DOCUMENT_IDENTIFIER,
      name,
      exactmatchnames: "true",
      limit: "1",
      includemetadata: "false",
      reverse: "true",
      excludeblocked: "true",
    },
    { force: true }
  );
  if (!rows.length) return null;
  const encodedResource = await qortalRequestWithTimeout(
    {
      action: "FETCH_QDN_RESOURCE",
      name,
      service: MAIL_STATE_DOCUMENT_SERVICE,
      identifier: MAIL_STATE_DOCUMENT_IDENTIFIER,
      encoding: "base64",
    },
    REMOTE_STATE_FETCH_TIMEOUT_MS
  );
  if (typeof encodedResource !== "string" || !encodedResource) {
    throw new Error("The published Q-Mail state could not be fetched");
  }
  const decoded = await decodeMailStateResource(encodedResource);
  return parsePublishedMailStateDocument(decoded);
};
