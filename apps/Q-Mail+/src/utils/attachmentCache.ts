/**
 * One path from an attachment reference to its decrypted bytes, and a
 * per-session cache of the result (docs/QORTAL.md → Efficiency rules 3 and 6).
 *
 *   GET_QDN_RESOURCE_STATUS ──not READY──► GET_QDN_RESOURCE_PROPERTIES (asks Core
 *   to fetch) ──poll (useResourceReady)──► READY ──► FETCH_QDN_RESOURCE base64
 *   ──► DECRYPT_DATA {encryptedData} ──► Uint8Array ──► Blob(mime) + object URL
 *
 * The call shapes are the ones the original app uses (data contract §4, §6),
 * so nothing here changes what is read from QDN; it only reads it once.
 *
 * Cached blobs are keyed by identifier, capped in total bytes, evicted least
 * recently used first, and their object URLs revoked on eviction.
 */
import { base64ToUint8Array } from './toBase64';
import {
  attachmentDisplayName,
  resolveMimeType,
  type AttachmentRef,
} from './attachmentMeta';
import { errorMessage, isHubDecline } from './hubErrors';

export interface ResourceStatus {
  /** READY, DOWNLOADING, DOWNLOADED, BUILDING, MISSING_DATA, NOT_PUBLISHED, FAILED, … or '' when unknown. */
  status: string;
  /** 0–100 when Core reports progress; undefined otherwise. */
  percentLoaded?: number;
  localChunkCount?: number;
  totalChunkCount?: number;
}

export interface CachedAttachment {
  identifier: string;
  blob: Blob;
  /** Object URL for <img>, <audio>, <video>; revoked when the entry is evicted. */
  url: string;
  mimeType: string;
  size: number;
  filename: string;
  lastUsed: number;
}

export const DEFAULT_ATTACHMENT_CACHE_BYTES = 96 * 1024 * 1024;

let maxCacheBytes = DEFAULT_ATTACHMENT_CACHE_BYTES;
let totalCacheBytes = 0;
const cache = new Map<string, CachedAttachment>();
const inFlight = new Map<string, Promise<CachedAttachment>>();
/** MIME type / filename reported by GET_QDN_RESOURCE_PROPERTIES, per identifier. */
const properties = new Map<string, { mimeType?: string; filename?: string }>();
let stats = { loads: 0, cacheHits: 0, merged: 0, evictions: 0 };

function createObjectUrl(blob: Blob): string {
  try {
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      return URL.createObjectURL(blob);
    }
  } catch {
    /* jsdom and old WebViews */
  }
  return '';
}

function revokeObjectUrl(url: string): void {
  if (!url) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    /* ignore */
  }
}

/** Normalise what Core returns for GET_QDN_RESOURCE_STATUS. */
export function normalizeStatus(raw: any): ResourceStatus {
  const status = String(raw?.status || '').toUpperCase();
  const local = Number(raw?.localChunkCount);
  const total = Number(raw?.totalChunkCount);
  let percent: number | undefined;
  if (typeof raw?.percentLoaded === 'number' && Number.isFinite(raw.percentLoaded)) {
    percent = Math.max(0, Math.min(100, raw.percentLoaded));
  } else if (Number.isFinite(local) && Number.isFinite(total) && total > 0) {
    percent = Math.max(0, Math.min(100, (local / total) * 100));
  }
  if (status === 'READY') percent = 100;
  return {
    status,
    percentLoaded: percent,
    localChunkCount: Number.isFinite(local) ? local : undefined,
    totalChunkCount: Number.isFinite(total) ? total : undefined,
  };
}

/** True for the states where polling should stop. */
export function isTerminalStatus(status: string): boolean {
  return status === 'READY' || status === 'NOT_PUBLISHED';
}

/** True for the states where the user should be offered Retry. */
export function isStalledStatus(status: string): boolean {
  return status === 'MISSING_DATA' || status === 'FAILED';
}

export async function fetchResourceStatus(ref: Pick<AttachmentRef, 'name' | 'service' | 'identifier'>): Promise<ResourceStatus> {
  const res = await qortalRequest({
    action: 'GET_QDN_RESOURCE_STATUS',
    name: ref.name,
    service: ref.service,
    identifier: ref.identifier,
  });
  return normalizeStatus(res);
}

/**
 * Ask Core to fetch the resource from peers. GET_QDN_RESOURCE_PROPERTIES is
 * what the original app used for this; its answer also carries the MIME type
 * and filename, which are remembered for `loadAttachment`.
 */
export async function startResourceDownload(ref: Pick<AttachmentRef, 'name' | 'service' | 'identifier'>): Promise<void> {
  try {
    const res = await qortalRequest({
      action: 'GET_QDN_RESOURCE_PROPERTIES',
      name: ref.name,
      service: ref.service,
      identifier: ref.identifier,
    });
    if (res && typeof res === 'object') {
      properties.set(ref.identifier, {
        mimeType: typeof res.mimeType === 'string' ? res.mimeType : undefined,
        filename: typeof res.filename === 'string' ? res.filename : undefined,
      });
    }
  } catch {
    /* Core may answer later; the status poll carries on */
  }
}

export function getCachedAttachment(identifier: string): CachedAttachment | undefined {
  const hit = cache.get(identifier);
  if (hit) {
    hit.lastUsed = Date.now();
    // Re-insert so Map order stays least-recently-used first.
    cache.delete(identifier);
    cache.set(identifier, hit);
  }
  return hit;
}

function evictIfNeeded(incomingBytes: number): void {
  while (cache.size > 0 && totalCacheBytes + incomingBytes > maxCacheBytes) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (oldestKey === undefined) break;
    const entry = cache.get(oldestKey);
    cache.delete(oldestKey);
    if (entry) {
      totalCacheBytes -= entry.size;
      revokeObjectUrl(entry.url);
      stats.evictions += 1;
    }
  }
}

function store(entry: CachedAttachment): void {
  const existing = cache.get(entry.identifier);
  if (existing) {
    cache.delete(entry.identifier);
    totalCacheBytes -= existing.size;
    if (existing.url !== entry.url) revokeObjectUrl(existing.url);
  }
  evictIfNeeded(entry.size);
  cache.set(entry.identifier, entry);
  totalCacheBytes += entry.size;
}

/**
 * Fetch and decrypt an attachment that Core already has (status READY).
 * Returns the cached entry when there is one, merges identical loads in
 * flight, and caches the result. Throws when the resource cannot be fetched
 * or decrypted.
 */
export function loadAttachment(ref: AttachmentRef): Promise<CachedAttachment> {
  const cached = getCachedAttachment(ref.identifier);
  if (cached) {
    stats.cacheHits += 1;
    return Promise.resolve(cached);
  }
  const running = inFlight.get(ref.identifier);
  if (running) {
    stats.merged += 1;
    return running;
  }
  const task = (async () => {
    stats.loads += 1;
    const encrypted = await qortalRequest({
      action: 'FETCH_QDN_RESOURCE',
      name: ref.name,
      service: ref.service,
      identifier: ref.identifier,
      encoding: 'base64',
    });
    if (typeof encrypted !== 'string' || !encrypted) {
      throw new Error('The file could not be fetched from this node.');
    }
    const decrypted = await qortalRequest({
      action: 'DECRYPT_DATA',
      encryptedData: encrypted,
    } as any);
    if (typeof decrypted !== 'string' || !decrypted) {
      throw new Error('This file could not be decrypted with your key.');
    }
    const bytes = base64ToUint8Array(decrypted);
    const props = properties.get(ref.identifier);
    const mimeType = resolveMimeType(ref, props?.mimeType);
    const blob = new Blob([bytes], { type: mimeType });
    const entry: CachedAttachment = {
      identifier: ref.identifier,
      blob,
      url: createObjectUrl(blob),
      mimeType,
      size: blob.size,
      filename: attachmentDisplayName({ ...ref, filename: ref.filename || props?.filename }),
      lastUsed: Date.now(),
    };
    store(entry);
    return entry;
  })();
  inFlight.set(ref.identifier, task);
  task.finally(() => inFlight.delete(ref.identifier)).catch(() => undefined);
  return task;
}

/**
 * Hand the bytes to Hub's save dialog (SAVE_FILE with a blob), as the original
 * app does. Always a blob, never a `location` save: a mail attachment is
 * encrypted to the recipient (ATTACHMENT_PRIVATE, DECRYPT_DATA), so Hub
 * saving the resource by location would write the ciphertext. Desktop Hub
 * saves a blob straight to Downloads; GO writes it to Documents/Qortal Go
 * natively (Hub's showSaveFilePicker → saveBlobToMobileDocuments). The
 * composer caps attachments at 40 MB, far under the 100 MB where Hub prefers
 * a location save (docs/QORTAL.md pitfall 17).
 *
 * Resolves true when saved and false when the user declined Hub's prompt,
 * which is their choice and never an error. Anything else throws.
 */
export async function saveAttachment(entry: CachedAttachment, ref?: Partial<AttachmentRef>): Promise<boolean> {
  const filename = ref ? attachmentDisplayName({ ...ref, filename: ref.filename || entry.filename }) : entry.filename;
  try {
    await qortalRequest({
      action: 'SAVE_FILE',
      blob: entry.blob,
      filename,
      mimeType: entry.mimeType,
    });
    return true;
  } catch (error) {
    if (isHubDecline(error)) return false;
    throw new Error(errorMessage(error, 'The file could not be saved.'));
  }
}

export function setAttachmentCacheLimit(bytes: number): void {
  maxCacheBytes = Math.max(0, bytes);
  evictIfNeeded(0);
}

export function attachmentCacheStats() {
  return { ...stats, entries: cache.size, bytes: totalCacheBytes, inFlight: inFlight.size };
}

export function resetAttachmentCache(): void {
  for (const entry of cache.values()) revokeObjectUrl(entry.url);
  cache.clear();
  inFlight.clear();
  properties.clear();
  totalCacheBytes = 0;
  maxCacheBytes = DEFAULT_ATTACHMENT_CACHE_BYTES;
  stats = { loads: 0, cacheHits: 0, merged: 0, evictions: 0 };
}
