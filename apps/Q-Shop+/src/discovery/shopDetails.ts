/**
 * Each shop's own JSON (service STORE, `q-store-general-<id>` under the
 * owner's name): its logo (a data URL inside the JSON), the coins it takes
 * and its payout addresses. The home page asks for one only when its card
 * scrolls into view, or when a "Pays in" filter has to check a shop's coins.
 *
 * Held for the session in a small store that components read with
 * useSyncExternalStore. A shop that isn't on the node yet is fetched again
 * after 2, 4 and 8 seconds ("Fetching from peers…"), then reported as not
 * available, never as an endless placeholder (docs/QORTAL.md → pitfall 14).
 *
 * A shop's details are read again when the shop index (or a search) says the
 * shop changed since they were read (its QDN `updated` is newer), so a new
 * logo or payout coin shows on its card and in the "Pays in" filter after a
 * pull to refresh or the next index read, without reading the shops that
 * didn't change. The old copy stays on screen meanwhile. The shop and
 * product pages also hand over every shop JSON they read (primeShopDetails).
 */
import { useSyncExternalStore } from "react";
import { QdnDeletedError, fetchQdnJson, mapWithConcurrency } from "../qdn/search";
import { checkStructureStore } from "../utils/checkStructure";
import { shopKey, type ShopEntry } from "./shopIndex";
import { normalizeShopJson, type ShopJson } from "./shopJson";

export type { ShopJson } from "./shopJson";

export type ShopDetails =
  | { status: "loading" }
  /** Not on the node yet: asking again (attempt 1–3). */
  | { status: "retrying"; attempt: number }
  /**
   * `valid` is the original's check (title, created, description, shipsTo,
   * shortStoreId). `updated`: the shop's QDN `updated` (from the index) this
   * copy was read for, when known. `deleted`: its owner deleted it (the node
   * serves the delete marker); it is not valid, so lists leave it out.
   */
  | { status: "ready"; shop: ShopJson; valid: boolean; updated?: number; deleted?: true }
  /** `final`: the retries are spent; otherwise a single check failed and a card may try again. */
  | { status: "failed"; final: boolean };

export const DETAIL_RETRY_DELAYS_MS = [2000, 4000, 8000];
/** How many shops a "Pays in" check reads at once. */
export const DETAIL_CHECK_CONCURRENCY = 5;

const states = new Map<string, ShopDetails>();
const running = new Map<string, Promise<ShopDetails>>();
const listeners = new Set<() => void>();
let version = 0;

/** A lookup that is a new object whenever any shop's details change, for memo dependencies. */
export interface ShopDetailsSnapshot {
  version: number;
  get: (key: string) => ShopDetails | undefined;
}

const lookup = (key: string) => states.get(key);
let snapshot: ShopDetailsSnapshot = { version, get: lookup };

function changed(): void {
  version += 1;
  snapshot = { version, get: lookup };
  for (const listener of [...listeners]) listener();
}

function update(key: string, next: ShopDetails): ShopDetails {
  states.set(key, next);
  changed();
  return next;
}

export function subscribeShopDetails(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Changes whenever any shop's details change. */
export function shopDetailsVersion(): number {
  return version;
}

export function getShopDetails(key: string): ShopDetails | undefined {
  return states.get(key);
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The copy was read before the shop's latest publish: `updated` is the
 * shop's QDN `updated` as the index (or a search) now reports it.
 */
export function isOutdated(details: ShopDetails | undefined, updated: number | undefined): boolean {
  return details?.status === "ready" && typeof updated === "number" && (details.updated ?? 0) < updated;
}

/** A shop's JSON as a ready entry: fields of the wrong type dropped (shopJson.ts), then the original's check. */
function readyFrom(json: unknown, updated: number | undefined): ShopDetails {
  const shop = normalizeShopJson(json);
  const valid = shop !== null && checkStructureStore(shop);
  return { status: "ready", shop: valid ? shop : {}, valid, ...(updated !== undefined && { updated }) };
}

/** A deleted shop: settled at once (asking again won't bring it back), and left out of lists. */
function deletedEntry(updated: number | undefined): ShopDetails {
  return { status: "ready", shop: {}, valid: false, deleted: true, ...(updated !== undefined && { updated }) };
}

/**
 * Loads a shop's JSON unless it is loaded or loading. With `retries: false`
 * (the "Pays in" check) one attempt is made, and a card that shows the shop
 * later still gets its own retries. `updated` is the shop's QDN `updated`
 * as the caller knows it: a copy read for an older one is read again (one
 * attempt, bypassing the cache), and stays on screen until the new one is in
 * (or stays, if the node can't give it right now).
 */
export function requestShopDetails(
  owner: string,
  id: string,
  options: { retries?: boolean; updated?: number } = {}
): Promise<ShopDetails> {
  const retries = options.retries ?? true;
  const { updated } = options;
  const key = shopKey(owner, id);
  const pending = running.get(key);
  if (pending) return pending;
  const current = states.get(key);
  if (current?.status === "ready" && !isOutdated(current, updated)) return Promise.resolve(current);
  if (current?.status === "failed" && (current.final || !retries)) return Promise.resolve(current);

  const job =
    current?.status === "ready"
      ? (async (): Promise<ShopDetails> => {
          try {
            return update(key, readyFrom(await fetchQdnJson<unknown>("STORE", owner, id, { fresh: true }), updated));
          } catch (error) {
            if (error instanceof QdnDeletedError) return update(key, deletedEntry(updated));
            // Keep what was shown; the next change in the index asks again.
            return update(key, { ...current, updated });
          }
        })()
      : (async (): Promise<ShopDetails> => {
          const attempts = retries ? DETAIL_RETRY_DELAYS_MS.length + 1 : 1;
          update(key, { status: "loading" });
          for (let attempt = 0; attempt < attempts; attempt++) {
            if (attempt > 0) {
              update(key, { status: "retrying", attempt });
              await wait(DETAIL_RETRY_DELAYS_MS[attempt - 1]);
            }
            try {
              return update(key, readyFrom(await fetchQdnJson<unknown>("STORE", owner, id, { fresh: attempt > 0 }), updated));
            } catch (error) {
              if (error instanceof QdnDeletedError) return update(key, deletedEntry(updated));
              // not on the node yet, or the node hiccupped: try again
            }
          }
          return update(key, { status: "failed", final: retries });
        })();
  running.set(key, job);
  const forget = () => {
    if (running.get(key) === job) running.delete(key);
  };
  job.then(forget, forget);
  return job;
}

/**
 * Reads the coins of shops a "Pays in" filter hasn't checked yet, or that
 * changed since, five at a time, one attempt each.
 */
export async function checkShopDetails(shops: ShopEntry[]): Promise<void> {
  await mapWithConcurrency(shops, DETAIL_CHECK_CONCURRENCY, (shop) =>
    requestShopDetails(shop.owner, shop.id, { retries: false, updated: shop.updated })
  );
}

/**
 * A shop JSON read elsewhere (the shop and product pages, or the seller's
 * own copy after an edit): the home card and filters show it at once. It
 * keeps the version the card last read for, so a newer `updated` in the
 * index still has the card read the shop again. Only a valid shop is taken,
 * so this never drops a shop from the list.
 */
export function primeShopDetails(owner: string, id: string, json: unknown): void {
  const key = shopKey(owner, id);
  const current = states.get(key);
  const next = readyFrom(json, current?.status === "ready" ? current.updated : undefined);
  if (next.status !== "ready" || !next.valid) return;
  update(key, next);
}

/** Its owner deleted the shop (read on the shop page, or deleted here): its card leaves the lists at once. */
export function markShopDeleted(owner: string, id: string): void {
  const key = shopKey(owner, id);
  const current = states.get(key);
  if (current?.status === "ready" && current.deleted) return;
  update(key, deletedEntry(current?.status === "ready" ? current.updated : undefined));
}

/** Forgets one shop's details (for example after its owner edits it), so its card reads it again. */
export function forgetShopDetails(owner: string, id: string): void {
  if (states.delete(shopKey(owner, id))) changed();
}

/** Pull to refresh: shops that couldn't be read get another chance. */
export function forgetFailedShopDetails(): void {
  let dropped = false;
  for (const [key, state] of states) {
    if (state.status === "failed") {
      states.delete(key);
      dropped = true;
    }
  }
  if (dropped) changed();
}

/** One shop's details, re-rendering when they change. */
export function useShopDetails(key: string): ShopDetails | undefined {
  return useSyncExternalStore(subscribeShopDetails, () => states.get(key));
}

/** Every shop's details, re-rendering whenever any of them change (for filters that read them). */
export function useShopDetailsSnapshot(): ShopDetailsSnapshot {
  return useSyncExternalStore(subscribeShopDetails, () => snapshot);
}

/** For tests. */
export function resetShopDetails(): void {
  states.clear();
  running.clear();
  changed();
}
