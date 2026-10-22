/**
 * Deleted shops, as lists can tell before reading anything:
 * - a shop deleted from Q-Shop+ is republished as "D" titled and tagged
 *   "deleted" (qdn/payloads.ts buildDeleteShopPublish), so a search row with
 *   that metadata is left out without reading the shop (isDeletedShopRow);
 *   a shop deleted by another tool shows as deleted once it is read
 *   (qdn/search.ts QdnDeletedError);
 * - right after a delete, the node can go on listing the shop with its old
 *   metadata until a block confirms it, so the shops this browser deleted are
 *   remembered for an hour (noteDeletedShop), per owner and shop id.
 */
import { DELETED_SHOPS_STORAGE_KEY } from "../constants/plus";
import type { QdnResourceSummary } from "./search";

/** The title, description and tag a delete writes. */
export const DELETED_TITLE = "deleted";

/** How long a delete from this browser is remembered. */
export const DELETED_SHOP_MEMORY_MS = 60 * 60 * 1000;

/** A search row whose metadata a Q-Shop+ delete wrote. */
export function isDeletedShopRow(row: Pick<QdnResourceSummary, "metadata"> | null | undefined): boolean {
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

/** This browser deleted the shop within the last hour. */
export function isRecentlyDeletedShop(owner: string, storeId: string, now = Date.now()): boolean {
  const at = load()[keyOf(owner, storeId)];
  return typeof at === "number" && now - at <= DELETED_SHOP_MEMORY_MS;
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
