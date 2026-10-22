/**
 * The home page's list of shops (docs/apps/Q-Shop+.md → Missing features 1–2).
 *
 * - The shop index: one paged, cached search of every STORE resource with
 *   its metadata, so titles and descriptions show at once, without fetching
 *   each shop's JSON (which carries the logo as a data URL). Pages of 100, at
 *   most five; past 500 shops the home page says it shows the newest 500.
 * - The text search: Core's `query`, which matches the publisher's name, the
 *   identifier, the title and the description.
 *
 * Both read the same data the original Q-Shop's home page reads (STORE
 * resources under `q-store-general-`); nothing here writes.
 */
import { isStoreIdentifier, shortStoreIdOf, STORE_BASE } from "../qdn/identifiers";
import { searchQdn, searchQdnAll, type QdnResourceSummary } from "../qdn/search";
import { plainStoreDescription } from "../hooks/useOwnShops";

/**
 * The original Q-Shop hides this name's shop from its home page: it is a test
 * shop ("Get rid of the Bester shop (test shop)", upstream StoreList.tsx).
 */
export const HIDDEN_TEST_SHOP_OWNER = "Bester";

export const SHOP_INDEX_PAGE_SIZE = 100;
export const SHOP_INDEX_MAX_PAGES = 5;
/** The most shops the index holds: "Showing the newest 500" past this. */
export const SHOP_INDEX_LIMIT = SHOP_INDEX_PAGE_SIZE * SHOP_INDEX_MAX_PAGES;
/** Search results per page. */
export const SHOP_SEARCH_PAGE = 20;

const STORE_PREFIX = `${STORE_BASE}-`;

/** One shop as the home page knows it from its search row. */
export interface ShopEntry {
  /** Owner and id together: two names can publish the same shop id. */
  key: string;
  owner: string;
  /** `q-store-general-<shortStoreId>` */
  id: string;
  shortStoreId: string;
  title: string;
  /** The metadata description without the original's `**coins:…**` marker. */
  description: string;
  created: number;
  /** When the STORE resource was last published (its `created` if never updated). */
  updated: number;
  /** The metadata marker says the shop takes ARRR (`**coins:QORTtrue,ARRRtrue**`). */
  acceptsArrr: boolean;
}

export function shopKey(owner: string, id: string): string {
  return `${owner}\u0000${id}`;
}

const COINS_MARKER = /^\*\*coins:([^*]*)\*\*/;

/** True when a shop's QDN description carries the original's ARRR marker, `ARRRtrue`. */
export function acceptsArrrFromDescription(description: string | undefined): boolean {
  const marker = (description ?? "").match(COINS_MARKER);
  if (!marker) return false;
  return marker[1].split(",").some((part) => part.trim() === "ARRRtrue");
}

/** A search row as a shop, or null when it isn't one the home page lists. */
export function shopEntryFromRow(row: QdnResourceSummary): ShopEntry | null {
  if (!row?.name || !isStoreIdentifier(row.identifier ?? "")) return null;
  if (row.name === HIDDEN_TEST_SHOP_OWNER) return null;
  const shortStoreId = shortStoreIdOf(row.identifier);
  const created = row.created ?? 0;
  return {
    key: shopKey(row.name, row.identifier),
    owner: row.name,
    id: row.identifier,
    shortStoreId,
    title: row.metadata?.title?.trim() || shortStoreId,
    description: plainStoreDescription(row.metadata?.description).trim(),
    created,
    updated: row.updated ?? created,
    acceptsArrr: acceptsArrrFromDescription(row.metadata?.description),
  };
}

function entriesFrom(rows: QdnResourceSummary[]): ShopEntry[] {
  const seen = new Set<string>();
  const shops: ShopEntry[] = [];
  for (const row of rows) {
    const entry = shopEntryFromRow(row);
    if (!entry || seen.has(entry.key)) continue;
    seen.add(entry.key);
    shops.push(entry);
  }
  return shops;
}

export interface ShopIndex {
  /** Newest first, as Core returns them. */
  shops: ShopEntry[];
  /** False when there are more shops than the index holds. */
  complete: boolean;
}

/** The last index this session loaded, so Back to the home page paints at once. */
let lastIndex: ShopIndex | null = null;

export function peekShopIndex(): ShopIndex | null {
  return lastIndex;
}

/**
 * Every shop, newest first, with title and description from the metadata.
 * `excludeblocked` leaves out names the node blocks. Cached for the session
 * by the search helper; `fresh` asks the node again (pull to refresh).
 */
export async function loadShopIndex(options: { fresh?: boolean } = {}): Promise<ShopIndex> {
  const { rows, complete } = await searchQdnAll(
    { service: "STORE", identifier: STORE_PREFIX, prefix: true, includemetadata: true, excludeblocked: true },
    { pageSize: SHOP_INDEX_PAGE_SIZE, maxPages: SHOP_INDEX_MAX_PAGES, fresh: options.fresh }
  );
  lastIndex = { shops: entriesFrom(rows), complete };
  return lastIndex;
}

/**
 * Does the text appear in the shop's owner, short id, title or description?
 * Core matched the raw fields: every identifier starts with
 * `q-store-general-` and every metadata description with the coins marker,
 * so "store", "arrr" or "true" would otherwise match every shop.
 */
export function matchesShopQuery(shop: ShopEntry, text: string): boolean {
  const needle = text.trim().toLowerCase();
  if (!needle) return true;
  return [shop.owner, shop.shortStoreId, shop.title, shop.description].some((field) =>
    field.toLowerCase().includes(needle)
  );
}

export interface ShopSearchPage {
  shops: ShopEntry[];
  /** Rows Core returned, before the checks above: the next page's offset moves by this. */
  rowCount: number;
  hasMore: boolean;
}

/**
 * One page of shops matching `text` (owner name, id, title or description).
 *
 * Deliberately without `prefix`: Core applies `prefix=true` to `query` as well
 * as `identifier` (HSQLDBArbitraryRepository.searchArbitraryResources, and
 * the same in its resource cache), which would turn the text search into
 * "starts with". Without it the identifier matches anywhere, so rows are
 * checked to start with `q-store-general-` here.
 */
export async function searchShopsPage(
  text: string,
  offset: number,
  options: { fresh?: boolean } = {}
): Promise<ShopSearchPage> {
  const query = text.trim();
  const rows = await searchQdn(
    {
      service: "STORE",
      identifier: STORE_PREFIX,
      query,
      includemetadata: true,
      excludeblocked: true,
      limit: SHOP_SEARCH_PAGE,
      offset,
    },
    { fresh: options.fresh }
  );
  return {
    shops: entriesFrom(rows).filter((shop) => matchesShopQuery(shop, query)),
    rowCount: rows.length,
    hasMore: rows.length >= SHOP_SEARCH_PAGE,
  };
}

/** For tests. */
export function resetShopIndexMemory(): void {
  lastIndex = null;
}
