/**
 * Decrypted bytes of a mail attachment, the way FileElement gets them
 * (docs/apps/Q-Mail+.md → Data contract §6): `FETCH_QDN_RESOURCE` as base64,
 * then `DECRYPT_DATA { encryptedData }` with the user's own key.
 *
 * Used by the composer to re-attach a forwarded message's files. Identical
 * requests in flight share one promise and results are kept for the session
 * (bounded), so forwarding the same message twice costs one fetch. The reader
 * is growing a blob cache of its own; this helper can be swapped for it later.
 */
import { base64ToUint8Array } from "./toBase64";

export interface AttachmentReference {
  identifier: string;
  name: string;
  service: string;
  filename?: string;
  originalFilename?: string;
  type?: string | null;
  size?: number;
}

export interface AttachmentFetchProgress {
  /** QDN status: DOWNLOADING, BUILDING, READY, MISSING_DATA, … */
  status: string;
  percentLoaded?: number;
}

export interface AttachmentFetchOptions {
  onProgress?: (progress: AttachmentFetchProgress) => void;
  signal?: AbortSignal;
  /** How often to ask Core for the download status while fetching (ms). */
  statusIntervalMs?: number;
  /** Retries of FETCH_QDN_RESOURCE while peers are still sending the data. */
  retries?: number;
}

const MAX_CACHE_BYTES = 64 * 1024 * 1024;

const cache = new Map<string, Uint8Array>();
const inFlight = new Map<string, Promise<Uint8Array>>();
let cachedBytes = 0;

function cacheKey(reference: AttachmentReference): string {
  return `${reference.service}/${reference.name}/${reference.identifier}`;
}

function remember(key: string, bytes: Uint8Array): void {
  if (bytes.byteLength > MAX_CACHE_BYTES) return;
  while (cachedBytes + bytes.byteLength > MAX_CACHE_BYTES && cache.size) {
    const oldest = cache.keys().next().value as string;
    const evicted = cache.get(oldest);
    cache.delete(oldest);
    cachedBytes -= evicted?.byteLength || 0;
  }
  cache.set(key, bytes);
  cachedBytes += bytes.byteLength;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("Attachment fetch cancelled", "AbortError");
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function errorText(error: unknown): string {
  if (typeof error === "string") return error;
  const anyError = error as any;
  if (typeof anyError?.error === "string") return anyError.error;
  if (typeof anyError?.message === "string") return anyError.message;
  return "";
}

async function readStatus(reference: AttachmentReference): Promise<AttachmentFetchProgress | null> {
  try {
    const status = await qortalRequest({
      action: "GET_QDN_RESOURCE_STATUS",
      build: true,
      name: reference.name,
      service: reference.service,
      identifier: reference.identifier,
    });
    if (!status || typeof status !== "object") return null;
    return {
      status: typeof status.status === "string" ? status.status : "",
      percentLoaded:
        typeof status.percentLoaded === "number" ? status.percentLoaded : undefined,
    };
  } catch {
    return null;
  }
}

async function fetchAndDecrypt(reference: AttachmentReference): Promise<Uint8Array> {
  const encrypted = await qortalRequest({
    action: "FETCH_QDN_RESOURCE",
    name: reference.name,
    service: reference.service,
    identifier: reference.identifier,
    encoding: "base64",
  });
  if (typeof encrypted !== "string" || !encrypted) {
    throw new Error("The attachment could not be fetched");
  }
  // `encryptedData` is not in the typed options (global.d.ts); fetchMail.ts
  // sends the same untyped request body.
  const decryptRequest: any = {
    action: "DECRYPT_DATA",
    encryptedData: encrypted,
  };
  const decrypted = await qortalRequest(decryptRequest);
  if (typeof decrypted !== "string" || !decrypted) {
    throw new Error("The attachment could not be decrypted");
  }
  return base64ToUint8Array(decrypted);
}

/** The decrypted bytes of one attachment, from the cache when possible. */
export function fetchAttachmentBytes(
  reference: AttachmentReference,
  options: AttachmentFetchOptions = {}
): Promise<Uint8Array> {
  const key = cacheKey(reference);
  const cached = cache.get(key);
  if (cached) {
    options.onProgress?.({ status: "READY", percentLoaded: 100 });
    return Promise.resolve(cached);
  }
  const running = inFlight.get(key);
  if (running) return running;

  const { onProgress, signal, statusIntervalMs = 2_000, retries = 2 } = options;

  const job = (async () => {
    throwIfAborted(signal);
    const state = { stopped: false, last: null as AttachmentFetchProgress | null };

    // Progress comes from status polls that run beside the blocking fetch.
    void (async () => {
      while (!state.stopped) {
        const status = await readStatus(reference);
        if (state.stopped) return;
        if (status) {
          state.last = status;
          onProgress?.(status);
          if (status.status === "READY") return;
        }
        await sleep(statusIntervalMs);
      }
    })();

    try {
      let attempt = 0;
      for (;;) {
        throwIfAborted(signal);
        try {
          const bytes = await fetchAndDecrypt(reference);
          remember(key, bytes);
          onProgress?.({ status: "READY", percentLoaded: 100 });
          return bytes;
        } catch (error) {
          attempt += 1;
          const text = errorText(error).toLowerCase();
          const lastStatus = state.last?.status || "";
          const peersStillSending =
            attempt <= retries &&
            (text.includes("timed out") ||
              text.includes("not ready") ||
              (lastStatus !== "" && lastStatus !== "READY" && lastStatus !== "NOT_PUBLISHED"));
          if (!peersStillSending) {
            if (lastStatus === "MISSING_DATA") {
              throw new Error("Not enough peers have this attachment yet");
            }
            throw error instanceof Error ? error : new Error(errorText(error) || "Attachment fetch failed");
          }
          await sleep(statusIntervalMs);
        }
      }
    } finally {
      state.stopped = true;
    }
  })();

  inFlight.set(key, job);
  return job.finally(() => {
    inFlight.delete(key);
  });
}

/** The name to give a re-attached file: the original filename, else `<id>.<ext>`. */
export function attachmentFileName(reference: AttachmentReference): string {
  const original =
    typeof reference.originalFilename === "string" ? reference.originalFilename.trim() : "";
  if (original) return original;
  const filename = typeof reference.filename === "string" ? reference.filename.trim() : "";
  return filename || reference.identifier;
}

/** A `File` with the original name and MIME type, ready for the composer's attachment list. */
export async function fetchAttachmentFile(
  reference: AttachmentReference,
  options: AttachmentFetchOptions = {}
): Promise<File> {
  const bytes = await fetchAttachmentBytes(reference, options);
  const type = typeof reference.type === "string" && reference.type ? reference.type : "";
  // Copy into a plain ArrayBuffer so the File is not tied to a shared buffer.
  const buffer = bytes.slice().buffer;
  return new File([buffer], attachmentFileName(reference), type ? { type } : undefined);
}

/** For tests and the brief's numbers. */
export function attachmentBytesStats() {
  return { cached: cache.size, cachedBytes, inFlight: inFlight.size };
}

export function resetAttachmentBytesCache(): void {
  cache.clear();
  inFlight.clear();
  cachedBytes = 0;
}
