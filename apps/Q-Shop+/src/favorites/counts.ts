/**
 * How many buyers keep each shop and product as a favourite
 * (favorites/model.ts), for the Shops and Products sorts and the cards: one
 * paged search of every favourite's row (with its metadata, so nothing is
 * fetched), kept for the session like the ratings (discovery/ratings.ts).
 */
import { useEffect, useState } from "react";
import { searchQdnAll } from "../qdn/search";
import { FAV_BASE, buildFavoriteCounts, type FavoriteCounts } from "./model";

export const FAVORITES_INDEX_PAGE_SIZE = 100;
export const FAVORITES_INDEX_MAX_PAGES = 10;

let last: FavoriteCounts | null = null;

/** The counts this session already loaded, if any. */
export function peekFavoriteCounts(): FavoriteCounts | null {
  return last;
}

export async function loadFavoriteCounts(options: { fresh?: boolean } = {}): Promise<FavoriteCounts> {
  const { rows, complete } = await searchQdnAll(
    { service: "DOCUMENT", identifier: FAV_BASE, prefix: true, includemetadata: true, excludeblocked: true },
    { pageSize: FAVORITES_INDEX_PAGE_SIZE, maxPages: FAVORITES_INDEX_MAX_PAGES, fresh: options.fresh }
  );
  last = buildFavoriteCounts(rows, complete);
  return last;
}

/** The counts for a card or a page: null until they're in (or when they can't be read: nothing is shown then). */
export function useFavoriteCounts(enabled = true): FavoriteCounts | null {
  const [counts, setCounts] = useState<FavoriteCounts | null>(() => peekFavoriteCounts());
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loadFavoriteCounts().then(
      (next) => alive && setCounts(next),
      () => {}
    );
    return () => {
      alive = false;
    };
  }, [enabled]);
  return enabled ? counts : null;
}

/** For tests. */
export function resetFavoriteCountsMemory(): void {
  last = null;
}
