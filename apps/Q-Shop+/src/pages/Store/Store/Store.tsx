/**
 * One shop: `/:user/:store` (the original's route, so links copied from
 * Q-Shop open here too).
 *
 * Reads the shop and its product index (useViewedShop), then works out the
 * list from the index alone: categories, in stock only and the sorts need no
 * catalogue. Catalogues (10 products each, with titles and pictures) are
 * fetched for the 20 products on screen, 5 at a time, once each; a text
 * search reads the rest progressively, at most 30 catalogues. Prices show in
 * the coin the buyer picks among the shop's (money/useShopCoin), computed by
 * money/pricing exactly as checkout does.
 *
 * A shop with collections (qdn/collections.ts) shows them as a row of cards
 * above the products; `?collection=<id>` shows one collection's products,
 * under its picture, title and description, with the same filters and sorts.
 * Changing collection eases (hooks/useSmoothSwap.ts): the section's height
 * glides, the new products fade in, and the page scrolls smoothly to the
 * collection only when its heading is out of view.
 * Products show as a grid of tiles or a list of rows (utils/productView.ts:
 * the buyer's choice, kept in Settings; by default rows on phones).
 *
 * "Featured" is the seller's order: the shop's (qdn/productOrder.ts) or,
 * in a collection, the collection's. It is the default sort wherever there
 * is one; buyers can still pick another. A shop with collections lists them
 * first in Featured, the first collection's products, then the next's, then
 * the rest, each group under a line with its collection's title.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Box,
  Button,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Skeleton,
  Switch,
  TextField,
  Typography, MenuItem
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import TuneIcon from "@mui/icons-material/Tune";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import { useInView } from "react-intersection-observer";
import type { RootState } from "../../../state/store";
import { toggleEditStoreModal } from "../../../state/features/globalSlice";
import { setProductToCart } from "../../../state/features/cartSlice";
import { Page, PageHeader } from "../../../components/layout/Page";
import { EmptyState } from "../../../components/common/EmptyState";
import { BottomSheet, ResponsiveDialog } from "../../../components/common/mobile";
import { usePhoneLayout } from "../../../hooks/usePhoneLayout";
import { useShopCoin } from "../../../money/useShopCoin";
import { collectionPath, decodeParam, storePath } from "../../../qdn/links";
import {
  categoriesOf,
  catalogueIdsOf,
  DEFAULT_PRODUCT_QUERY,
  effectiveSort,
  effectiveStatus,
  FEATURED_SORT,
  filterAndSortProducts,
  productOf,
  productRowsFromContainer,
  withStockLeft,
  PRODUCT_SORTS,
  AUCTION_SORT,
  auctionTimesOf,
  openAuctionCount,
  isListed,
  isOnSale,
  priceBound,
  PRODUCTS_PAGE,
  searchCatalogueIds,
  searchProducts,
  searchTerms,
  type ProductQuery,
  type ProductRow,
  type ShopSort,
} from "../shopData";
import { featuredOrder, productOrderOf } from "../../../qdn/productOrder";
import { useCatalogueLoader, useShopReviews, useViewedShop, type LoadStatus } from "../useShopData";
import { ProductCard, ProductCardSkeleton } from "../ProductCard/ProductCard";
import { AuctionsToggle, CategoryChips, FETCHING_NOTE, PriceRangeFields, ProductGrid, ProductGridSkeleton, ProductViewToggle, SaleToggle, SectionDivider, useDebounced } from "../ProductList";
import { useNow } from "../../../hooks/useNow";
import { prefersReducedMotion, useSmoothSwap } from "../../../hooks/useSmoothSwap";
import { productLayout, useProductView } from "../../../utils/productView";
import { ShopHeader, ShopHeaderSkeleton } from "../ShopHeader";
import { StoreDetails } from "../StoreDetails/StoreDetails";
import { ReviewsPanel } from "../StoreReviews/ReviewsPanel";
import { CoinPicker, RateNote } from "../CoinPicker";
import { AddedToCartSnackbar, CartButton, type AddedNotice } from "../CartBits";
import { visuallyHiddenSx } from "../a11y";
import { LocalBoundary, UnavailableCard } from "../LocalBoundary";
import { useShopCollections, type ShopCollections } from "../useShopCollections";
import { CollectionCards, CollectionHeader } from "../ShopCollections";
import { useOrderCount } from "../orderCount";
import { selectMenuProps } from "../../../components/common/menuStyle";
import { bundleRows, variantGroupsOf } from "../../../variants/model";
import { useStockLeft } from "../../../stock/notes";
import { shortStoreIdOf } from "../../../qdn/identifiers";

/** The coins a price list can show in. Kept here because Settings, the cart and the seller tools import it. */
export enum CoinFilter {
  qort = "QORT",
  arrr = "ARRR",
}

/** Products section: the toolbar, the grid and its states. */
function ShopProducts({
  owner,
  storeId,
  shop,
  isOwner,
  productsStatus,
  index,
  onRetry,
  onSellerPage,
  collections,
  collectionId,
}: {
  owner: string;
  storeId: string;
  shop: Parameters<typeof useShopCoin>[0];
  isOwner: boolean;
  productsStatus: LoadStatus;
  index: { products?: unknown } | null;
  onRetry: () => void;
  onSellerPage: () => void;
  collections: ShopCollections;
  /** `?collection=`: show only this collection's products. */
  collectionId: string | null;
}) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const phone = usePhoneLayout();
  const layout = productLayout(useProductView(), phone);
  const shopCoin = useShopCoin(shop);
  const { catalogues, statuses, load, retryFailed } = useCatalogueLoader(owner);
  const [filters, setFilters] = useState<Omit<ProductQuery, "sort">>({ categories: [], inStockOnly: false, auctionsOnly: false, saleOnly: false });
  // Auctions open and close as time passes: the list looks again every 30 s.
  const now = useNow(30_000);
  const [price, setPrice] = useState({ min: "", max: "" });
  // The buyer's sort, once they pick one; until then the page's default (effectiveSort).
  const [pickedSort, setPickedSort] = useState<ShopSort | null>(null);
  const [searchText, setSearchText] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [added, setAdded] = useState<AddedNotice | null>(null);
  const debouncedSearch = useDebounced(searchText, 250);
  const terms = useMemo(() => searchTerms(debouncedSearch), [debouncedSearch]);
  const searching = terms.length > 0;

  const indexRows = useMemo(() => productRowsFromContainer(index), [index]);
  // Counted products (stock/model.ts): what's left, from the shop's order notes (one read, only when it counts any).
  const stockItems = useMemo(
    () => indexRows.flatMap((row) => (row.stock ? [{ shortStoreId: shortStoreIdOf(storeId), productId: row.productId, stock: row.stock }] : [])),
    [indexRows, storeId]
  );
  const { left: stockLeft } = useStockLeft(stockItems);
  const allRows = useMemo(() => withStockLeft(indexRows, stockLeft), [indexRows, stockLeft]);
  // The products the shop lists, for the collections' counts.
  const listedIds = useMemo(
    () => new Set(filterAndSortProducts(allRows, DEFAULT_PRODUCT_QUERY, catalogues).map((row) => row.productId)),
    [allRows, catalogues]
  );
  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of collections.collections) out[c.id] = c.products.filter((id) => listedIds.has(id)).length;
    return out;
  }, [collections.collections, listedIds]);
  const collection = collectionId ? (collections.collections.find((c) => c.id === collectionId) ?? null) : null;
  // A collection link (shared, or a card tapped) opens on the collection: its heading comes into view and takes focus.
  const collectionHeading = useRef<HTMLHeadingElement>(null);
  const openedId = collection?.id;
  useEffect(() => {
    const heading = collectionHeading.current;
    if (!openedId || !heading) return;
    // A tapped card usually leaves it in view: the page stays put. Else a smooth scroll to it.
    const top = heading.getBoundingClientRect().top;
    const inView = top >= 64 && top <= window.innerHeight * 0.6;
    if (!inView && typeof heading.scrollIntoView === "function") heading.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    heading.focus({ preventScroll: true });
  }, [openedId]);
  const productsSection = useRef<HTMLElement>(null);
  useSmoothSwap(productsSection, openedId ?? "");
  const waitingForCollection = !!collectionId && (collections.status === "loading" || collections.status === "fetching");
  const collectionsUnreadable = !!collectionId && collections.status === "unavailable";
  const collectionGone = !!collectionId && !collection && !waitingForCollection && !collectionsUnreadable && productsStatus === "ready";
  const rows = useMemo(() => {
    if (!collection) return allRows;
    const members = new Set(collection.products);
    return allRows.filter((row) => members.has(row.productId));
  }, [allRows, collection]);
  // The seller's order here: the collection's, or the shop's with its collections first.
  const shopOrder = useMemo(() => productOrderOf(index), [index]);
  const featured = useMemo(() => featuredOrder(collections.collections, shopOrder), [collections.collections, shopOrder]);
  const order = collection ? collection.products : featured.order;
  // Auctions only: by when they end, unless the buyer picked a sort.
  const sort = filters.auctionsOnly && !pickedSort ? "ending" : effectiveSort(pickedSort, order.length > 0);
  const query = useMemo<ProductQuery>(
    () => ({ ...filters, sort, minQort: priceBound(price.min), maxQort: priceBound(price.max) }),
    [filters, sort, price]
  );
  const auctions = useMemo(() => openAuctionCount(rows, catalogues, now), [rows, catalogues, now]);
  const onSale = useMemo(() => rows.filter((row) => isListed(row, catalogues) && isOnSale(row, catalogues)).length, [rows, catalogues]);
  const baseSorts = order.length > 0 ? [FEATURED_SORT, ...PRODUCT_SORTS] : PRODUCT_SORTS;
  const sortOptions = auctions > 0 || sort === "ending" ? [...baseSorts, AUCTION_SORT] : baseSorts;
  const categories = useMemo(() => categoriesOf(rows), [rows]);
  const filtered = useMemo(() => filterAndSortProducts(rows, query, catalogues, order, now), [rows, query, catalogues, order, now]);
  const scope = useMemo(() => (searching ? searchCatalogueIds(filtered) : null), [searching, filtered]);
  const results = useMemo(
    () => (scope ? searchProducts(filtered, terms, scope.ids, catalogues) : filtered),
    [scope, filtered, terms, catalogues]
  );

  // Paging restarts whenever the list's meaning changes.
  const listKey = JSON.stringify([query, terms, collection?.id ?? null]);
  const [paging, setPaging] = useState({ key: listKey, pages: 1 });
  const pages = paging.key === listKey ? paging.pages : 1;
  // A group of variants listed as one shows as one card (variants/model.ts).
  const variantGroups = useMemo(() => variantGroupsOf(index), [index]);
  const listed = useMemo(() => bundleRows(results, variantGroups), [results, variantGroups]);
  const shown = listed.slice(0, pages * PRODUCTS_PAGE);
  const grouped = sort === "featured" && !collection && !searching && featured.sectionOf.size > 0;
  const hasMore = shown.length < listed.length;
  const more = useCallback(
    () => setPaging((prev) => ({ key: listKey, pages: (prev.key === listKey ? prev.pages : 1) + 1 })),
    [listKey]
  );
  const { ref: sentinel } = useInView({ rootMargin: "400px 0px", onChange: (inView) => inView && more(), skip: !hasMore });

  // Catalogues for what is on screen, or for the search.
  const needed = scope ? scope.ids : catalogueIdsOf(shown);
  const neededKey = needed.join("|");
  useEffect(() => {
    if (productsStatus === "ready") load(neededKey ? neededKey.split("|") : []);
  }, [load, neededKey, productsStatus]);

  const failedCount = Object.values(statuses).filter((s) => s === "failed").length;
  const searchPending = scope ? scope.ids.filter((id) => !catalogues[id] && statuses[id] !== "failed").length : 0;
  // The products a search covers (at most 30 catalogues' worth), and how many of them it has read.
  const searchScope = useMemo(() => {
    if (!scope) return { total: 0, read: 0 };
    const ids = new Set(scope.ids);
    const inScope = filtered.filter((row) => ids.has(row.catalogueId));
    return { total: inScope.length, read: inScope.filter((row) => !!catalogues[row.catalogueId]).length };
  }, [scope, filtered, catalogues]);
  const cappedNote = `Only the first ${searchScope.total} products were searched; pick a category to narrow it down.`;
  const priced = query.minQort !== null || query.maxQort !== null;
  const activeFilters = query.categories.length + (query.inStockOnly ? 1 : 0) + (query.auctionsOnly ? 1 : 0) + (query.saleOnly ? 1 : 0) + (priced ? 1 : 0);

  const toggleCategory = (category: string) =>
    setFilters((q) => ({
      ...q,
      categories: q.categories.includes(category) ? q.categories.filter((c) => c !== category) : [...q.categories, category],
    }));
  const clearFilters = () => {
    setFilters((q) => ({ ...q, categories: [], inStockOnly: false, auctionsOnly: false, saleOnly: false }));
    setPrice({ min: "", max: "" });
  };
  const priceFields = <PriceRangeFields min={price.min} max={price.max} onChange={setPrice} titled={!phone} />;

  const addToCart = (row: ProductRow) => {
    const product = productOf(row, catalogues);
    dispatch(
      setProductToCart({ storeId, storeOwner: owner, productId: row.productId, catalogueId: row.catalogueId, quantity: 1 })
    );
    const title = typeof product?.title === "string" ? product.title.trim() : "";
    setAdded((prev) => ({ at: (prev?.at ?? 0) + 1, title: title || "Product", quantity: 1 }));
  };

  const sortSelect = (
    <TextField
      select
      size="small"
      label="Sort"
      value={sort}
      onChange={(event) => setPickedSort(event.target.value as ShopSort)}
      slotProps={{ select: { MenuProps: selectMenuProps } }}
      sx={{ minWidth: 170, flex: { xs: "1 1 150px", sm: "0 0 auto" }, "& .MuiInputBase-root": { minHeight: 44 } }}
    >
      {sortOptions.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );

  const stockSwitch = (
    <FormControlLabel
      control={
        <Switch checked={query.inStockOnly} onChange={(event) => setFilters((q) => ({ ...q, inStockOnly: event.target.checked }))} />
      }
      label="In stock only"
      sx={{ minHeight: 44, mr: 0 }}
    />
  );

  let status: string;
  if (productsStatus !== "ready") status = "";
  else if (searching && searchPending > 0) status = `Searching… ${searchScope.read} of ${searchScope.total} products read`;
  else if (searching) status = `${results.length} result${results.length === 1 ? "" : "s"} for “${terms.join(" ")}”`;
  else status = `${filtered.length} product${filtered.length === 1 ? "" : "s"}`;

  let body: ReactNode;
  if (productsStatus === "loading" || productsStatus === "fetching" || (productsStatus === "ready" && waitingForCollection)) {
    body = <ProductGridSkeleton count={phone ? 4 : 8} note={productsStatus === "fetching" ? FETCHING_NOTE : undefined} layout={layout} />;
  } else if (productsStatus === "missing") {
    body = isOwner ? (
      <EmptyState
        icon={<StorefrontOutlinedIcon />}
        title="Your shop has no product list yet"
        description="Manage Shop can create it, then you can add products."
        actionLabel="Open Manage Shop"
        onAction={onSellerPage}
      />
    ) : (
      <EmptyState icon={<StorefrontOutlinedIcon />} title="No products yet" description="This shop hasn't listed anything for sale." />
    );
  } else if (productsStatus === "unavailable") {
    body = (
      <EmptyState
        icon={<CloudOffOutlinedIcon />}
        title="Not available on your node right now"
        description="The product list hasn't reached your node yet."
        actionLabel="Retry"
        onAction={onRetry}
      />
    );
  } else if (collection && filterAndSortProducts(rows, DEFAULT_PRODUCT_QUERY, catalogues).length === 0) {
    body = (
      <EmptyState
        icon={<StorefrontOutlinedIcon />}
        title="Nothing in this collection right now"
        actionLabel="All products"
        onAction={() => navigate(storePath(owner, storeId))}
      />
    );
  } else if (rows.length === 0) {
    body = isOwner ? (
      <EmptyState
        icon={<StorefrontOutlinedIcon />}
        title="No products yet"
        description="Add your first product in Manage Shop."
        actionLabel="Add products"
        onAction={onSellerPage}
      />
    ) : (
      <EmptyState icon={<StorefrontOutlinedIcon />} title="No products yet" description="This shop hasn't listed anything for sale." />
    );
  } else if (filtered.length === 0) {
    body = <EmptyState icon={<TuneIcon />} title="No products match these filters" actionLabel="Clear filters" onAction={clearFilters} />;
  } else if (searching && results.length === 0 && searchPending === 0) {
    body = (
      <EmptyState
        icon={<SearchOffOutlinedIcon />}
        title={`No products match “${terms.join(" ")}”`}
        description={scope?.capped ? cappedNote : undefined}
        actionLabel="Show all products"
        onAction={() => setSearchText("")}
      />
    );
  } else if (searching && results.length === 0) {
    body = <ProductGridSkeleton count={phone ? 2 : 4} layout={layout} />;
  } else {
    body = (
      <>
        <ProductGrid layout={layout}>
          {shown.map((row, i) => {
            const product = productOf(row, catalogues);
            const state = statuses[row.catalogueId];
            // Featured across the whole shop: a line with the collection's title where its products start.
            const section = grouped ? (featured.sectionOf.get(row.productId) ?? -1) : null;
            const previous = grouped && i > 0 ? (featured.sectionOf.get(shown[i - 1].productId) ?? -1) : null;
            const sectionStarts = section !== null && section !== previous && (section >= 0 || i > 0);
            const sectionCollection = section !== null && section >= 0 ? collections.collections[section] : null;
            return [
              sectionStarts && (
                <SectionDivider
                  key={`section-${row.productId}`}
                  title={sectionCollection ? sectionCollection.title || "Collection" : "More products"}
                  to={sectionCollection ? collectionPath(owner, storeId, sectionCollection.id) : undefined}
                  first={i === 0}
                />
              ),
              <li key={row.productId}>
                {product ? (
                  <LocalBoundary
                    label={`The card of product ${row.productId}`}
                    fallback={<UnavailableCard text="This product couldn't be shown." />}
                  >
                    <ProductCard
                      product={product}
                      productId={row.productId}
                      catalogueId={row.catalogueId}
                      owner={owner}
                      storeId={storeId}
                      status={effectiveStatus(row, catalogues)}
                      shop={shop}
                      coin={shopCoin.coin}
                      rate={shopCoin.rate}
                      isOwnProduct={isOwner}
                      onAddToCart={() => addToCart(row)}
                      layout={layout}
                      compact={layout === "tile" && phone}
                      stacked={phone}
                      auction={auctionTimesOf(row, catalogues)}
                      now={now}
                      bundle={row.bundle}
                      soldOut={row.soldOut}
                    />
                  </LocalBoundary>
                ) : (
                  <ProductCardSkeleton
                    note={state === "fetching" ? FETCHING_NOTE : state === "failed" ? "Not available on your node right now" : undefined}
                    layout={layout}
                  />
                )}
              </li>,
            ];
          })}
        </ProductGrid>
        {hasMore && (
          <Box ref={sentinel} sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
            <Button variant="outlined" color="inherit" onClick={more} sx={{ minHeight: 44, minWidth: 160 }}>
              Show more
            </Button>
          </Box>
        )}
      </>
    );
  }

  return (
    <>
      {productsStatus === "ready" && collections.status !== "none" && (
        <CollectionCards
          owner={owner}
          storeId={storeId}
          collections={collections.collections}
          counts={counts}
          selectedId={collection?.id ?? null}
          state={collections.status}
          onRetry={collections.retry}
        />
      )}
      <Box ref={productsSection} component="section" aria-labelledby="shop-products-heading" sx={{ mt: 3 }}>
        {collection ? (
          <CollectionHeader
            owner={owner}
            storeId={storeId}
            collection={collection}
            count={counts[collection.id] ?? 0}
            headingId="shop-products-heading"
            headingRef={collectionHeading}
          />
        ) : null}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1.5, minHeight: 44 }}>
          {collection ? (
            <span />
          ) : (
            <Typography id="shop-products-heading" component="h2" sx={{ fontSize: 18, fontWeight: 700 }}>
              Products
            </Typography>
          )}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, ml: "auto" }}>
            <Typography variant="body2" color="text.secondary" role="status" aria-live="polite" sx={{ fontSize: 14 }}>
              {status}
            </Typography>
            {productsStatus === "ready" && rows.length > 0 && <ProductViewToggle layout={layout} />}
          </Box>
        </Box>
        {collectionGone && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            That collection isn&apos;t in this shop any more. Here are all the shop&apos;s products.
          </Typography>
        )}

        {productsStatus === "ready" && rows.length > 0 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 2 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
              <TextField
                type="search"
                size="small"
                placeholder="Search this shop"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                sx={{ flex: "1 1 260px", minWidth: 0, "& .MuiInputBase-root": { minHeight: 44 } }}
                slotProps={{
                  htmlInput: { "aria-label": "Search this shop", enterKeyHint: "search" },
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                    endAdornment: searchText ? (
                      <InputAdornment position="end">
                        <IconButton aria-label="Clear search" onClick={() => setSearchText("")} edge="end" sx={{ width: 40, height: 40 }}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ) : undefined,
                  },
                }}
              />
              {sortSelect}
              <CoinPicker shop={shop} shopCoin={shopCoin} />
              <AuctionsToggle count={auctions} on={!!query.auctionsOnly} onChange={(on) => setFilters((q) => ({ ...q, auctionsOnly: on }))} />
              <SaleToggle count={onSale} on={!!query.saleOnly} onChange={(on) => setFilters((q) => ({ ...q, saleOnly: on }))} />
              {phone && (
                <Button
                  variant={activeFilters ? "contained" : "outlined"}
                  color={activeFilters ? "primary" : "inherit"}
                  startIcon={<TuneIcon />}
                  onClick={() => setFiltersOpen(true)}
                  sx={{ minHeight: 44, flex: "1 1 auto" }}
                >
                  {activeFilters ? `Filters (${activeFilters})` : "Filters"}
                </Button>
              )}
            </Box>
            {!phone && (
              <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2 }}>
                <Box sx={{ flex: "1 1 320px", minWidth: 0 }}>
                  <CategoryChips
                    categories={categories}
                    selected={query.categories}
                    onToggle={toggleCategory}
                    onClear={() => setFilters((q) => ({ ...q, categories: [] }))}
                  />
                </Box>
                {priceFields}
                {stockSwitch}
              </Box>
            )}
            <RateNote shopCoin={shopCoin} />
            {scope?.capped && results.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                {cappedNote}
              </Typography>
            )}
            {failedCount > 0 && (
              <Box role="status" sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Some products aren't available on your node right now.
                </Typography>
                <Button variant="outlined" color="inherit" onClick={retryFailed} sx={{ minHeight: 44 }}>
                  Retry
                </Button>
              </Box>
            )}
          </Box>
        )}

        <Box data-swap>{body}</Box>

        {phone && (
          <BottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {categories.length > 0 && (
                <Box>
                  <Typography component="h3" variant="subtitle2" sx={{ mb: 1 }}>
                    Categories
                  </Typography>
                  <CategoryChips
                    categories={categories}
                    selected={query.categories}
                    onToggle={toggleCategory}
                    onClear={() => setFilters((q) => ({ ...q, categories: [] }))}
                  />
                </Box>
              )}
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
                  {`Show ${filtered.length} product${filtered.length === 1 ? "" : "s"}`}
                </Button>
              </Box>
            </Box>
          </BottomSheet>
        )}

        <AddedToCartSnackbar notice={added} onClose={() => setAdded(null)} />
      </Box>
    </>
  );
}

function ShopPage({ owner, storeId }: { owner: string; storeId: string }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const currentStoreId = useSelector((state: RootState) => state.global.currentStore?.id);
  const { shop, shopStatus, index, productsStatus, isOwner, retry } = useViewedShop(owner, storeId);
  const shopCollections = useShopCollections(owner, storeId, index);
  const [searchParams] = useSearchParams();
  const collectionId = searchParams.get("collection");
  const reviews = useShopReviews(storeId, owner);
  // Once the shop is read: its `created` leaves out orders for an earlier shop with this id.
  const orderCount = useOrderCount(owner, shop ? storeId : "", shop ? Number(shop.created) || undefined : undefined);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const sellerPage = () => navigate(`/product-manager/${encodeURIComponent(storeId)}`);

  const title =
    shop?.title ||
    (shopStatus === "loading" || shopStatus === "fetching" ? (
      <>
        <Box component="span" sx={visuallyHiddenSx}>
          Loading shop
        </Box>
        <Skeleton aria-hidden width="min(60%, 320px)" />
      </>
    ) : (
      "Shop"
    ));

  let content: ReactNode;
  if (shopStatus === "missing") {
    content = (
      <EmptyState
        icon={<StorefrontOutlinedIcon />}
        title="Shop not found"
        description={`${owner} has no shop here, or it was removed.`}
        actionLabel="Browse shops"
        onAction={() => navigate("/")}
      />
    );
  } else if (shopStatus === "deleted") {
    content = (
      <EmptyState
        icon={<StorefrontOutlinedIcon />}
        title="This shop was deleted"
        description={`${owner} deleted this shop. Orders you placed there stay in My orders.`}
        actionLabel="Browse shops"
        onAction={() => navigate("/")}
      />
    );
  } else if (shopStatus === "unavailable") {
    content = (
      <EmptyState
        icon={<CloudOffOutlinedIcon />}
        title="Not available on your node right now"
        description="This shop hasn't reached your node yet."
        actionLabel="Retry"
        onAction={retry}
      />
    );
  } else if (!shop) {
    content = (
      <>
        <ShopHeaderSkeleton />
        {shopStatus === "fetching" && (
          <Typography variant="body2" color="text.secondary" role="status" sx={{ mt: 1 }}>
            {FETCHING_NOTE}
          </Typography>
        )}
        <Box sx={{ mt: 3 }}>
          <ProductGridSkeleton count={4} />
        </Box>
      </>
    );
  } else {
    content = (
      <>
        <ShopHeader
          shop={shop}
          owner={owner}
          storeId={storeId}
          isOwner={isOwner}
          canEdit={currentStoreId === storeId}
          reviews={reviews}
          orderCount={orderCount}
          onOpenReviews={() => setReviewsOpen(true)}
          onOpenDetails={() => setDetailsOpen(true)}
          onEdit={() => dispatch(toggleEditStoreModal(true))}
          onSellerPage={sellerPage}
        />
        <ShopProducts
          owner={owner}
          storeId={storeId}
          shop={shop}
          isOwner={isOwner}
          productsStatus={productsStatus}
          index={index}
          onRetry={retry}
          onSellerPage={sellerPage}
          collections={shopCollections}
          collectionId={collectionId}
        />
        {detailsOpen && <StoreDetails open onClose={() => setDetailsOpen(false)} shop={shop} owner={owner} />}
        {reviewsOpen && (
          <ResponsiveDialog open onClose={() => setReviewsOpen(false)} title={`Reviews · ${shop.title || "Shop"}`} maxWidth="md">
            <ReviewsPanel storeId={storeId} storeTitle={shop.title || ""} storeImage={shop.logo || ""} storeOwner={owner} />
          </ResponsiveDialog>
        )}
      </>
    );
  }

  return (
    <Page width="grid">
      <PageHeader back backTo="/" title={title} actions={!isOwner ? <CartButton /> : undefined} />
      {content}
    </Page>
  );
}

export const Store = () => {
  const params = useParams();
  const owner = decodeParam(params.user);
  const storeId = decodeParam(params.store);
  // A new shop starts with fresh filters, search and paging.
  return <ShopPage key={`${owner}\n${storeId}`} owner={owner} storeId={storeId} />;
};

export default Store;
