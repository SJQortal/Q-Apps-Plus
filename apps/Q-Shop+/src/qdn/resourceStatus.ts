/**
 * Getting a video or file onto the node before the app reads it (after
 * Q-Share+'s useFileOnNode): a GET of `/arbitrary/VIDEO/…` for a resource
 * that isn't fully on the node blocks for about 15 s and then answers 404, so
 * a player first asks for the status with `build=true` (which starts the
 * download from peers) and asks again, a little later each time, until it is
 * READY. Nothing is asked while the tab is hidden, and nothing before the
 * buyer presses Play or Preview.
 *
 * The status is read from the node directly with the name encoded (Hub's
 * GET_QDN_RESOURCE_STATUS puts it into the URL as it is, so names with a
 * space or `/` failed: docs/QORTAL.md, pitfall 9).
 */
export interface ResourceRef {
  service: "VIDEO" | "FILE";
  name: string;
  identifier: string;
}

export interface ResourceStatus {
  status: string;
  percentLoaded?: number;
}

/** Statuses after which asking again won't help. */
const FAILED = new Set(["NOT_PUBLISHED", "MISSING_DATA", "BLOCKED", "UNSUPPORTED", "FAILED_TO_DOWNLOAD"]);

export function resourceUrl(ref: ResourceRef): string {
  return `/arbitrary/${ref.service}/${encodeURIComponent(ref.name)}/${encodeURIComponent(ref.identifier)}`;
}

export async function resourceStatus(ref: ResourceRef, build = true): Promise<ResourceStatus> {
  const response = await fetch(
    `/arbitrary/resource/status/${ref.service}/${encodeURIComponent(ref.name)}/${encodeURIComponent(ref.identifier)}?build=${build}`,
    { method: "GET" }
  );
  const body = (await response.json().catch(() => null)) as { status?: unknown; percentLoaded?: unknown; error?: unknown } | null;
  if (!response.ok || !body || typeof body.status !== "string") throw new Error(`The node answered ${response.status}`);
  return { status: body.status, ...(typeof body.percentLoaded === "number" && { percentLoaded: body.percentLoaded }) };
}

/** Delays between status checks, then the last one again. */
export const STATUS_DELAYS_MS = [1000, 2000, 3000, 5000];
/** Errors in a row before giving up (the node dropped out). */
const MAX_ERRORS = 4;

function visible(): Promise<void> {
  if (typeof document === "undefined" || !document.hidden) return Promise.resolve();
  return new Promise((resolve) => {
    const onChange = () => {
      if (document.hidden) return;
      document.removeEventListener("visibilitychange", onChange);
      resolve();
    };
    document.addEventListener("visibilitychange", onChange);
  });
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Stopped", "AbortError"));
    });
  });
}

/**
 * Resolves once the resource is READY; rejects with the status that ended
 * it (NOT_PUBLISHED…), after errors in a row, or when `signal` aborts.
 * `onStatus` hears every answer (for "Fetching from peers… 40 %").
 */
export async function waitForResource(
  ref: ResourceRef,
  options: { signal?: AbortSignal; onStatus?: (status: ResourceStatus) => void; check?: typeof resourceStatus } = {}
): Promise<void> {
  const check = options.check ?? resourceStatus;
  let errors = 0;
  for (let attempt = 0; ; attempt++) {
    if (options.signal?.aborted) throw new DOMException("Stopped", "AbortError");
    await visible();
    try {
      const status = await check(ref, true);
      errors = 0;
      options.onStatus?.(status);
      if (status.status === "READY") return;
      if (FAILED.has(status.status)) throw new ResourceUnavailableError(status.status);
    } catch (error) {
      if (error instanceof ResourceUnavailableError) throw error;
      if (++errors >= MAX_ERRORS) throw error;
    }
    await sleep(STATUS_DELAYS_MS[Math.min(attempt, STATUS_DELAYS_MS.length - 1)], options.signal);
  }
}

export class ResourceUnavailableError extends Error {
  readonly status: string;
  constructor(status: string) {
    super(status === "NOT_PUBLISHED" ? "It isn't on QDN (deleted, or never published)." : `Your node can't get it right now (${status}).`);
    this.name = "ResourceUnavailableError";
    this.status = status;
  }
}
