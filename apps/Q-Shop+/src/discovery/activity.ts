/**
 * How busy each shop is, from one paged search of the shops' product indexes
 * (the DOCUMENT `<storeId>-datacontainer` each shop publishes and republishes
 * whenever its products change; docs/apps/Q-Shop+.md → Data contract):
 * - its `updated` time: when the shop's products last changed (Recently active);
 * - its `size` in bytes: grows by about 120 bytes per product, so it stands in
 *   for the number of products (Most products) without fetching any index.
 * Loaded only when one of those two sorts asks for it.
 */
import { DATA_CONTAINER_BASE, isStoreIdentifier, STORE_BASE } from "../qdn/identifiers";
import { searchQdnAll, type QdnResourceSummary } from "../qdn/search";
import { shopKey } from "./shopIndex";

export const ACTIVITY_INDEX_PAGE_SIZE = 100;
export const ACTIVITY_INDEX_MAX_PAGES = 5;

export interface ShopActivity {
  /** When the product index was last published. */
  updated: number;
  /** Its size in bytes. */
  size: number;
}

export interface ActivityIndex {
  /** By shopKey(owner, storeId). */
  byShop: Map<string, ShopActivity>;
  complete: boolean;
}

const SUFFIX = `-${DATA_CONTAINER_BASE}`;

export function buildActivityIndex(rows: QdnResourceSummary[], complete = true): ActivityIndex {
  const byShop = new Map<string, ShopActivity>();
  for (const row of rows) {
    if (!row?.name || !row.identifier?.endsWith(SUFFIX)) continue;
    const storeId = row.identifier.slice(0, -SUFFIX.length);
    if (!isStoreIdentifier(storeId)) continue;
    const key = shopKey(row.name, storeId);
    const updated = row.updated ?? row.created ?? 0;
    const previous = byShop.get(key);
    if (previous && previous.updated >= updated) continue;
    byShop.set(key, { updated, size: row.size ?? 0 });
  }
  return { byShop, complete };
}

let lastActivity: ActivityIndex | null = null;

export function peekActivity(): ActivityIndex | null {
  return lastActivity;
}

export async function loadActivity(options: { fresh?: boolean } = {}): Promise<ActivityIndex> {
  const { rows, complete } = await searchQdnAll(
    { service: "DOCUMENT", identifier: `${STORE_BASE}-`, prefix: true, excludeblocked: true },
    { pageSize: ACTIVITY_INDEX_PAGE_SIZE, maxPages: ACTIVITY_INDEX_MAX_PAGES, fresh: options.fresh }
  );
  lastActivity = buildActivityIndex(rows, complete);
  return lastActivity;
}

/** For tests. */
export function resetActivityMemory(): void {
  lastActivity = null;
}
