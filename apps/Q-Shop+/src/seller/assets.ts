/**
 * Qortal assets (Q-Assets) a shop can accept, read from the node only:
 * `/assets/info?assetId=` or `?assetName=` for one asset (Core matches the
 * name exactly), and `/assets?limit=&offset=` for a page to browse. Reads are
 * small, paged and kept for the session. Asset 0 is QORT, which every shop
 * takes anyway; an unspendable asset can't be transferred, so buyers couldn't
 * pay with it.
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

function toAsset(raw: any): CoreAsset | null {
  const id = Number(raw?.assetId);
  if (!Number.isSafeInteger(id) || id < 0 || typeof raw?.assetName !== "string") return null;
  return {
    assetId: id,
    assetName: raw.assetName,
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
}
