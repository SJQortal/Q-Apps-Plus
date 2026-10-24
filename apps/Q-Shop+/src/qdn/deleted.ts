/**
 * Deleted shops, as lists can tell before reading anything:
 * - a shop deleted from Q-Shop+ is republished as "D" titled and tagged
 *   "deleted" (qdn/payloads.ts buildDeleteShopPublish), so a search row with
 *   that metadata is left out without reading the shop (isDeletedRow);
 *   a shop deleted by another tool shows as deleted once it is read
 *   (qdn/search.ts QdnDeletedError);
 * - right after a delete, the node can go on listing the shop with its old
 *   metadata (and serving its old JSON) until a block confirms it, so the
 *   shops this browser deleted are remembered for an hour, with when
 *   (noteDeletedShop). The memory only explains what is older than the
 *   delete: a search row updated after it, or a shop JSON created after it,
 *   is a shop created again under the id (perhaps on another device), and
 *   shows as such.
 */
import { DELETED_SHOPS_STORAGE_KEY } from "../constants/plus";
import { QdnDeletedError, fetchQdnJson, type QdnResourceSummary } from "./search";

/** The title, description and tag a delete writes. */
export const DELETED_TITLE = "deleted";

/** How long a delete from this browser is remembered. */
export const DELETED_SHOP_MEMORY_MS = 60 * 60 * 1000;

/** A search row whose metadata a Q-Shop+ delete wrote (a shop, product list or catalogue). */
export function isDeletedRow(row: Pick<QdnResourceSummary, "metadata"> | null | undefined): boolean {
  const meta = row?.metadata;
  if (meta?.title !== DELETED_TITLE) return false;
  return (Array.isArray(meta.tags) && meta.tags.includes(DELETED_TITLE)) || meta.description === DELETED_TITLE;
}

const keyOf = (owner: string, storeId: string) => `${owner}\n${storeId}`;

let memory: Record<string, number> | null = null;

function load(): Record<string, number> {
  if (memory) return memory;
  memory = {};
  try {
    const stored = JSON.parse(localStorage.getItem(DELETED_SHOPS_STORAGE_KEY) ?? "{}");
    if (stored && typeof stored === "object" && !Array.isArray(stored)) {
      for (const [key, at] of Object.entries(stored)) if (typeof at === "number") memory[key] = at;
    }
  } catch {
    // Unreadable or blocked storage: remember for this tab only.
  }
  return memory;
}

function save(): void {
  try {
    localStorage.setItem(DELETED_SHOPS_STORAGE_KEY, JSON.stringify(memory ?? {}));
  } catch {
    // Storage full or blocked: the in-tab memory still works.
  }
}

/** Drops deletes older than the memory keeps. */
function prune(now: number): void {
  const all = load();
  let dropped = false;
  for (const [key, at] of Object.entries(all)) {
    if (now - at > DELETED_SHOP_MEMORY_MS) {
      delete all[key];
      dropped = true;
    }
  }
  if (dropped) save();
}

/** This browser deleted the shop just now. */
export function noteDeletedShop(owner: string, storeId: string, now = Date.now()): void {
  prune(now);
  load()[keyOf(owner, storeId)] = now;
  save();
}

/** The shop was created again under the id. */
export function forgetDeletedShop(owner: string, storeId: string): void {
  const all = load();
  if (!(keyOf(owner, storeId) in all)) return;
  delete all[keyOf(owner, storeId)];
  save();
}

/** When this browser deleted the shop, within the last hour; else null. */
export function deletedShopAt(owner: string, storeId: string, now = Date.now()): number | null {
  const at = load()[keyOf(owner, storeId)];
  return typeof at === "number" && now - at <= DELETED_SHOP_MEMORY_MS ? at : null;
}

/** This browser deleted the shop within the last hour. */
export function isRecentlyDeletedShop(owner: string, storeId: string, now = Date.now()): boolean {
  return deletedShopAt(owner, storeId, now) !== null;
}

/** A search row from before this browser deleted the shop (the node hasn't caught up yet). */
export function isRowFromBeforeDelete(row: Pick<QdnResourceSummary, "name" | "identifier" | "created" | "updated">): boolean {
  const at = deletedShopAt(row.name, row.identifier);
  return at !== null && (row.updated ?? row.created ?? 0) <= at;
}

/** The shop's JSON is from before this browser deleted it: a shop created again would be newer. */
export function isJsonFromBeforeDelete(owner: string, storeId: string, json: unknown): boolean {
  const at = deletedShopAt(owner, storeId);
  if (at === null) return false;
  const created = (json as { created?: unknown } | null)?.created;
  return !(typeof created === "number" && created > at);
}

/**
 * Was this shop deleted? One fresh read: a delete marker or tombstone is
 * deleted; the JSON of a shop is deleted only when this browser deleted it
 * after that shop was created (the node lagging); a read that fails counts
 * as this browser's memory says. Anything else is a live shop, which
 * creating a shop over is then refused, as it always was.
 */
export async function isShopDeleted(owner: string, storeId: string): Promise<boolean> {
  try {
    const json = await fetchQdnJson("STORE", owner, storeId, { fresh: true });
    return isJsonFromBeforeDelete(owner, storeId, json);
  } catch (error) {
    return error instanceof QdnDeletedError || isRecentlyDeletedShop(owner, storeId);
  }
}

/** For tests: forget everything, here and in storage. */
export function resetDeletedShops(): void {
  memory = {};
  try {
    localStorage.removeItem(DELETED_SHOPS_STORAGE_KEY);
  } catch {
    // nothing stored
  }
}
