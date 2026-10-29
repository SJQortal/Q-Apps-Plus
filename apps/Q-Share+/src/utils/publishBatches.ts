/**
 * Shares with many files go to Hub in batches. Each resource is one ARBITRARY
 * transaction, and Core keeps at most 25 unconfirmed transactions per account
 * (Settings `maxUnconfirmedPerAccount`, CHAT not counted): the 26th is
 * refused with TOO_MANY_UNCONFIRMED, by the user's node and by peers with the
 * default setting. Hub has no wait of its own (it pauses one second between
 * resources), so a batch is sent only once the network has confirmed enough
 * of the one before. A block comes about once a minute and takes them all.
 */
import { getJson } from "./qdnResource";

export const MAX_UNCONFIRMED_PER_ACCOUNT = 25;
/** Files per batch; the share details and thumbnail ride with the last one, so up to 22 resources. */
export const FILES_PER_BATCH = 20;
/**
 * The biggest publish before batches (10 files and the details, and since
 * 1.0.1 a thumbnail). Batches up to this size are sent without asking the
 * node first, as they always were.
 */
export const UNCHECKED_BATCH_MAX = 12;
/** Most files one share holds: 15 batches, 301 publishes, 3.01 QORT at today's fee. */
export const MAX_SHARE_FILES = 300;

/**
 * How often the room check asks the node, and how long a batch after the
 * first waits when the node can't say (about one block), in ms. Tests
 * shorten them.
 */
export const roomTiming = { visibleMs: 10_000, hiddenMs: 30_000, unknownMs: 65_000 };

/** The share's details: its JSON (DOCUMENT) and the thumbnail it names. */
export const isShareDetails = (r: { service: string }) => r.service === "DOCUMENT" || r.service === "THUMBNAIL";

/**
 * The resources in batches of `filesPerBatch` files, in order, with the
 * share details (thumbnail, then DOCUMENT) in the last batch: the share
 * appears on QDN only once its files are there, and a thumbnail never makes
 * a batch of its own.
 */
export function splitPublishBatches<T extends { service: string }>(resources: T[], filesPerBatch = FILES_PER_BATCH): T[][] {
  const files = resources.filter((r) => !isShareDetails(r));
  const details = resources.filter(isShareDetails);
  const batches: T[][] = [];
  for (let i = 0; i < files.length; i += filesPerBatch) batches.push(files.slice(i, i + filesPerBatch));
  if (details.length > 0) {
    if (batches.length === 0) batches.push([]);
    batches[batches.length - 1].push(...details);
  }
  return batches;
}

export function batchCount(fileCount: number, withDetails = true): number {
  const batches = Math.ceil(fileCount / FILES_PER_BATCH);
  return Math.max(batches, withDetails ? 1 : 0);
}

/**
 * How many of the account's transactions wait for a block, or null when the
 * node can't say (the publish then goes ahead and Hub reports any refusal).
 */
export async function unconfirmedCount(publicKey: string): Promise<number | null> {
  try {
    const rows = await getJson(`/transactions/unconfirmed?creator=${encodeURIComponent(publicKey)}&limit=100`);
    if (!Array.isArray(rows)) return null;
    return rows.filter((tx: { type?: unknown } | null) => tx?.type !== "CHAT").length;
  } catch {
    return null;
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done);
  });
}

/**
 * Resolves once `needed` more transactions fit under the account's limit.
 * When the node can't tell, it resolves at once, or after `unknownWaitMs`
 * (a batch after the first: give the last one a block). `onWaiting` gets the
 * count each time the node says to wait. The publish is under way, so the
 * check carries on while the tab is hidden, at a slower pace. Stops early
 * when `signal` aborts.
 */
export async function waitForRoom(
  publicKey: string,
  needed: number,
  options: { signal?: AbortSignal; onWaiting?: (unconfirmed: number) => void; unknownWaitMs?: number } = {}
): Promise<void> {
  const { signal, onWaiting, unknownWaitMs = 0 } = options;
  const limit = MAX_UNCONFIRMED_PER_ACCOUNT - Math.min(needed, MAX_UNCONFIRMED_PER_ACCOUNT);
  while (!signal?.aborted) {
    const count = await unconfirmedCount(publicKey);
    if (count === null) {
      if (unknownWaitMs > 0) await sleep(unknownWaitMs, signal);
      return;
    }
    if (count <= limit || signal?.aborted) return;
    onWaiting?.(count);
    const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
    await sleep(hidden ? roomTiming.hiddenMs : roomTiming.visibleMs, signal);
  }
}

let unitFee: Promise<number | null> | null = null;

/** Core's fee for one publish, in QORT (0.01 today), read once per session; null when unknown. */
export function publishUnitFee(): Promise<number | null> {
  if (!unitFee) {
    unitFee = getJson("/transactions/unitfee?txType=ARBITRARY").then(
      (raw) => {
        const atomic = Number(raw);
        return Number.isFinite(atomic) && atomic > 0 ? atomic / 1e8 : null;
      },
      () => {
        unitFee = null;
        return null;
      }
    );
  }
  return unitFee;
}

/** "1.21 QORT", without trailing zeros past the cent. */
export function formatQort(amount: number): string {
  const text = amount.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
  const [whole, fraction = ""] = text.split(".");
  return `${whole}.${fraction.padEnd(2, "0")} QORT`;
}

/** For tests. */
export function resetPublishUnitFee(): void {
  unitFee = null;
}
