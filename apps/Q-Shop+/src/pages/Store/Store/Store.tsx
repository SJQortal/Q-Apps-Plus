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
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Skeleton,
  Switch,
  TextField,
  Typography,
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
import { PHONE_MEDIA, usePhoneLayout } from "../../../hooks/usePhoneLayout";
import { useShopCoin } from "../../../money/useShopCoin";
import { decodeParam } from "../../../qdn/links";
import {
  categoriesOf,
  catalogueIdsOf,
  DEFAULT_PRODUCT_QUERY,
  effectiveStatus,
  filterAndSortProducts,
  productOf,
  productRowsFromContainer,
  PRODUCT_SORTS,
  PRODUCTS_PAGE,
  searchCatalogueIds,
  searchProducts,
  searchTerms,
  SEARCH_CATALOGUE_CAP,
  type ProductQuery,
  type ProductRow,
  type ProductSort,
} from "../shopData";
import { useCatalogueLoader, useShopReviews, useViewedShop, type LoadStatus } from "../useShopData";
import { ProductCard, ProductCardSkeleton } from "../ProductCard/ProductCard";
import { ShopHeader, ShopHeaderSkeleton } from "../ShopHeader";
import { StoreDetails } from "../StoreDetails/StoreDetails";
import { ReviewsPanel } from "../StoreReviews/ReviewsPanel";
import { CoinPicker, RateNote } from "../CoinPicker";
import { AddedToCartSnackbar, CartButton, type AddedNotice } from "../CartBits";

/** The coins a price list can show in. Kept here because Settings, the cart and the seller tools import it. */
export enum CoinFilter {
  qort = "QORT",
  arrr = "ARRR",
}

const FETCHING_NOTE = "Fetching from peers…";

/** Read by screen readers, not shown. */
const visuallyHiddenSx = {
  position: "absolute",
  width: 1,
  height: 1,
  p: 0,
  m: "-1px",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function CategoryChips({
  categories,
  selected,
  onToggle,
  onClear,
}: {
  categories: string[];
  selected: string[];
  onToggle: (category: string) => void;
  onClear: () => void;
}) {
  if (categories.length === 0) return null;
  return (
    <Box role="group" aria-label="Categories" sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
      <Chip
        label="All"
        onClick={onClear}
        color={selected.length === 0 ? "primary" : "default"}
        variant={selected.length === 0 ? "filled" : "outlined"}
        aria-pressed={selected.length === 0}
        sx={{ minHeight: 36 }}
      />
      {categories.map((category) => {
        const on = selected.includes(category);
        return (
          <Chip
            key={category}
            label={category}
            onClick={() => onToggle(category)}
            color={on ? "primary" : "default"}
            variant={on ? "filled" : "outlined"}
            aria-pressed={on}
            sx={{ minHeight: 36, maxWidth: "100%" }}
          />
        );
      })}
    </Box>
  );
}

function ProductGridSkeleton({ count, note }: { count: number; note?: string }) {
  return (
    <ProductGrid aria-busy>
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <ProductCardSkeleton note={i === 0 ? note : undefined} />
        </li>
      ))}
    </ProductGrid>
  );
}

function ProductGrid({ children, ...rest }: { children: ReactNode; "aria-busy"?: boolean }) {
  return (
    <Box
      component="ul"
      {...rest}
      sx={{
        listStyle: "none",
        m: 0,
        p: 0,
        display: "grid",
        gap: { xs: 1.5, sm: 2 },
        gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 200px), 1fr))",
        // Phones: one column of rows (two side by side in landscape).
        [`@media ${PHONE_MEDIA}`]: {
          gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))",
        },
        "& > li": { minWidth: 0 },
      }}
    >
      {children}
    </Box>
  );
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
}: {
  owner: string;
  storeId: string;
  shop: Parameters<typeof useShopCoin>[0];
  isOwner: boolean;
  productsStatus: LoadStatus;
  index: { products?: unknown } | null;
  onRetry: () => void;
  onSellerPage: () => void;
}) {
  const dispatch = useDispatch();
  const phone = usePhoneLayout();
  const shopCoin = useShopCoin(shop);
  const { catalogues, statuses, load, retryFailed } = useCatalogueLoader(owner);
  const [query, setQuery] = useState<ProductQuery>(DEFAULT_PRODUCT_QUERY);
  const [searchText, setSearchText] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [added, setAdded] = useState<AddedNotice | null>(null);
  const debouncedSearch = useDebounced(searchText, 250);
  const terms = useMemo(() => searchTerms(debouncedSearch), [debouncedSearch]);
  const searching = terms.length > 0;

  const rows = useMemo(() => productRowsFromContainer(index), [index]);
  const categories = useMemo(() => categoriesOf(rows), [rows]);
  const filtered = useMemo(() => filterAndSortProducts(rows, query, catalogues), [rows, query, catalogues]);
  const scope = useMemo(() => (searching ? searchCatalogueIds(filtered) : null), [searching, filtered]);
  const results = useMemo(
    () => (scope ? searchProducts(filtered, terms, scope.ids, catalogues) : filtered),
    [scope, filtered, terms, catalogues]
  );

  // Paging restarts whenever the list's meaning changes.
  const listKey = JSON.stringify([query, terms]);
  const [paging, setPaging] = useState({ key: listKey, pages: 1 });
  const pages = paging.key === listKey ? paging.pages : 1;
  const shown = results.slice(0, pages * PRODUCTS_PAGE);
  const hasMore = shown.length < results.length;
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
  const activeFilters = query.categories.length + (query.inStockOnly ? 1 : 0);

  const toggleCategory = (category: string) =>
    setQuery((q) => ({
      ...q,
      categories: q.categories.includes(category) ? q.categories.filter((c) => c !== category) : [...q.categories, category],
    }));
  const clearFilters = () => setQuery((q) => ({ ...q, categories: [], inStockOnly: false }));

  const addToCart = (row: ProductRow) => {
    const product = productOf(row, catalogues);
    dispatch(
      setProductToCart({ storeId, storeOwner: owner, productId: row.productId, catalogueId: row.catalogueId, quantity: 1 })
    );
    setAdded((prev) => ({ at: (prev?.at ?? 0) + 1, title: product?.title?.trim() || "Product", quantity: 1 }));
  };

  const sortSelect = (
    <TextField
      select
      size="small"
      label="Sort"
      value={query.sort}
      onChange={(event) => setQuery((q) => ({ ...q, sort: event.target.value as ProductSort }))}
      slotProps={{ select: { native: true } }}
      sx={{ minWidth: 170, flex: { xs: "1 1 150px", sm: "0 0 auto" }, "& .MuiInputBase-root": { minHeight: 44 } }}
    >
      {PRODUCT_SORTS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </TextField>
  );

  const stockSwitch = (
    <FormControlLabel
      control={
        <Switch checked={query.inStockOnly} onChange={(event) => setQuery((q) => ({ ...q, inStockOnly: event.target.checked }))} />
      }
      label="In stock only"
      sx={{ minHeight: 44, mr: 0 }}
    />
  );

  let status: string;
  if (productsStatus !== "ready") status = "";
  else if (searching && searchPending > 0) status = `Searching… ${scope!.ids.length - searchPending} of ${scope!.ids.length} catalogues read`;
  else if (searching) status = `${results.length} result${results.length === 1 ? "" : "s"} for “${terms.join(" ")}”`;
  else status = `${filtered.length} product${filtered.length === 1 ? "" : "s"}`;

  let body: ReactNode;
  if (productsStatus === "loading" || productsStatus === "fetching") {
    body = <ProductGridSkeleton count={phone ? 4 : 8} note={productsStatus === "fetching" ? FETCHING_NOTE : undefined} />;
  } else if (productsStatus === "missing") {
    body = isOwner ? (
      <EmptyState
        icon={<StorefrontOutlinedIcon />}
        title="Your shop has no product list yet"
        description="The seller page can create it, then you can add products."
        actionLabel="Open seller page"
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
  } else if (rows.length === 0) {
    body = isOwner ? (
      <EmptyState
        icon={<StorefrontOutlinedIcon />}
        title="No products yet"
        description="Add your first product on the seller page."
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
        description={scope?.capped ? `Only the first ${SEARCH_CATALOGUE_CAP * 10} products were searched; pick a category to narrow it down.` : undefined}
        actionLabel="Show all products"
        onAction={() => setSearchText("")}
      />
    );
  } else if (searching && results.length === 0) {
    body = <ProductGridSkeleton count={phone ? 2 : 4} />;
  } else {
    body = (
      <>
        <ProductGrid>
          {shown.map((row) => {
            const product = productOf(row, catalogues);
            const state = statuses[row.catalogueId];
            return (
              <li key={row.productId}>
                {product ? (
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
                  />
                ) : (
                  <ProductCardSkeleton
                    note={state === "fetching" ? FETCHING_NOTE : state === "failed" ? "Not available on your node right now" : undefined}
                  />
                )}
              </li>
            );
          })}
        </ProductGrid>
        {hasMore && (
          <Box ref={sentinel} sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
            <Button variant="outlined" onClick={more} sx={{ minHeight: 44, minWidth: 160 }}>
              Show more
            </Button>
          </Box>
        )}
      </>
    );
  }

  return (
    <Box component="section" aria-labelledby="shop-products-heading" sx={{ mt: 3 }}>
      <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1, mb: 1.5 }}>
        <Typography id="shop-products-heading" component="h2" sx={{ fontSize: 18, fontWeight: 700 }}>
          Products
        </Typography>
        <Typography variant="body2" color="text.secondary" role="status" aria-live="polite">
          {status}
        </Typography>
      </Box>

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
            {phone && (
              <Button
                variant={activeFilters ? "contained" : "outlined"}
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
                  onClear={() => setQuery((q) => ({ ...q, categories: [] }))}
                />
              </Box>
              {stockSwitch}
            </Box>
          )}
          <RateNote shopCoin={shopCoin} />
          {scope?.capped && results.length > 0 && (
            <Typography variant="body2" color="text.secondary">
              Only the first {SEARCH_CATALOGUE_CAP * 10} products were searched; pick a category to narrow it down.
            </Typography>
          )}
          {failedCount > 0 && (
            <Box role="status" sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Some products aren't available on your node right now.
              </Typography>
              <Button variant="outlined" onClick={retryFailed} sx={{ minHeight: 44 }}>
                Retry
              </Button>
            </Box>
          )}
        </Box>
      )}

      {body}

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
                  onClear={() => setQuery((q) => ({ ...q, categories: [] }))}
                />
              </Box>
            )}
            {stockSwitch}
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button onClick={clearFilters} disabled={!activeFilters} sx={{ minHeight: 44 }}>
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
  );
}

function ShopPage({ owner, storeId }: { owner: string; storeId: string }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const currentStoreId = useSelector((state: RootState) => state.global.currentStore?.id);
  const { shop, shopStatus, index, productsStatus, isOwner, retry } = useViewedShop(owner, storeId);
  const reviews = useShopReviews(storeId, owner);
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
