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
 */
import { useSyncExternalStore } from "react";
import { fetchQdnJson, mapWithConcurrency } from "../qdn/search";
import { checkStructureStore } from "../utils/checkStructure";
import type { ShopAsset } from "../money/coins";
import { shopKey, type ShopEntry } from "./shopIndex";

/** The STORE JSON as the original writes it (docs/apps/Q-Shop+.md → Data contract). */
export interface ShopJson {
  title?: string;
  description?: string;
  location?: string;
  shipsTo?: string;
  created?: number;
  shortStoreId?: string;
  logo?: string;
  supportedCoins?: string[];
  foreignCoins?: Record<string, string>;
  acceptedAssets?: ShopAsset[];
}

export type ShopDetails =
  | { status: "loading" }
  /** Not on the node yet: asking again (attempt 1–3). */
  | { status: "retrying"; attempt: number }
  /** `valid` is the original's check (title, created, description, shipsTo, shortStoreId). */
  | { status: "ready"; shop: ShopJson; valid: boolean }
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
 * Loads a shop's JSON unless it is loaded or loading. With `retries: false`
 * (the "Pays in" check) one attempt is made, and a card that shows the shop
 * later still gets its own retries.
 */
export function requestShopDetails(
  owner: string,
  id: string,
  options: { retries?: boolean } = {}
): Promise<ShopDetails> {
  const retries = options.retries ?? true;
  const key = shopKey(owner, id);
  const pending = running.get(key);
  if (pending) return pending;
  const current = states.get(key);
  if (current?.status === "ready") return Promise.resolve(current);
  if (current?.status === "failed" && (current.final || !retries)) return Promise.resolve(current);

  const attempts = retries ? DETAIL_RETRY_DELAYS_MS.length + 1 : 1;
  const job = (async (): Promise<ShopDetails> => {
    update(key, { status: "loading" });
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (attempt > 0) {
        update(key, { status: "retrying", attempt });
        await wait(DETAIL_RETRY_DELAYS_MS[attempt - 1]);
      }
      try {
        const shop = await fetchQdnJson<ShopJson>("STORE", owner, id, { fresh: attempt > 0 });
        const valid = Boolean(shop) && typeof shop === "object" && !Array.isArray(shop) && checkStructureStore(shop);
        return update(key, { status: "ready", shop: valid ? shop : {}, valid });
      } catch {
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

/** Reads the coins of shops a "Pays in" filter hasn't checked yet, five at a time, one attempt each. */
export async function checkShopDetails(shops: ShopEntry[]): Promise<void> {
  await mapWithConcurrency(shops, DETAIL_CHECK_CONCURRENCY, (shop) =>
    requestShopDetails(shop.owner, shop.id, { retries: false })
  );
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
