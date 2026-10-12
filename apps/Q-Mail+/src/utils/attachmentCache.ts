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
 * Cached blobs are keyed by publisher name + identifier (another name can
 * publish under the same identifier: docs/QORTAL.md pitfall 15), capped in
 * total bytes, evicted least recently used first, and their object URLs
 * revoked on eviction. A "D" body is the delete marker (pitfall 14), and a
 * node that has not got the data yet is asked again at 2, 4, 8 and 16 s.
 */
import { base64ToUint8Array } from './toBase64';
import {
  attachmentDisplayName,
  resolveMimeType,
  type AttachmentRef,
} from './attachmentMeta';
import { errorMessage, isHubDecline } from './hubErrors';
import { NOT_YET_RETRY_DELAYS_MS, isDeletedBody, isNotYetAvailable } from './fetchMail';

export interface ResourceStatus {
  /** READY, DOWNLOADING, DOWNLOADED, BUILDING, MISSING_DATA, NOT_PUBLISHED, FAILED, … or '' when unknown. */
  status: string;
  /** 0–100 when Core reports progress; undefined otherwise. */
  percentLoaded?: number;
  localChunkCount?: number;
  totalChunkCount?: number;
}

export interface CachedAttachment {
  /** Publisher name + identifier (see `attachmentKey`). */
  key: string;
  name: string;
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
/** MIME type / filename reported by GET_QDN_RESOURCE_PROPERTIES, per name + identifier. */
const properties = new Map<string, { mimeType?: string; filename?: string }>();
let stats = { loads: 0, cacheHits: 0, merged: 0, evictions: 0 };

export type AttachmentKeyRef = Pick<AttachmentRef, 'name' | 'identifier'>;

/** The cache key: the search row's publisher name (case-insensitive) and identifier. */
export function attachmentKey(ref: AttachmentKeyRef): string {
  return `${String(ref.name || '').trim().toLowerCase()}/${String(ref.identifier || '')}`;
}

/** Thrown by `loadAttachment` for a resource the sender removed. */
export class AttachmentDeletedError extends Error {
  readonly deleted = true;
  constructor() {
    super('This attachment was removed by its sender.');
    this.name = 'AttachmentDeletedError';
  }
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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
    // Core only assembles a resource it has already downloaded when asked to:
    // without build:true a DOWNLOADED message or file can stay "Preparing…"
    // for good (seen in Hub on 2026-10-04 with a freshly sent message).
    build: true,
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
      properties.set(attachmentKey(ref), {
        mimeType: typeof res.mimeType === 'string' ? res.mimeType : undefined,
        filename: typeof res.filename === 'string' ? res.filename : undefined,
      });
    }
  } catch {
    /* Core may answer later; the status poll carries on */
  }
}

export function getCachedAttachment(ref: AttachmentKeyRef): CachedAttachment | undefined {
  const key = attachmentKey(ref);
  const hit = cache.get(key);
  if (hit) {
    hit.lastUsed = Date.now();
    // Re-insert so Map order stays least-recently-used first.
    cache.delete(key);
    cache.set(key, hit);
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
  const existing = cache.get(entry.key);
  if (existing) {
    cache.delete(entry.key);
    totalCacheBytes -= existing.size;
    if (existing.url !== entry.url) revokeObjectUrl(existing.url);
  }
  evictIfNeeded(entry.size);
  cache.set(entry.key, entry);
  totalCacheBytes += entry.size;
}

/**
 * FETCH_QDN_RESOURCE base64, asked again at 2, 4, 8 and 16 s while the node
 * says it has not got the data yet (`retries` of them; 0 = one try).
 */
async function fetchEncrypted(ref: AttachmentRef, retries: number, sleep: (ms: number) => Promise<void>): Promise<unknown> {
  let attempt = 0;
  for (;;) {
    try {
      return await qortalRequest({
        action: 'FETCH_QDN_RESOURCE',
        name: ref.name,
        service: ref.service,
        identifier: ref.identifier,
        encoding: 'base64',
      });
    } catch (error) {
      if (attempt >= retries || !isNotYetAvailable(error)) throw error;
      await sleep(NOT_YET_RETRY_DELAYS_MS[attempt]);
      attempt += 1;
    }
  }
}

export interface LoadAttachmentOptions {
  /** How many of NOT_YET_RETRY_DELAYS_MS to use when the node has not got the data yet (default 0). */
  retries?: number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Fetch and decrypt an attachment that Core already has (status READY).
 * Returns the cached entry when there is one, merges identical loads in
 * flight, and caches the result. Throws when the resource cannot be fetched
 * or decrypted.
 */
export function loadAttachment(ref: AttachmentRef, options: LoadAttachmentOptions = {}): Promise<CachedAttachment> {
  const key = attachmentKey(ref);
  const cached = getCachedAttachment(ref);
  if (cached) {
    stats.cacheHits += 1;
    return Promise.resolve(cached);
  }
  const running = inFlight.get(key);
  if (running) {
    stats.merged += 1;
    return running;
  }
  const retries = Math.max(0, Math.min(options.retries ?? 0, NOT_YET_RETRY_DELAYS_MS.length));
  const task = (async () => {
    stats.loads += 1;
    const encrypted = await fetchEncrypted(ref, retries, options.sleep ?? defaultSleep);
    if (isDeletedBody(encrypted)) {
      throw new AttachmentDeletedError();
    }
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
    const props = properties.get(key);
    const mimeType = resolveMimeType(ref, props?.mimeType);
    const blob = new Blob([bytes], { type: mimeType });
    const entry: CachedAttachment = {
      key,
      name: ref.name,
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
  inFlight.set(key, task);
  task.finally(() => inFlight.delete(key)).catch(() => undefined);
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
