/**
 * Everything the home page lists, from the query in its URL:
 * - no text: the shop index (one cached search), shown 20 cards at a time;
 * - text: Core's search, a page of 20 at a time;
 * - a sort that needs the shops' product indexes or the reviews loads that
 *   one search on demand, once per session (cached);
 * - a "Pays in" filter for a coin only the shop's JSON knows reads the JSON of
 *   20 more shops each time the end of the list comes into view.
 * Back to the home page shows the same list, as far down as it was.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { loadActivity, peekActivity, type ActivityIndex } from "./activity";
import { loadRatings, peekRatings, type RatingsIndex } from "./ratings";
import { checkShopDetails, forgetFailedShopDetails, useShopDetailsSnapshot } from "./shopDetails";
import { loadShopIndex, peekShopIndex, searchShopsPage, type ShopEntry, type ShopIndex } from "./shopIndex";
import {
  filterShops,
  payNeedsDetails,
  sortNeedsActivity,
  sortShops,
  type FilteredShops,
  type PayFilter,
  type ShopSort,
} from "./sortFilter";

/** Cards per step, and shops checked per step by a "Pays in" filter. */
export const HOME_PAGE_SIZE = 20;

export interface HomeQuery {
  /** Trimmed search text; "" lists every shop. */
  q: string;
  sort: ShopSort;
  pay: PayFilter;
  mine: boolean;
}

type IndexLoad = { status: "loading" } | { status: "ready"; data: ShopIndex } | { status: "error" };

interface SearchResults {
  key: string;
  status: "ready" | "error";
  shops: ShopEntry[];
  nextOffset: number;
  hasMore: boolean;
  loadingMore: boolean;
  pageError: boolean;
}

interface SideIndex<T> {
  data: T | null;
  error: boolean;
}

/** What the end of the list does when it comes into view. */
export type MoreKind = "reveal" | "check" | "search" | null;

/** How many cards the last home list showed and how far it was scrolled, for Back. */
let memory = { listKey: "", count: HOME_PAGE_SIZE, scrollY: 0 };

export function homeListKey(query: HomeQuery): string {
  return [query.q, query.sort, query.pay, query.mine ? "mine" : ""].join("\u0000");
}

const EMPTY: ShopEntry[] = [];

function mergeShops(a: ShopEntry[], b: ShopEntry[]): ShopEntry[] {
  const seen = new Set(a.map((s) => s.key));
  return [...a, ...b.filter((s) => !seen.has(s.key))];
}

export interface HomeShops {
  /** loading: nothing to show yet (or a sort's index is loading); error: the list failed. */
  phase: "loading" | "ready" | "error";
  /** A new search is on its way; the last one's results are on screen meanwhile. */
  searching: boolean;
  /** The list failed because the search did (not the index). */
  searchFailed: boolean;
  /** The cards to show, in order. */
  shops: ShopEntry[];
  /** Every shop in the index (whatever the search and filters), for checks such as "is this a listed shop?". */
  indexShops: ShopEntry[];
  /** Every shop that matches so far (before the 20-at-a-time cut). */
  total: number;
  filtered: FilteredShops;
  /** The index holds the newest 500 shops only. */
  indexIncomplete: boolean;
  /** A text search has more pages. */
  searchHasMore: boolean;
  /** Shops the "Pays in" filter has read so far, and how many it has to go through. */
  checked: { done: number; of: number } | null;
  more: MoreKind;
  /** Loading the next search page or checking shops. */
  busy: boolean;
  /** The last search page failed: the cards stay, with a Retry. */
  pageError: boolean;
  activity: ActivityIndex | null;
  ratings: RatingsIndex | null;
  /** The sort's index failed: the list stays newest first, with a Retry. */
  sortFailed: boolean;
  loadMore: () => void;
  /** Loads the search page that failed again. */
  retryPage: () => void;
  retry: () => void;
  retrySort: () => void;
  refresh: () => Promise<void>;
  /** Call before leaving for a shop, so Back comes back to the same place. */
  remember: () => void;
  /** Where to scroll once the list is back, or 0. */
  restoreScrollY: number;
}

export function useHomeShops(query: HomeQuery, mineKeys: Set<string> | null): HomeShops {
  const { q, sort, pay } = query;
  const listKey = homeListKey(query);

  // ---- the shop index
  const [index, setIndex] = useState<IndexLoad>(() => {
    const cached = peekShopIndex();
    return cached ? { status: "ready", data: cached } : { status: "loading" };
  });
  const [indexRun, setIndexRun] = useState({ n: 0, fresh: false });
  useEffect(() => {
    let alive = true;
    loadShopIndex({ fresh: indexRun.fresh }).then(
      (data) => {
        if (alive) setIndex({ status: "ready", data });
      },
      () => {
        // A failed refresh keeps the shops already on screen.
        if (alive) setIndex((prev) => (prev.status === "ready" ? prev : { status: "error" }));
      }
    );
    return () => {
      alive = false;
    };
  }, [indexRun]);

  // ---- the text search
  const [search, setSearch] = useState<SearchResults | null>(null);
  const [searchRun, setSearchRun] = useState({ n: 0, fresh: false, q: "" });
  const searchKey = q ? `${searchRun.n}\u0000${q}` : "";
  useEffect(() => {
    if (!q) return;
    let alive = true;
    const key = `${searchRun.n}\u0000${q}`;
    const failed: SearchResults = { key, status: "error", shops: [], nextOffset: 0, hasMore: false, loadingMore: false, pageError: false };
    searchShopsPage(q, 0, { fresh: searchRun.fresh && searchRun.q === q }).then(
      (page) => {
        if (!alive) return;
        setSearch({
          key,
          status: "ready",
          shops: page.shops,
          nextOffset: page.rowCount,
          hasMore: page.hasMore,
          loadingMore: false,
          pageError: false,
        });
      },
      () => {
        if (alive) setSearch(failed);
      }
    );
    return () => {
      alive = false;
    };
  }, [q, searchRun]);
  const results = search && search.key === searchKey ? search : null;
  // While a new search's first page loads, the last one's results stay on screen (no skeleton flash per keystroke).
  const searching = Boolean(q) && !results;
  // (Not an empty one: "No shops match" must wait for the new answer.)
  const shownResults = results ?? (searching && search?.status === "ready" && search.shops.length > 0 ? search : null);

  const loadMoreResults = useCallback(() => {
    if (!results || results.status !== "ready" || !results.hasMore || results.loadingMore) return;
    const { key, nextOffset } = results;
    const update = (change: (current: SearchResults) => SearchResults) =>
      setSearch((current) => (current && current.key === key ? change(current) : current));
    update((current) => ({ ...current, loadingMore: true, pageError: false }));
    searchShopsPage(q, nextOffset).then(
      (page) =>
        update((current) => ({
          ...current,
          shops: mergeShops(current.shops, page.shops),
          nextOffset: current.nextOffset + page.rowCount,
          hasMore: page.hasMore,
          loadingMore: false,
        })),
      () => update((current) => ({ ...current, loadingMore: false, pageError: true }))
    );
  }, [results, q]);

  // ---- indexes a sort needs: loaded on demand, kept for the session
  const needActivity = sortNeedsActivity(sort);
  const needRatings = sort === "rated";
  const [activity, setActivity] = useState<SideIndex<ActivityIndex>>(() => ({ data: peekActivity(), error: false }));
  const [activityRun, setActivityRun] = useState({ n: 0, fresh: false });
  useEffect(() => {
    if (!needActivity) return;
    let alive = true;
    loadActivity({ fresh: activityRun.fresh }).then(
      (data) => {
        if (alive) setActivity({ data, error: false });
      },
      () => {
        if (alive) setActivity((prev) => ({ data: prev.data, error: true }));
      }
    );
    return () => {
      alive = false;
    };
  }, [needActivity, activityRun]);

  const [ratings, setRatings] = useState<SideIndex<RatingsIndex>>(() => ({ data: peekRatings(), error: false }));
  const [ratingsRun, setRatingsRun] = useState({ n: 0, fresh: false });
  useEffect(() => {
    if (!needRatings) return;
    let alive = true;
    loadRatings({ fresh: ratingsRun.fresh }).then(
      (data) => {
        if (alive) setRatings({ data, error: false });
      },
      () => {
        if (alive) setRatings((prev) => ({ data: prev.data, error: true }));
      }
    );
    return () => {
      alive = false;
    };
  }, [needRatings, ratingsRun]);

  const sortLoading = (needActivity && !activity.data && !activity.error) || (needRatings && !ratings.data && !ratings.error);
  const sortFailed = (needActivity && !activity.data && activity.error) || (needRatings && !ratings.data && ratings.error);

  // ---- filter, sort, cut
  const details = useShopDetailsSnapshot();
  const base = q
    ? shownResults?.status === "ready"
      ? shownResults.shops
      : EMPTY
    : index.status === "ready"
      ? index.data.shops
      : EMPTY;
  const filters = useMemo(() => ({ pay, mine: mineKeys }), [pay, mineKeys]);
  const filtered = useMemo(() => filterShops(base, filters, details.get), [base, filters, details]);
  const sorted = useMemo(
    () => sortShops(filtered.shops, sort, { activity: activity.data, ratings: ratings.data }),
    [filtered, sort, activity.data, ratings.data]
  );

  const [shown, setShown] = useState(() => ({
    key: listKey,
    count: memory.listKey === listKey ? memory.count : HOME_PAGE_SIZE,
  }));
  const count = shown.key === listKey ? shown.count : HOME_PAGE_SIZE;
  const visible = useMemo(() => sorted.slice(0, count), [sorted, count]);

  const [checking, setChecking] = useState(false);
  const needsDetails = payNeedsDetails(pay);
  const more: MoreKind = searching
    ? null
    : count < sorted.length
      ? "reveal"
      : needsDetails && filtered.unknown.length > 0
        ? "check"
        : q && results?.status === "ready" && results.hasMore && !results.pageError
          ? "search"
          : null;
  const busy = checking || Boolean(results?.loadingMore);

  const loadMore = useCallback(() => {
    if (busy) return;
    if (more === "reveal") {
      setShown({ key: listKey, count: count + HOME_PAGE_SIZE });
    } else if (more === "check") {
      setChecking(true);
      checkShopDetails(filtered.unknown.slice(0, HOME_PAGE_SIZE)).finally(() => setChecking(false));
    } else if (more === "search") {
      loadMoreResults();
    }
  }, [busy, more, listKey, count, filtered.unknown, loadMoreResults]);

  const retry = useCallback(() => {
    if (q) {
      setSearch(null);
      setSearchRun((run) => ({ n: run.n + 1, fresh: true, q }));
    } else {
      setIndex({ status: "loading" });
      setIndexRun((run) => ({ n: run.n + 1, fresh: true }));
    }
  }, [q]);

  const retrySort = useCallback(() => {
    if (needActivity) {
      setActivity((prev) => ({ data: prev.data, error: false }));
      setActivityRun((run) => ({ n: run.n + 1, fresh: true }));
    }
    if (needRatings) {
      setRatings((prev) => ({ data: prev.data, error: false }));
      setRatingsRun((run) => ({ n: run.n + 1, fresh: true }));
    }
  }, [needActivity, needRatings]);

  // Pull to refresh: ask the node again for what the list is showing.
  const refresh = useCallback(async () => {
    forgetFailedShopDetails();
    const jobs: Promise<unknown>[] = [loadShopIndex({ fresh: true }).then((data) => setIndex({ status: "ready", data }))];
    if (q && searchKey) {
      const key = searchKey;
      jobs.push(
        searchShopsPage(q, 0, { fresh: true }).then((page) =>
          setSearch({
            key,
            status: "ready",
            shops: page.shops,
            nextOffset: page.rowCount,
            hasMore: page.hasMore,
            loadingMore: false,
            pageError: false,
          })
        )
      );
    }
    if (needActivity) jobs.push(loadActivity({ fresh: true }).then((data) => setActivity({ data, error: false })));
    if (needRatings) jobs.push(loadRatings({ fresh: true }).then((data) => setRatings({ data, error: false })));
    await Promise.allSettled(jobs);
  }, [q, searchKey, needActivity, needRatings]);

  const remember = useCallback(() => {
    memory = { listKey, count, scrollY: typeof window === "undefined" ? 0 : window.scrollY };
  }, [listKey, count]);

  // Read once, on mount: where Back should land.
  const [restoreScrollY] = useState(() => (memory.listKey === listKey ? memory.scrollY : 0));
  useEffect(() => {
    memory = { ...memory, scrollY: 0 };
  }, []);

  const searchFailed = Boolean(q) && results?.status === "error";
  const phase: HomeShops["phase"] = q
    ? !shownResults
      ? "loading"
      : shownResults.status === "error"
        ? "error"
        : sortLoading
          ? "loading"
          : "ready"
    : index.status === "loading" || (index.status === "ready" && sortLoading)
      ? "loading"
      : index.status === "error"
        ? "error"
        : "ready";

  const checked = needsDetails
    ? { done: filtered.considered - filtered.unknown.length, of: filtered.considered }
    : null;

  return {
    phase,
    searching: searching && phase === "ready",
    searchFailed,
    shops: visible,
    indexShops: index.status === "ready" ? index.data.shops : EMPTY,
    total: sorted.length,
    filtered,
    indexIncomplete: !q && index.status === "ready" && !index.data.complete,
    searchHasMore: Boolean(q && results?.status === "ready" && results.hasMore),
    checked,
    more,
    busy,
    pageError: Boolean(results?.pageError),
    activity: activity.data,
    ratings: ratings.data,
    sortFailed,
    loadMore,
    retryPage: loadMoreResults,
    retry,
    retrySort,
    refresh,
    remember,
    restoreScrollY,
  };
}

/** For tests. */
export function resetHomeMemory(): void {
  memory = { listKey: "", count: HOME_PAGE_SIZE, scrollY: 0 };
}
