/**
 * Qortal names for sale (Simon, 2026-10-24: "a new tab … called Names, and
 * there user can sell (or buy) their secondary name together with all the
 * content that secondary names published … there is already this
 * marketplace on the original Qortal/names q-app, I want you to incorporate
 * it very nicely into our q-shop").
 *
 * A name is sold on chain, as the Names app does it (apps/Names+, read
 * 2026-10-24): SELL_NAME {nameForSale, salePrice} lists it, CANCEL_SELL_NAME
 * {nameForSale} takes it off, BUY_NAME {nameForSale} buys it at its price;
 * Core's `/names/forsale` lists every name for sale, so a name listed in the
 * Names app shows here and one listed here shows there. Whatever the name
 * published (websites, videos, apps…) is the name's on QDN, so it goes with
 * the name to its buyer. Nothing is added to the chain or QDN for a sale at
 * a price; auctions are names/auctions.ts.
 *
 * Reads, all from the node: the listings in pages of 100 (at most 2,000; the
 * Names app reads them all with limit=0), once a session and again after a
 * sale of the buyer's own; when each was listed, from the latest SELL_NAME
 * transactions (one page, for the Newest sort); and, per card on screen, the
 * seller's primary name (names/owners) and what the name published
 * (names/content.ts).
 */
export const FOR_SALE_PAGE = 100;
export const FOR_SALE_MAX_PAGES = 20;
/** Session cache of the listings (a sale of the buyer's own clears it). */
export const FOR_SALE_TTL_MS = 2 * 60_000;
/** Recent listings read for the Newest sort. */
export const LISTED_PAGE = 100;

export interface NameForSale {
  name: string;
  /** The owner's address. */
  owner: string;
  /** In QORT. */
  price: number;
  /** When it was registered (ms), when Core says. */
  registered?: number;
}

type Fetch = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;
const plainFetch: Fetch = (url) => fetch(url);

async function getJson(url: string, get: Fetch): Promise<unknown> {
  const response = await get(url);
  if (!response.ok) throw new Error(`The node answered ${url} with an error`);
  return response.json();
}

/** A listing from Core's NameData, or null when it isn't one (no name, no price, not for sale). */
export function listingOf(row: unknown): NameForSale | null {
  const r = row as { name?: unknown; owner?: unknown; salePrice?: unknown; isForSale?: unknown; registered?: unknown } | null;
  if (!r || typeof r.name !== "string" || !r.name.trim() || typeof r.owner !== "string") return null;
  if (r.isForSale === false) return null;
  const price = Number(r.salePrice);
  if (!Number.isFinite(price) || price <= 0) return null;
  const registered = Number(r.registered);
  return { name: r.name, owner: r.owner, price, ...(Number.isFinite(registered) && registered > 0 && { registered }) };
}

let cached: { at: number; listings: NameForSale[]; complete: boolean } | null = null;
let inflight: Promise<{ listings: NameForSale[]; complete: boolean }> | null = null;

/** Every name for sale (at most 2,000; `complete` says whether that was all). */
export async function fetchNamesForSale(options: { fresh?: boolean; get?: Fetch } = {}): Promise<{ listings: NameForSale[]; complete: boolean }> {
  if (!options.fresh && cached && Date.now() - cached.at < FOR_SALE_TTL_MS) return cached;
  if (!options.fresh && inflight) return inflight;
  const get = options.get ?? plainFetch;
  const run = (async () => {
    const listings: NameForSale[] = [];
    const seen = new Set<string>();
    for (let page = 0; page < FOR_SALE_MAX_PAGES; page++) {
      const rows = await getJson(`/names/forsale?limit=${FOR_SALE_PAGE}&offset=${page * FOR_SALE_PAGE}&reverse=true`, get);
      if (!Array.isArray(rows)) throw new Error("The node's names for sale aren't a list");
      for (const row of rows) {
        const listing = listingOf(row);
        if (listing && !seen.has(listing.name)) {
          seen.add(listing.name);
          listings.push(listing);
        }
      }
      if (rows.length < FOR_SALE_PAGE) {
        cached = { at: Date.now(), listings, complete: true };
        return cached;
      }
    }
    cached = { at: Date.now(), listings, complete: false };
    return cached;
  })();
  inflight = run;
  const forget = () => {
    if (inflight === run) inflight = null;
  };
  run.then(forget, forget);
  return run;
}

/** After a sale, a cancel or a purchase: the next read is fresh. */
export function forgetNamesForSale(): void {
  cached = null;
}

/** When each name was last listed, from the latest SELL_NAME transactions (names listed long ago aren't in it). */
export async function fetchListingTimes(get: Fetch = plainFetch): Promise<Map<string, number>> {
  const rows = await getJson(`/transactions/search?txType=SELL_NAME&confirmationStatus=CONFIRMED&limit=${LISTED_PAGE}&reverse=true`, get);
  const times = new Map<string, number>();
  if (!Array.isArray(rows)) return times;
  for (const tx of rows) {
    const name = (tx as { name?: unknown })?.name;
    const at = Number((tx as { timestamp?: unknown })?.timestamp);
    if (typeof name === "string" && Number.isFinite(at) && !times.has(name)) times.set(name, at);
  }
  return times;
}

/** A name as Core holds it now: its owner, whether it's for sale and at what price. */
export interface NameState {
  name: string;
  owner: string;
  forSale: boolean;
  price: number | null;
}

export async function fetchNameState(name: string, get: Fetch = plainFetch): Promise<NameState | null> {
  try {
    const data = (await getJson(`/names/${encodeURIComponent(name)}`, get)) as { name?: unknown; owner?: unknown; isForSale?: unknown; salePrice?: unknown } | null;
    if (!data || typeof data.owner !== "string") return null;
    const price = Number(data.salePrice);
    return { name: typeof data.name === "string" ? data.name : name, owner: data.owner, forSale: data.isForSale === true, price: Number.isFinite(price) && price > 0 ? price : null };
  } catch {
    return null;
  }
}

const primaryNames = new Map<string, Promise<string | null>>();

/** An address's primary name (Core's `/names/primary`), once a session; null when it has none or the node can't say. */
export function primaryNameOf(address: string, get: Fetch = plainFetch): Promise<string | null> {
  let hit = primaryNames.get(address);
  if (!hit) {
    hit = getJson(`/names/primary/${encodeURIComponent(address)}`, get).then(
      (data) => {
        const name = (data as { name?: unknown } | null)?.name;
        return typeof name === "string" && name ? name : null;
      },
      () => null
    );
    primaryNames.set(address, hit);
  }
  return hit;
}

/** The names an address owns, as Hub gives them (GET_ACCOUNT_NAMES), at most 100. */
export async function fetchAccountNames(address: string): Promise<string[]> {
  const rows = await qortalRequest({ action: "GET_ACCOUNT_NAMES", address, limit: 100, offset: 0, reverse: false } as never);
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => (row as { name?: unknown })?.name).filter((name): name is string => typeof name === "string" && !!name);
}

/** For tests. */
export function resetNameCaches(): void {
  cached = null;
  inflight = null;
  primaryNames.clear();
}

/** A short form of an address, enough to recognise it. */
export function shortAddress(address: string): string {
  return address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}
