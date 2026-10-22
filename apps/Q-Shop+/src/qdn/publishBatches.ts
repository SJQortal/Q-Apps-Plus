/**
 * Big product publishes go to Hub in batches (after Q-Share+'s
 * `utils/publishBatches.ts`). Each catalogue and the product index (the data
 * container) is one ARBITRARY transaction, and Core keeps at most 25
 * unconfirmed transactions per account (Settings `maxUnconfirmedPerAccount`,
 * CHAT not counted): the 26th is refused with TOO_MANY_UNCONFIRMED, by the
 * seller's node and by peers with the default setting. Hub has no wait of its
 * own, so a batch is sent only once the network has confirmed enough of the
 * one before. A block comes about once a minute and takes them all.
 *
 * Up to 20 resources (about 190 new products) still go in one
 * PUBLISH_MULTIPLE_QDN_RESOURCES, exactly as the original sent them.
 */
import { DATA_CONTAINER_BASE } from "./identifiers";

export const MAX_UNCONFIRMED_PER_ACCOUNT = 25;
/** Most resources one PUBLISH_MULTIPLE_QDN_RESOURCES carries; a bigger publish goes in batches of this size. */
export const RESOURCES_PER_BATCH = 20;

/**
 * How often the room check asks the node, and how long a batch after the
 * first waits when the node can't say (about one block), in ms. Tests
 * shorten them.
 */
export const roomTiming = { visibleMs: 10_000, hiddenMs: 30_000, unknownMs: 65_000 };

/** The shop's product index (`<storeId>-datacontainer`): it names every catalogue, so it goes last. */
export function isProductIndex(resource: { identifier: string }): boolean {
  return resource.identifier.endsWith(`-${DATA_CONTAINER_BASE}`);
}

/**
 * The resources in the batches they are sent in. Up to `perBatch` resources
 * go as one batch, in the order given (the original's single publish).
 * More go in batches of `perBatch` in order, with the product index last, in
 * the final batch, so the index only lands once the catalogues it names are
 * on QDN.
 */
export function splitPublishBatches<T extends { identifier: string }>(
  resources: T[],
  perBatch = RESOURCES_PER_BATCH,
  isIndex: (resource: T) => boolean = isProductIndex
): T[][] {
  if (resources.length === 0) return [];
  if (resources.length <= perBatch) return [resources.slice()];
  const others = resources.filter((r) => !isIndex(r));
  const index = resources.filter(isIndex);
  const batches: T[][] = [];
  for (let i = 0; i < others.length; i += perBatch) batches.push(others.slice(i, i + perBatch));
  if (index.length > 0) {
    const last = batches.at(-1);
    if (last && last.length + index.length <= perBatch) last.push(...index);
    else batches.push(index);
  }
  return batches;
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { method: "GET", headers: { "Content-Type": "application/json" } });
  if (!response.ok) throw new Error(`The node answered ${response.status}`);
  const body: unknown = JSON.parse(await response.text());
  // Core answers some errors with 200 and an `{ error, message }` body.
  if (body && typeof body === "object" && !Array.isArray(body) && "error" in body) throw new Error("Core error");
  return body;
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
        if (Number.isFinite(atomic) && atomic > 0) return atomic / 1e8;
        unitFee = null;
        return null;
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
