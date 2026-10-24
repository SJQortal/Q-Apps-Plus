/**
 * Products: every shop's products in one list (round 5, Simon: "a new tab at
 * the top to the right of Shops, called Products, which will display all
 * products from the different sellers").
 *
 * The products come from discovery/allProducts.ts: the shops' product
 * indexes, read newest first and only as far as the page needs, and the
 * catalogues (titles, pictures) of the products on screen only. Another
 * sort, categories (one or several, across every shop: the list every shop
 * picks from, constants/categories.ts, then "Other categories", the sellers'
 * own words from before the list) or a search read every index first, one
 * small read per shop; a search then reads at most 30 catalogues, as a shop
 * page's does. Prices are in QORT, the price every product has; a shop page
 * shows the buyer's preferred coin.
 *
 * The URL keeps the search, sort, categories and stock filter, and Back from
 * a product comes back to the same place in the list.
 */
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Popover,
  Switch,
  TextField,
  Typography, MenuItem
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import TuneIcon from "@mui/icons-material/Tune";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LocalMallOutlinedIcon from "@mui/icons-material/LocalMallOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import { useInView } from "react-intersection-observer";
import type { RootState } from "../../state/store";
import { setProductToCart } from "../../state/features/cartSlice";
import { Page, PageHeader } from "../../components/layout/Page";
import { CategoryIcon } from "../../components/CategoryIcon";
import { searchCategories } from "../../utils/categoryMatch";
import { EmptyState } from "../../components/common/EmptyState";
import { PullIndicator } from "../../components/common/PullIndicator";
import { BottomSheet } from "../../components/common/mobile";
import { usePhoneLayout } from "../../hooks/usePhoneLayout";
import { usePullToRefresh } from "../../hooks/usePullToRefresh";
import { productLayout, useProductView } from "../../utils/productView";
import { AUCTION_SORT, PRODUCT_SORTS, PRODUCTS_PAGE, priceBound, searchTerms, type ProductSort } from "../Store/shopData";
import { ProductCard, ProductCardSkeleton } from "../Store/ProductCard/ProductCard";
import { AuctionsToggle, FETCHING_NOTE, FilterChip, PriceRangeFields, ProductGrid, ProductGridSkeleton, ProductViewToggle, useDebounced } from "../Store/ProductList";
import { useNow } from "../../hooks/useNow";
import { AddedToCartSnackbar, type AddedNotice } from "../Store/CartBits";
import { LocalBoundary, UnavailableCard } from "../Store/LocalBoundary";
import { visuallyHiddenSx } from "../Store/a11y";
import {
  catalogueKey,
  categoryKey,
  categoryOptions,
  auctionTimesOfRow,
  filterAndSortAll,
  isOpenAuctionRow,
  listedRows,
  productOfRow,
  searchAll,
  searchCatalogueKeys,
  statusOfRow,
  useAllCatalogues,
  useAllProducts,
  type AllProductRow,
  type CategoryOption,
} from "../../discovery/allProducts";
import { selectMenuProps } from "../../components/common/menuStyle";
import { useHiddenShops } from "../../discovery/hiddenShops";
import { useFavoriteCounts } from "../../favorites/counts";
import { shortStoreIdOf } from "../../qdn/identifiers";
import { bundleRows, type VariantGroup } from "../../variants/model";

/** The Products page's sorts: the shops' ones, and how many buyers keep each product (favorites/counts.ts). */
type ListSort = ProductSort | "favorites";
const FAVORITES_SORT: { value: ListSort; label: string } = { value: "favorites", label: "Most loved" };

function parseProductSort(value: string | null): ListSort | null {
  return [...PRODUCT_SORTS, AUCTION_SORT, FAVORITES_SORT].some((s) => s.value === value) ? (value as ListSort) : null;
}

function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

/**
 * Where the list was when one of its links was followed (a product, a shop),
 * so Back lands there again. Read once: coming back by the navigation starts
 * at the top.
 */
let memory = { listKey: "", pages: 1, scrollY: 0 };

/** For tests. */
export function resetProductsMemory(): void {
  memory = { listKey: "", pages: 1, scrollY: 0 };
}

interface ListQuery {
  q: string;
  sort: ListSort;
  /** categoryKey()s */
  categories: string[];
  inStockOnly: boolean;
  /** Only auctions still open; then by when they end, unless another sort is picked. */
  auctionsOnly: boolean;
  /** A price range in QORT, as typed ("" for none). */
  min: string;
  max: string;
}

/** The sort a list has without a `sort` in its URL. */
const defaultSort = (auctionsOnly: boolean): ListSort => (auctionsOnly ? "ending" : "newest");

/** The list's state in the URL: `?q=&sort=&category=…&stock=1&auctions=1&min=&max=`, changed in place so Back leaves the page. */
function useListQuery(): ListQuery & { update: (patch: Partial<ListQuery>) => void } {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const auctionsOnly = params.get("auctions") === "1";
  const min = params.get("min") ?? "";
  const max = params.get("max") ?? "";
  const sort = parseProductSort(params.get("sort")) ?? defaultSort(auctionsOnly);
  const categoryParams = params.getAll("category").join("\u0000");
  const categories = useMemo(
    () => [...new Set(categoryParams.split("\u0000").map(categoryKey).filter(Boolean))],
    [categoryParams]
  );
  const inStockOnly = params.get("stock") === "1";
  const update = useCallback(
    (patch: Partial<ListQuery>) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (patch.q !== undefined) {
            if (patch.q) next.set("q", patch.q);
            else next.delete("q");
          }
          for (const key of ["min", "max"] as const) {
            const value = patch[key];
            if (value === undefined) continue;
            if (value) next.set(key, value);
            else next.delete(key);
          }
          if (patch.auctionsOnly !== undefined) {
            if (patch.auctionsOnly) next.set("auctions", "1");
            else next.delete("auctions");
          }
          if (patch.sort !== undefined) {
            if (patch.sort !== defaultSort(next.get("auctions") === "1")) next.set("sort", patch.sort);
            else next.delete("sort");
          }
          if (patch.categories !== undefined) {
            next.delete("category");
            for (const category of patch.categories) next.append("category", category);
          }
          if (patch.inStockOnly !== undefined) {
            if (patch.inStockOnly) next.set("stock", "1");
            else next.delete("stock");
          }
          return next;
        },
        { replace: true }
      );
    },
    [setParams]
  );
  return { q, sort, categories, inStockOnly, auctionsOnly, min, max, update };
}

/**
 * Categories to tick: the list's, then "Other categories" (sellers' own words
 * from before the list, over a hundred), each the biggest first, with a box
 * to find one. Shown in a popover on wider screens and in the Filters sheet
 * on phones.
 */
function CategoryPicker({
  options,
  selected,
  onToggle,
  progress,
}: {
  options: CategoryOption[];
  selected: string[];
  onToggle: (key: string) => void;
  /** Set while the shops' lists are still being read. */
  progress: string | null;
}) {
  const [find, setFind] = useState("");
  if (progress !== null) {
    return (
      <Box role="status" sx={{ display: "flex", alignItems: "center", gap: 1.5, minHeight: 44 }}>
        <CircularProgress size={20} aria-hidden />
        {/* The counter changes with every shop read: shown, but announced once. */}
        <Typography variant="body2" color="text.secondary" aria-hidden>
          {progress}
        </Typography>
        <Box component="span" sx={visuallyHiddenSx}>
          Reading every shop&apos;s categories…
        </Box>
      </Box>
    );
  }
  if (options.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No categories yet.
      </Typography>
    );
  }
  const needle = find.trim().toLocaleLowerCase();
  // By name, or by a thing the category holds ("glasses" finds Health & Beauty: utils/categoryMatch.ts).
  const meant = new Set(needle ? searchCategories(needle).filter((hit) => hit.via).map((hit) => categoryKey(hit.category)) : []);
  const shown = needle ? options.filter((option) => option.label.toLocaleLowerCase().includes(needle) || meant.has(option.key)) : options;
  // The sellers' own words from before the list come under their own heading.
  const hasListed = options.some((option) => option.listed);
  const firstOther = shown.findIndex((option) => !option.listed);
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
      {options.length > 8 && (
        <TextField
          type="search"
          size="small"
          placeholder="Find a category"
          value={find}
          onChange={(event) => setFind(event.target.value)}
          slotProps={{ htmlInput: { "aria-label": "Find a category", enterKeyHint: "search" } }}
          sx={{ "& .MuiInputBase-root": { minHeight: 44 } }}
        />
      )}
      <Box
        role="group"
        aria-label="Categories"
        // Positioned, so the rows' screen-reader text (position: absolute) stays inside this list's scroll
        // instead of stretching the popover into a second one.
        sx={{ position: "relative", maxHeight: { xs: "40vh", sm: 340 }, overflowY: "auto", overscrollBehavior: "contain", display: "flex", flexDirection: "column" }}
      >
        {shown.map((option, i) => (
          <Fragment key={option.key}>
          {i === firstOther && hasListed && (
            <Typography component="h3" variant="subtitle2" color="text.secondary" sx={{ mt: i > 0 ? 1.5 : 0, mb: 0.5 }}>
              Other categories
            </Typography>
          )}
          <FormControlLabel
            control={<Checkbox checked={selected.includes(option.key)} onChange={() => onToggle(option.key)} />}
            label={
              <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CategoryIcon category={option.label} size={24} />
                <Box component="span" sx={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
                  {option.label}
                </Box>
                <Box component="span" aria-hidden sx={{ color: "text.secondary", fontVariantNumeric: "tabular-nums", fontSize: 14 }}>
                  {option.count}
                </Box>
                <Box component="span" sx={visuallyHiddenSx}>
                  {`, ${plural(option.count, "product", "products")}`}
                </Box>
              </Box>
            }
            sx={{ m: 0, minHeight: 44, mr: 0.5, "& .MuiFormControlLabel-label": { flex: 1, minWidth: 0 } }}
          />
          </Fragment>
        ))}
        {shown.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
            No category matches “{find.trim()}”.
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export function ProductsPage() {
  const dispatch = useDispatch();
  const phone = usePhoneLayout();
  const layout = productLayout(useProductView(), phone);
  const userName = useSelector((state: RootState) => state.auth.user?.name ?? "");
  const { q, sort, categories, inStockOnly, auctionsOnly, min, max, update } = useListQuery();
  const minQort = priceBound(min);
  const maxQort = priceBound(max);
  const priced = minQort !== null || maxQort !== null;
  // Auctions open and close as time passes: the list looks again every 30 s.
  const now = useNow(30_000);
  const debouncedQ = useDebounced(q, 300);
  const terms = useMemo(() => searchTerms(debouncedQ), [debouncedQ]);
  const searching = terms.length > 0;

  const all = useAllProducts();
  const { catalogues, statuses, load, retryFailed: retryCatalogues } = useAllCatalogues();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoryAnchor, setCategoryAnchor] = useState<HTMLElement | null>(null);
  const [added, setAdded] = useState<AddedNotice | null>(null);

  // Another sort, categories (to list them, or to filter by them) and a search need every shop's list.
  const pickingCategories = filtersOpen || categoryAnchor !== null;
  const needAll = sort !== "newest" || categories.length > 0 || searching || pickingCategories || auctionsOnly || priced;
  const { phase, readAll, readMore } = all;
  useEffect(() => {
    if (needAll && phase === "ready") readAll();
  }, [needAll, phase, readAll]);

  // Shops hidden on this device (discovery/hiddenShops.ts) list none of their products.
  const { list: hiddenShops } = useHiddenShops();
  const rows = useMemo(() => {
    if (hiddenShops.length === 0) return all.rows;
    const hidden = new Set(hiddenShops.map((h) => `${h.owner}\n${h.shortStoreId}`));
    return all.rows.filter((row) => !hidden.has(`${row.owner}\n${shortStoreIdOf(row.storeId)}`));
  }, [all.rows, hiddenShops]);
  const favoriteCounts = useFavoriteCounts(sort === "favorites");
  const listed = useMemo(() => listedRows(rows, inStockOnly, catalogues, now), [rows, inStockOnly, catalogues, now]);
  const auctions = useMemo(() => listed.filter((row) => isOpenAuctionRow(row, catalogues, now)).length, [listed, catalogues, now]);
  const options = useMemo(() => categoryOptions(listed), [listed]);
  const labels = useMemo(() => new Map(options.map((option) => [option.key, option.label])), [options]);
  const filtered = useMemo(
    () => filterAndSortAll(rows, { categories, inStockOnly, auctionsOnly, minQort, maxQort, sort, favorites: favoriteCounts }, catalogues, now),
    [rows, categories, inStockOnly, auctionsOnly, minQort, maxQort, sort, favoriteCounts, catalogues, now]
  );
  // Newest first shows what is in its final place; anything else waits for every shop.
  const frontier = all.frontier;
  const settled = useMemo(() => (needAll ? filtered : filtered.filter((row) => row.created > frontier)), [needAll, filtered, frontier]);
  const waitingForAll = needAll && !all.complete;
  const scope = useMemo(() => (searching && all.complete ? searchCatalogueKeys(filtered) : null), [searching, all.complete, filtered]);
  const results = useMemo(
    () => (scope ? searchAll(filtered, terms, scope.keys, catalogues) : settled),
    [scope, filtered, terms, catalogues, settled]
  );

  // Paging restarts whenever the list's meaning changes; Back restores it.
  const listKey = JSON.stringify([sort, categories, inStockOnly, auctionsOnly, minQort, maxQort, terms]);
  const [back] = useState(() => (memory.listKey === listKey ? memory : null));
  const [paging, setPaging] = useState(() => ({ key: listKey, pages: back?.pages ?? 1 }));
  const pages = paging.key === listKey ? paging.pages : 1;
  const wanted = pages * PRODUCTS_PAGE;
  // Each shop's groups of variants listed as one (variants/model.ts) show as one card.
  const bundled = useMemo(() => {
    const groups: Record<string, VariantGroup> = {};
    const keyOf = (row: AllProductRow) => (row.variant ? `${row.owner}\n${row.storeId}\n${row.variant.group}` : "");
    for (const row of results) if (row.variant && row.variantGroup) groups[keyOf(row)] = row.variantGroup;
    return bundleRows(results, groups, (row) => (row.variant ? { group: keyOf(row), values: row.variant.values } : null));
  }, [results]);
  const shown = useMemo(() => (waitingForAll ? [] : bundled.slice(0, wanted)), [waitingForAll, bundled, wanted]);
  const reading = !needAll && !all.complete;
  const hasMore = !waitingForAll && (shown.length < bundled.length || reading);
  const more = useCallback(
    () => setPaging((prev) => ({ key: listKey, pages: (prev.key === listKey ? prev.pages : 1) + 1 })),
    [listKey]
  );
  const { ref: sentinel } = useInView({ rootMargin: "400px 0px", onChange: (inView) => inView && more(), skip: !hasMore });

  // Newest first: the next shops' lists, until a page (and one more) is in its final place.
  const { busy, complete } = all;
  useEffect(() => {
    if (phase !== "ready" || needAll || complete || busy) return;
    if (settled.length <= wanted) readMore();
  }, [phase, needAll, complete, busy, settled.length, wanted, readMore]);

  // Catalogues for what is on screen, or for the search.
  const neededKey = useMemo(() => {
    let rows: AllProductRow[] = shown;
    if (scope) {
      const keys = new Set(scope.keys);
      rows = filtered.filter((row) => keys.has(catalogueKey(row.owner, row.catalogueId)));
    }
    return [...new Set(rows.map((row) => catalogueKey(row.owner, row.catalogueId)))].join("\u0001");
  }, [scope, filtered, shown]);
  useEffect(() => {
    if (!neededKey) return;
    load(
      neededKey.split("\u0001").map((key) => {
        const [owner, catalogueId] = key.split("\u0000");
        return { owner, catalogueId };
      })
    );
  }, [load, neededKey]);

  // Back from a product: the same pages, then the same place.
  useEffect(() => {
    memory = { listKey: "", pages: 1, scrollY: 0 };
  }, []);
  const remember = (event: ReactMouseEvent) => {
    if (!(event.target instanceof Element) || !event.target.closest("a")) return;
    memory = { listKey, pages, scrollY: typeof window === "undefined" ? 0 : window.scrollY };
  };
  const restoreScrollY = back?.scrollY ?? 0;
  const restored = useRef(false);
  useLayoutEffect(() => {
    if (restored.current || restoreScrollY <= 0 || shown.length === 0) return;
    restored.current = true;
    try {
      window.scrollTo(0, restoreScrollY);
    } catch {
      // not every environment can scroll
    }
  }, [restoreScrollY, shown.length]);

  const { pull, refreshing } = usePullToRefresh(all.refresh, phone);

  const toggleCategory = (key: string) =>
    update({ categories: categories.includes(key) ? categories.filter((c) => c !== key) : [...categories, key] });
  const clearFilters = () => update({ categories: [], inStockOnly: false, auctionsOnly: false, min: "", max: "" });
  const priceFields = <PriceRangeFields min={min} max={max} onChange={(range) => update(range)} titled={!phone} />;
  const addToCart = (row: AllProductRow) => {
    const product = productOfRow(row, catalogues);
    dispatch(setProductToCart({ storeId: row.storeId, storeOwner: row.owner, productId: row.productId, catalogueId: row.catalogueId, quantity: 1 }));
    const title = typeof product?.title === "string" ? product.title.trim() : "";
    setAdded((prev) => ({ at: (prev?.at ?? 0) + 1, title: title || "Product", quantity: 1 }));
  };

  const readingAll = `Reading every shop's products… ${all.read} of ${all.total} shops`;
  const categoryProgress = phase !== "ready" || !all.complete ? (phase === "ready" ? readingAll : "Reading the shops…") : null;
  const activeFilters = categories.length + (inStockOnly ? 1 : 0) + (auctionsOnly ? 1 : 0) + (priced ? 1 : 0);
  const failedCatalogues = Object.values(statuses).filter((s) => s === "failed").length;
  const searchPending = scope ? scope.keys.filter((key) => !catalogues[key] && statuses[key] !== "failed").length : 0;
  const searchScope = useMemo(() => {
    if (!scope) return { total: 0, read: 0 };
    const keys = new Set(scope.keys);
    const inScope = filtered.filter((row) => keys.has(catalogueKey(row.owner, row.catalogueId)));
    return { total: inScope.length, read: inScope.filter((row) => !!catalogues[catalogueKey(row.owner, row.catalogueId)]).length };
  }, [scope, filtered, catalogues]);
  const cappedNote = `Only the first ${searchScope.total} products were searched; pick a category to narrow it down.`;

  // While reading, the counter shows but isn't announced at every step: screen readers hear the start and the result.
  let status = "";
  let spoken: string | null = null;
  if (phase !== "ready") status = "";
  else if (waitingForAll) {
    status = readingAll;
    spoken = "Reading every shop's products…";
  } else if (searching && searchPending > 0) {
    status = `Searching… ${searchScope.read} of ${searchScope.total} products read`;
    spoken = "Searching…";
  } else if (searching) status = `${plural(results.length, "result", "results")} for “${terms.join(" ")}”`;
  else if (all.complete) status = plural(filtered.length, "product", "products");
  else status = "Newest first";

  const stockSwitch = (
    <FormControlLabel
      control={<Switch checked={inStockOnly} onChange={(event) => update({ inStockOnly: event.target.checked })} />}
      label="In stock only"
      sx={{ minHeight: 44, mr: 0 }}
    />
  );

  const sortSelect = (
    <TextField
      select
      size="small"
      label="Sort"
      value={sort}
      onChange={(event) => update({ sort: event.target.value as ListSort })}
      slotProps={{ select: { MenuProps: selectMenuProps } }}
      sx={{ minWidth: 170, flex: { xs: "1 1 150px", sm: "0 0 auto" }, "& .MuiInputBase-root": { minHeight: 44 } }}
    >
      {[...PRODUCT_SORTS, ...(auctions > 0 || sort === "ending" ? [AUCTION_SORT] : []), FAVORITES_SORT].map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );

  let body: ReactNode;
  if (phase === "loading" || (phase === "ready" && all.total > 0 && !waitingForAll && !all.complete && settled.length === 0 && !searching)) {
    body = <ProductGridSkeleton count={phone ? 4 : 8} layout={layout} />;
  } else if (phase === "error") {
    body = (
      <EmptyState
        icon={<CloudOffOutlinedIcon />}
        title="Couldn't load the shops"
        description="Your node didn't answer. Try again in a moment."
        actionLabel="Retry"
        onAction={() => void all.refresh()}
      />
    );
  } else if (all.total === 0 || (all.complete && all.rows.length === 0)) {
    body = (
      <EmptyState icon={<LocalMallOutlinedIcon />} title="No products yet" description="No shop has listed anything for sale yet." />
    );
  } else if (waitingForAll) {
    body = <ProductGridSkeleton count={phone ? 4 : 8} layout={layout} />;
  } else if (filtered.length === 0) {
    body = <EmptyState icon={<TuneIcon />} title="No products match these filters" actionLabel="Clear filters" onAction={clearFilters} />;
  } else if (searching && results.length === 0 && searchPending === 0) {
    body = (
      <EmptyState
        icon={<SearchOffOutlinedIcon />}
        title={`No products match “${terms.join(" ")}”`}
        description={scope?.capped ? cappedNote : undefined}
        actionLabel="Show all products"
        onAction={() => update({ q: "" })}
      />
    );
  } else if (searching && results.length === 0) {
    body = <ProductGridSkeleton count={phone ? 2 : 4} layout={layout} />;
  } else {
    const loadingMore = reading && shown.length < wanted;
    body = (
      <>
        {/* The cards' titles are h3: a heading of their own between them and the page's h1. */}
        <Typography component="h2" sx={visuallyHiddenSx}>
          Every shop&apos;s products
        </Typography>
        <Box onClickCapture={remember}>
          <ProductGrid layout={layout}>
            {shown.map((row) => {
              const product = productOfRow(row, catalogues);
              const state = statuses[catalogueKey(row.owner, row.catalogueId)];
              return (
                <li key={row.key}>
                  {product ? (
                    <LocalBoundary
                      label={`The card of product ${row.productId}`}
                      fallback={<UnavailableCard text="This product couldn't be shown." />}
                    >
                      <ProductCard
                        product={product}
                        productId={row.productId}
                        catalogueId={row.catalogueId}
                        owner={row.owner}
                        storeId={row.storeId}
                        status={statusOfRow(row, catalogues)}
                        shop={null}
                        coin="QORT"
                        rate={null}
                        isOwnProduct={!!userName && row.owner === userName}
                        onAddToCart={() => addToCart(row)}
                        layout={layout}
                        compact={layout === "tile" && phone}
                        stacked={phone}
                        shopName={row.shopTitle}
                        auction={auctionTimesOfRow(row, catalogues)}
                        now={now}
                        bundle={row.bundle}
                      />
                    </LocalBoundary>
                  ) : (
                    <ProductCardSkeleton
                      note={state === "fetching" ? FETCHING_NOTE : state === "failed" ? "Not available on your node right now" : undefined}
                      layout={layout}
                    />
                  )}
                </li>
              );
            })}
            {loadingMore &&
              Array.from({ length: phone ? 2 : 4 }, (_, i) => (
                <li key={`more-${i}`} aria-hidden>
                  <ProductCardSkeleton layout={layout} />
                </li>
              ))}
          </ProductGrid>
        </Box>
        {hasMore ? (
          <Box ref={sentinel} sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
            <Button variant="outlined" color="inherit" onClick={more} disabled={loadingMore} sx={{ minHeight: 44, minWidth: 160 }}>
              Show more
            </Button>
          </Box>
        ) : (
          !searching && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mt: 3 }}>
              That&apos;s every product.
            </Typography>
          )
        )}
      </>
    );
  }

  const showControls = phase === "ready" && all.total > 0;
  return (
    <Page>
      {(pull > 0 || refreshing) && <PullIndicator pull={pull} refreshing={refreshing} />}
      <PageHeader title="Products" subtitle="What every shop has for sale, in one place." />
      {showControls && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 2 }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
            <TextField
              type="search"
              size="small"
              placeholder="Search products"
              value={q}
              onChange={(event) => update({ q: event.target.value })}
              sx={{ flex: "1 1 260px", minWidth: 0, "& .MuiInputBase-root": { minHeight: 44 } }}
              slotProps={{
                htmlInput: { "aria-label": "Search products", enterKeyHint: "search" },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: q ? (
                    <InputAdornment position="end">
                      <IconButton aria-label="Clear search" onClick={() => update({ q: "" })} edge="end" sx={{ width: 40, height: 40 }}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : undefined,
                },
              }}
            />
            {sortSelect}
            <AuctionsToggle count={auctions} on={auctionsOnly} onChange={(on) => update({ auctionsOnly: on })} exact={all.complete} />
            {phone ? (
              <Button
                variant={activeFilters ? "contained" : "outlined"}
                color={activeFilters ? "primary" : "inherit"}
                startIcon={<TuneIcon />}
                onClick={() => setFiltersOpen(true)}
                sx={{ minHeight: 44, flex: "1 1 auto" }}
              >
                {activeFilters ? `Filters (${activeFilters})` : "Filters"}
              </Button>
            ) : (
              <>
                <Button
                  variant={categories.length ? "contained" : "outlined"}
                  color={categories.length ? "primary" : "inherit"}
                  endIcon={<ExpandMoreIcon />}
                  onClick={(event) => setCategoryAnchor(event.currentTarget)}
                  aria-haspopup="dialog"
                  aria-expanded={categoryAnchor !== null}
                  sx={{ minHeight: 44 }}
                >
                  {categories.length ? `Categories (${categories.length})` : "Categories"}
                </Button>
                {priceFields}
                {stockSwitch}
              </>
            )}
          </Box>
          {categories.length > 0 && (
            <Box role="group" aria-label="Chosen categories" sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
              {categories.map((key) => (
                <FilterChip key={key} label={labels.get(key) ?? key} on onClick={() => toggleCategory(key)} />
              ))}
              <Button color="inherit" onClick={() => update({ categories: [] })} sx={{ minHeight: 36 }}>
                Clear
              </Button>
            </Box>
          )}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <Typography variant="body2" color="text.secondary" role="status" aria-live="polite" sx={{ fontSize: 14, flex: 1, minWidth: 0 }}>
              {spoken === null ? (
                status
              ) : (
                <>
                  <span aria-hidden>{status}</span>
                  <Box component="span" sx={visuallyHiddenSx}>
                    {spoken}
                  </Box>
                </>
              )}
            </Typography>
            <ProductViewToggle layout={layout} />
          </Box>
          {scope?.capped && results.length > 0 && (
            <Typography variant="body2" color="text.secondary">
              {cappedNote}
            </Typography>
          )}
          {all.failed > 0 && (
            <Box role="status" sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {all.failed === 1
                  ? "One shop's products aren't on your node right now."
                  : `${all.failed} shops' products aren't on your node right now.`}
              </Typography>
              <Button variant="outlined" color="inherit" onClick={all.retryFailed} sx={{ minHeight: 44 }}>
                Retry
              </Button>
            </Box>
          )}
          {failedCatalogues > 0 && (
            <Box role="status" sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Some products aren&apos;t available on your node right now.
              </Typography>
              <Button variant="outlined" color="inherit" onClick={retryCatalogues} sx={{ minHeight: 44 }}>
                Retry
              </Button>
            </Box>
          )}
        </Box>
      )}

      {body}

      {!phone && (
        <Popover
          open={categoryAnchor !== null}
          anchorEl={categoryAnchor}
          onClose={() => setCategoryAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          transformOrigin={{ vertical: "top", horizontal: "left" }}
          slotProps={{
            paper: { role: "dialog", "aria-label": "Categories", sx: { width: 340, maxWidth: "calc(100vw - 32px)", p: 2, mt: 0.5 } },
          }}
        >
          <CategoryPicker options={options} selected={categories} onToggle={toggleCategory} progress={categoryProgress} />
          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, mt: 1.5 }}>
            <Button color="inherit" onClick={() => update({ categories: [] })} disabled={categories.length === 0} sx={{ minHeight: 44 }}>
              Clear
            </Button>
            <Button variant="contained" onClick={() => setCategoryAnchor(null)} sx={{ minHeight: 44 }}>
              Done
            </Button>
          </Box>
        </Popover>
      )}

      {phone && (
        <BottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box>
              <Typography component="h3" variant="subtitle2" sx={{ mb: 1 }}>
                Categories
              </Typography>
              <CategoryPicker options={options} selected={categories} onToggle={toggleCategory} progress={categoryProgress} />
            </Box>
            <Box>
              <Typography component="h3" variant="subtitle2" sx={{ mb: 1 }}>
                Price
              </Typography>
              {priceFields}
            </Box>
            {stockSwitch}
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button color="inherit" onClick={clearFilters} disabled={!activeFilters} sx={{ minHeight: 44 }}>
                Clear
              </Button>
              <Button variant="contained" fullWidth onClick={() => setFiltersOpen(false)} sx={{ minHeight: 44 }}>
                {all.complete ? `Show ${plural(filtered.length, "product", "products")}` : "Show products"}
              </Button>
            </Box>
          </Box>
        </BottomSheet>
      )}

      <AddedToCartSnackbar notice={added} onClose={() => setAdded(null)} />
    </Page>
  );
}

export default ProductsPage;
