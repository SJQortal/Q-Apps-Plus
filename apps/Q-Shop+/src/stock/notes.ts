/**
 * Reading the shop's order notes (stock/model.ts): its orders' search rows,
 * newest first with their metadata, in pages of 100 back to the oldest count
 * on screen (at most 1,000 rows), so nothing is fetched or decrypted. The
 * prefix also matches longer shop ids (`my-shop-2`), so the shop is compared
 * exactly; a note counts only for the product uid it names. Only shops with a
 * counted product are read at all, through the session's search cache.
 */
import { useEffect, useMemo, useState } from "react";
import { shopOrdersPrefix, shortStoreIdOfOrder } from "../qdn/identifiers";
import { invalidateQdnSearches, searchQdn } from "../qdn/search";
import { orderUidOf, parseStockNote, soldSince, stockLeft, type ProductStock, type StockNote } from "./model";

export const NOTES_PAGE = 100;
export const NOTES_MAX_PAGES = 10;

/** The shop's order notes since `since`; `complete` is false when there were more rows than were read. */
export async function fetchStockNotes(shortStoreId: string, since: number, options: { fresh?: boolean } = {}): Promise<{ notes: StockNote[]; complete: boolean }> {
  const notes: StockNote[] = [];
  for (let page = 0; page < NOTES_MAX_PAGES; page++) {
    const rows = await searchQdn(
      { service: "DOCUMENT_PRIVATE", identifier: shopOrdersPrefix(shortStoreId), prefix: true, includemetadata: true, reverse: true, limit: NOTES_PAGE, offset: page * NOTES_PAGE },
      options
    );
    for (const row of rows) {
      if (!row?.name || shortStoreIdOfOrder(row.identifier) !== shortStoreId) continue;
      const created = Number(row.created);
      const orderUid = orderUidOf(row.identifier);
      if (!orderUid || !Number.isFinite(created) || created < since) continue;
      const items = parseStockNote(row.metadata?.description);
      if (items.size > 0) notes.push({ orderUid, buyer: row.name, created, items });
    }
    const oldest = rows.length > 0 ? Number(rows[rows.length - 1].created) : NaN;
    if (rows.length < NOTES_PAGE || (Number.isFinite(oldest) && oldest < since)) return { notes, complete: true };
  }
  return { notes, complete: false };
}

/** After the buyer's own order: the next read of the shop's notes is fresh. */
export function invalidateStockNotes(shortStoreId: string): void {
  // As buildSearchUrl writes the parameter.
  const param = new URLSearchParams({ identifier: shopOrdersPrefix(shortStoreId) }).toString();
  invalidateQdnSearches((url) => url.includes(param));
}

/** A counted product, with its shop. */
export interface StockItem {
  shortStoreId: string;
  productId: string;
  stock: ProductStock;
}

export interface StockLeft {
  /** Units left by product id, for the counted products whose shop's notes are in. */
  left: Map<string, number>;
  /** Notes by shop (short id), as read. */
  notes: Map<string, StockNote[]>;
  loading: boolean;
  failed: boolean;
}

/** One read per shop: back to its oldest count among `items`. */
function shopReads(items: readonly StockItem[]): Map<string, number> {
  const since = new Map<string, number>();
  for (const item of items) since.set(item.shortStoreId, Math.min(since.get(item.shortStoreId) ?? Infinity, item.stock.since));
  return since;
}

/**
 * What's left of each counted product among `items` (any shops): one read of
 * each shop's notes, cached for the session. Products without a count are
 * never passed in, so a shop without one costs nothing.
 */
export function useStockLeft(items: readonly StockItem[], nonce = 0): StockLeft {
  // Callers pass a new array each render: everything below hangs on its contents.
  const key = JSON.stringify(items.map((i) => [i.shortStoreId, i.productId, i.stock.quantity, i.stock.since, i.stock.voided ?? []]));
  const parsed = useMemo<StockItem[]>(
    () =>
      (JSON.parse(key) as [string, string, number, number, string[]][]).map(([shortStoreId, productId, quantity, since, voided]) => ({
        shortStoreId,
        productId,
        stock: { v: 1, quantity, since, ...(voided.length > 0 && { voided }) },
      })),
    [key]
  );
  const reads = useMemo(() => shopReads(parsed), [parsed]);
  const [results, setResults] = useState<Map<string, StockNote[] | "failed">>(() => new Map());

  useEffect(() => {
    let alive = true;
    for (const [short, since] of reads) {
      fetchStockNotes(short, since, { fresh: nonce > 0 }).then(
        ({ notes }) => alive && setResults((prev) => new Map(prev).set(`${short}|${since}|${nonce}`, notes)),
        () => alive && setResults((prev) => new Map(prev).set(`${short}|${since}|${nonce}`, "failed"))
      );
    }
    return () => {
      alive = false;
    };
  }, [reads, nonce]);

  return useMemo(() => {
    const left = new Map<string, number>();
    const notes = new Map<string, StockNote[]>();
    let loading = false;
    let failed = false;
    for (const [short, since] of reads) {
      const got = results.get(`${short}|${since}|${nonce}`);
      if (got === undefined) loading = true;
      else if (got === "failed") failed = true;
      else notes.set(short, got);
    }
    for (const item of parsed) {
      const shopNotes = notes.get(item.shortStoreId);
      if (shopNotes) left.set(item.productId, stockLeft(item.stock, soldSince(item.stock, item.productId, shopNotes)));
    }
    return { left, notes, loading, failed };
  }, [results, reads, parsed, nonce]);
}
