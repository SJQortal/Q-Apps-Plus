/**
 * Catalogues: DOCUMENT `q-store-catalogue-<shortStoreId>-<uid>` under the
 * shop owner's name, each holding up to 10 products with their images
 * (docs/apps/Q-Shop+.md → Data contract). The app keeps them in
 * `global.catalogueHashMap` as `{ ...json, id, user, isValid: true }`.
 */
import type { Catalogue } from "../state/features/globalSlice";
import { QdnDeletedError, fetchQdnJson, isDeletedBody } from "../qdn/search";

/** Catalogue fetches in flight at once, across every screen. */
export const CATALOGUE_CONCURRENCY = 5;

export interface LoadedCatalogue extends Catalogue {
  user: string;
  isValid: true;
}

let active = 0;
const waiting: (() => void)[] = [];

/** Runs `task` once fewer than CATALOGUE_CONCURRENCY catalogue fetches are running. */
async function withSlot<T>(task: () => Promise<T>): Promise<T> {
  if (active >= CATALOGUE_CONCURRENCY) {
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  active++;
  try {
    return await task();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

export function isCatalogueJson(json: unknown): json is { products: Record<string, unknown> } {
  return !!json && typeof json === "object" && !Array.isArray(json) && !!(json as { products?: unknown }).products &&
    typeof (json as { products?: unknown }).products === "object";
}

/** A catalogue its owner deleted (the delete marker): it holds no products, so its products show as gone. */
export function deletedCatalogue(owner: string, catalogueId: string): LoadedCatalogue {
  return { id: catalogueId, products: {}, user: owner, isValid: true };
}

/**
 * One catalogue, through the session cache (one request per catalogue,
 * shared by every screen). The id and owner are the ones asked for, never
 * the body's (docs/QORTAL.md → pitfall 15). Rejects when the node can't give
 * it or it isn't a catalogue; a deleted one is empty.
 */
export async function fetchCatalogue(owner: string, catalogueId: string, options: { fresh?: boolean } = {}): Promise<LoadedCatalogue> {
  let json: unknown;
  try {
    json = await withSlot(() => fetchQdnJson("DOCUMENT", owner, catalogueId, options));
  } catch (error) {
    if (error instanceof QdnDeletedError) return deletedCatalogue(owner, catalogueId);
    throw error;
  }
  if (!isCatalogueJson(json)) throw new Error("Not a catalogue");
  return { ...(json as object), products: json.products as Catalogue["products"], user: owner, id: catalogueId, isValid: true };
}

/**
 * The original's helper:
 * FETCH_QDN_RESOURCE through Hub, `{ isValid: false }` when there is nothing.
 */
export const fetchAndEvaluateCatalogues = async (data: any) => {
  const { user, catalogueId } = data ?? {};
  if (!user || !catalogueId) return { isValid: false };
  try {
    const catalogue = await qortalRequest({
      action: "FETCH_QDN_RESOURCE",
      name: user,
      service: "DOCUMENT",
      identifier: catalogueId,
    });
    if (!catalogue) return { isValid: false };
    // + app: a deleted catalogue (Hub hands back the "D" marker's text, or a tombstone).
    if (isDeletedBody(catalogue)) return deletedCatalogue(user, catalogueId);
    return { ...catalogue, user, id: catalogueId, isValid: true };
  } catch (error) {
    console.error(error);
    return undefined;
  }
};
