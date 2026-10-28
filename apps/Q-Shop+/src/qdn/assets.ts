/**
 * Qortal assets (Q-Assets), read from the node only, as the Q-Assets app
 * reads them (gitea.qortal.link/crowetic/Q-Assets, src/utils/qortalAssetRequests.ts):
 * `/assets/info?assetId=` or `?assetName=` for one asset (Core matches the
 * name exactly, case and all), and `/assets?includeData=false` for the list.
 * Core names an asset `name` in both (`assetName` is only a transaction's
 * field); this app read `assetName` and so found no asset at all on a real
 * node. Core has no search by name, so the list (93 assets on mainnet,
 * 2026-10-22) is read once a session, paged, and searched here as the seller
 * types (`suggestAssets`).
 *
 * Asset 0 is QORT, which every shop takes anyway; an unspendable asset can't
 * be transferred, so buyers couldn't pay with it; an indivisible one is paid
 * in whole units only.
 */
import type { ShopAsset } from "../money/coins";

export interface CoreAsset {
  assetId: number;
  assetName: string;
  owner?: string;
  description?: string;
  isDivisible?: boolean;
  isUnspendable?: boolean;
}

export const ASSET_PAGE = 20;

const infoCache = new Map<string, Promise<CoreAsset | null>>();
const pageCache = new Map<number, Promise<CoreAsset[]>>();

function notFound(): Error {
  return Object.assign(new Error("Not found"), { notFound: true });
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { method: "GET", headers: { "Content-Type": "application/json" } });
  // Core answers an unknown id or name with INVALID_ASSET_ID: HTTP 400 (or 404), or an error body.
  if (response.status === 400 || response.status === 404) throw notFound();
  if (!response.ok) throw new Error(`The node answered ${response.status}`);
  let body: unknown;
  try {
    body = JSON.parse(await response.text());
  } catch {
    throw new Error("The node's answer wasn't readable");
  }
  if (body && typeof body === "object" && !Array.isArray(body) && "error" in body) throw notFound();
  return body;
}

/** Core's asset JSON (`{assetId, name, …}`; `assetName` read too, should a node or app write that). */
export function toAsset(raw: any): CoreAsset | null {
  const id = Number(raw?.assetId);
  const name = typeof raw?.name === "string" ? raw.name : typeof raw?.assetName === "string" ? raw.assetName : null;
  if (!Number.isSafeInteger(id) || id < 0 || name === null) return null;
  return {
    assetId: id,
    assetName: name,
    owner: typeof raw.owner === "string" ? raw.owner : undefined,
    description: typeof raw.description === "string" ? raw.description : undefined,
    isDivisible: raw.isDivisible === true,
    isUnspendable: raw.isUnspendable === true,
  };
}

/** What the seller typed: an id (digits, an optional leading #) or an exact name. */
export function parseAssetQuery(text: string): { id: number } | { name: string } | null {
  const t = text.trim();
  if (!t) return null;
  const digits = t.replace(/^#/, "");
  if (/^\d+$/.test(digits)) {
    const id = Number(digits);
    return Number.isSafeInteger(id) ? { id } : null;
  }
  return { name: t };
}

/** One asset by id or exact name; null when the node has no such asset. Rejects when the node can't be asked. */
export function assetInfo(query: { id: number } | { name: string }): Promise<CoreAsset | null> {
  const url =
    "id" in query
      ? `/assets/info?assetId=${encodeURIComponent(String(query.id))}`
      : `/assets/info?assetName=${encodeURIComponent(query.name)}`;
  const hit = infoCache.get(url);
  if (hit) return hit;
  const request = getJson(url).then(
    (body) => toAsset(body),
    (error) => {
      if ((error as { notFound?: boolean }).notFound) return null;
      infoCache.delete(url);
      throw error;
    }
  );
  infoCache.set(url, request);
  return request;
}

/** A page of every asset, oldest first. */
export function listAssets(page: number): Promise<CoreAsset[]> {
  const hit = pageCache.get(page);
  if (hit) return hit;
  const request = getJson(`/assets?includeData=false&limit=${ASSET_PAGE}&offset=${page * ASSET_PAGE}&reverse=false`).then(
    (body) => (Array.isArray(body) ? body.map(toAsset).filter((a): a is CoreAsset => a !== null) : []),
    (error) => {
      pageCache.delete(page);
      throw error;
    }
  );
  pageCache.set(page, request);
  return request;
}

/** The most of the list read (pages of ASSET_LIST_PAGE): 10 times mainnet's 93 today. */
export const ASSET_LIST_PAGE = 100;
export const ASSET_LIST_MAX_PAGES = 10;

let allAssets: Promise<CoreAsset[]> | null = null;

/** Every asset on the node, oldest first, read once a session (paged, at most 1,000). */
export function loadAllAssets(): Promise<CoreAsset[]> {
  if (allAssets) return allAssets;
  const request = (async () => {
    const out: CoreAsset[] = [];
    for (let page = 0; page < ASSET_LIST_MAX_PAGES; page++) {
      const body = await getJson(`/assets?includeData=false&limit=${ASSET_LIST_PAGE}&offset=${page * ASSET_LIST_PAGE}&reverse=false`);
      const rows = Array.isArray(body) ? body : [];
      out.push(...rows.map(toAsset).filter((a): a is CoreAsset => a !== null));
      if (rows.length < ASSET_LIST_PAGE) break;
    }
    return out;
  })();
  allAssets = request;
  request.catch(() => {
    if (allAssets === request) allAssets = null;
  });
  return request;
}

/**
 * The assets that best match what the seller typed, best first: the id
 * ("88" or "#88"), then the name exactly (any case), then names starting
 * with it, then words starting with it, then names containing it; shorter
 * names first within each. QORT (asset 0) is left out.
 */
export function suggestAssets(all: CoreAsset[], text: string, limit = 8): CoreAsset[] {
  const t = text.trim().toLowerCase();
  if (!t) return [];
  const id = /^#?\d+$/.test(t) ? Number(t.replace(/^#/, "")) : null;
  const scored: { asset: CoreAsset; rank: number }[] = [];
  for (const asset of all) {
    if (asset.assetId === 0) continue;
    const name = asset.assetName.toLowerCase();
    let rank = -1;
    if (id !== null && asset.assetId === id) rank = 0;
    else if (name === t) rank = 1;
    else if (name.startsWith(t)) rank = 2;
    else if (name.split(/[\s\-_.]+/).some((word) => word.startsWith(t))) rank = 3;
    else if (name.includes(t)) rank = 4;
    if (rank >= 0) scored.push({ asset, rank });
  }
  return scored
    .sort((a, b) => a.rank - b.rank || a.asset.assetName.length - b.asset.assetName.length || a.asset.assetId - b.asset.assetId)
    .slice(0, limit)
    .map((s) => s.asset);
}

/** A whole number of units (an indivisible asset can only move whole units). */
export function isWholeAmount(amount: string | number): boolean {
  const n = Number(amount);
  return Number.isFinite(n) && Math.abs(n - Math.round(n)) < 1e-9;
}

/** Why an asset can't be added to the shop, or null. */
export function assetProblem(asset: CoreAsset, accepted: ShopAsset[]): string | null {
  if (asset.assetId === 0) return "QORT is always accepted.";
  if (asset.isUnspendable) return `${asset.assetName} can't be transferred, so buyers couldn't pay with it.`;
  if (accepted.some((a) => a.id === asset.assetId)) return `${asset.assetName} is already accepted.`;
  return null;
}

export function toShopAsset(asset: CoreAsset): ShopAsset {
  return { id: asset.assetId, name: asset.assetName };
}

/** For tests. */
export function resetAssetCache(): void {
  infoCache.clear();
  pageCache.clear();
  allAssets = null;
}
