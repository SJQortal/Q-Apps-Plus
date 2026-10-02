/**
 * One cached door for "does this name exist, and what are its owner address
 * and public key?" (docs/QORTAL.md → Efficiency rule 5).
 *
 * - `lookupName(name)`  → GET_NAME_DATA once per name per session
 *                         (a miss is remembered for 30 s);
 * - `resolveName(name)` → the above plus GET_ACCOUNT_DATA once per address;
 * - identical lookups in flight share one promise.
 *
 * The composer uses it for inline "is this a registered name?" validation,
 * for Bcc chips, for reply-all and at send time, so a name the user typed is
 * looked up once, not three times.
 */

import { errorMessage, isHubTimeout } from "./hubErrors";

export interface ResolvedName {
  name: string;
  address: string;
  publicKey: string;
}

export type NameLookup =
  | { status: "found"; name: string; address: string }
  | { status: "missing" };

const MISSING_TTL_MS = 30_000;

const names = new Map<string, { at: number; value: NameLookup }>();
const keys = new Map<string, string>();
const inFlightNames = new Map<string, Promise<NameLookup>>();
const inFlightKeys = new Map<string, Promise<string>>();
let stats = { nameRequests: 0, keyRequests: 0, hits: 0 };

export function normalizeName(name: unknown): string {
  return typeof name === "string" ? name.trim().toLowerCase() : "";
}

/**
 * The `query` for a SEARCH_NAMES request. Core's q-apps.js appends the raw
 * string to `/names/search?query=`, so a "+" in a name (they are allowed)
 * reaches the node as a space and the search misses. Only the "+" is encoded
 * (as %2B); everything else is left exactly as q-apps.js has always sent it,
 * so names with spaces, apostrophes or non-ASCII letters keep working.
 */
export function searchNamesQuery(name: string): string {
  return name.replace(/\+/g, "%2B");
}

/**
 * Transport failures (q-apps.js's or Hub's timeout, a node that is down) are
 * not "name does not exist": rethrow them, cache nothing. Core answers an
 * unknown name with a 404 error body, which stays a miss.
 */
function isTransportError(error: unknown): boolean {
  if (isHubTimeout(error)) return true;
  const text = errorMessage(error, "").toLowerCase();
  return text.includes("network") || text.includes("failed to fetch");
}

/** Owner address of a registered name, or `missing`. Never throws for an unknown name. */
export function lookupName(name: string): Promise<NameLookup> {
  const key = normalizeName(name);
  if (!key) return Promise.resolve({ status: "missing" });

  const cached = names.get(key);
  if (cached) {
    const fresh = cached.value.status === "found" || Date.now() - cached.at < MISSING_TTL_MS;
    if (fresh) {
      stats.hits += 1;
      return Promise.resolve(cached.value);
    }
  }

  const running = inFlightNames.get(key);
  if (running) return running;

  const request = (async (): Promise<NameLookup> => {
    stats.nameRequests += 1;
    let value: NameLookup;
    try {
      const data = await qortalRequest({ action: "GET_NAME_DATA", name: name.trim() });
      const owner = typeof data?.owner === "string" ? data.owner.trim() : "";
      const registered = typeof data?.name === "string" && data.name.trim() ? data.name.trim() : name.trim();
      value = owner ? { status: "found", name: registered, address: owner } : { status: "missing" };
    } catch (error) {
      if (isTransportError(error)) throw error;
      value = { status: "missing" };
    }
    names.set(key, { at: Date.now(), value });
    return value;
  })();

  inFlightNames.set(key, request);
  return request.finally(() => {
    inFlightNames.delete(key);
  });
}

/** Public key of an address ("" when the account has never transacted). */
export function lookupPublicKey(address: string): Promise<string> {
  const key = address.trim();
  if (!key) return Promise.resolve("");
  const cached = keys.get(key);
  if (cached) {
    stats.hits += 1;
    return Promise.resolve(cached);
  }
  const running = inFlightKeys.get(key);
  if (running) return running;

  const request = (async () => {
    stats.keyRequests += 1;
    const account = await qortalRequest({ action: "GET_ACCOUNT_DATA", address: key });
    const publicKey = typeof account?.publicKey === "string" ? account.publicKey : "";
    if (publicKey) keys.set(key, publicKey);
    return publicKey;
  })();

  inFlightKeys.set(key, request);
  return request.finally(() => {
    inFlightKeys.delete(key);
  });
}

/** Name → {name, address, publicKey}, or null when the name is unknown or has no key yet. */
export async function resolveName(name: string): Promise<ResolvedName | null> {
  const lookup = await lookupName(name);
  if (lookup.status !== "found") return null;
  const publicKey = await lookupPublicKey(lookup.address);
  if (!publicKey) return null;
  return { name: lookup.name, address: lookup.address, publicKey };
}

export async function nameExists(name: string): Promise<boolean> {
  const lookup = await lookupName(name);
  return lookup.status === "found";
}

/** What the cache already knows, without a request: found / missing / undefined (unknown). */
export function peekName(name: string): NameLookup | undefined {
  const cached = names.get(normalizeName(name));
  if (!cached) return undefined;
  if (cached.value.status === "missing" && Date.now() - cached.at >= MISSING_TTL_MS) return undefined;
  return cached.value;
}

export function nameCacheStats() {
  return { ...stats, names: names.size, keys: keys.size };
}

export function resetNameCache(): void {
  names.clear();
  keys.clear();
  inFlightNames.clear();
  inFlightKeys.clear();
  stats = { nameRequests: 0, keyRequests: 0, hits: 0 };
}
