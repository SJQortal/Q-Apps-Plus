/**
 * The seller's Products tab: every product in the shop's index as cards on
 * phones and aligned rows on wider screens, with search, status chips with
 * counts, a category filter and a sort. Status, QORT price and category come
 * from the index at once; titles and images come from the catalogues, loaded
 * only for the products on screen (useCatalogueLoader). Tapping a product
 * opens its edit form.
 *
 * A product the index names but its catalogue doesn't hold (a publish where
 * the catalogue failed and the index landed) says so once its catalogue has
 * been read again, fresh, and opens from its index row, as the original did:
 * saving puts it back into its catalogue.
 *
 * Arrange opens seller/ArrangeShop.tsx: the order buyers see under "Collections".
 * Sorted by shop order, each collection's line has its own Arrange: the
 * collection's order, kept with the unpublished collections (seller/useCollections.ts).
 *
 * Select turns the list into checkboxes: Select all (everything the filters
 * show), then Delete, which the seller page asks about first
 * (seller/DeleteProductsDialog.tsx). The selection bar stays at the top
 * while the list scrolls, says how many chosen products the filters hide,
 * takes the keyboard focus, and Escape leaves it.
 */
import { shortStoreIdOf } from "../qdn/identifiers";
import { stockOf } from "../stock/model";
import { useStockLeft } from "../stock/notes";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProductImage } from "../components/common/ProductImage";
import { useSelector } from "react-redux";
import {
  Badge,
  Box,
  Button,
  ButtonBase,
  Chip,
  IconButton,
  InputAdornment,
  MenuItem,
  Skeleton,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import ChecklistOutlinedIcon from "@mui/icons-material/ChecklistOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import { useInView } from "react-intersection-observer";
import type { RootState } from "../state/store";
import { AmountTag } from "../components/money/PriceTag";
import { EmptyState } from "../components/common/EmptyState";
import { BottomSheet } from "../components/common/mobile";
import { usePhoneLayout } from "../hooks/usePhoneLayout";
import { stickyBelowHeader } from "../components/layout/Navbar/Navbar-styles";
import { visuallyHiddenSx } from "../pages/Store/a11y";
import { CategoryIcon } from "../components/CategoryIcon";
import { STATUS_LABEL, productForEdit, productFromIndexRow } from "./productDraft";
import { auctionRowOf } from "../auctions/catalog";
import { useNow } from "../hooks/useNow";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import {
  DEFAULT_FILTERS,
  SORT_COLUMNS,
  SORT_LABEL,
  filterSellerProducts,
  isFiltered,
  needsDetails,
  shopOrderPlaces,
  sortColumnOf,
  sortForColumn,
  statusCounts,
  statusOf,
  type SellerFilters,
  type SellerRow,
  type SellerSort,
  type SortColumn,
  type StatusFilter,
} from "./productList";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import { useCatalogueLoader, type CatalogueLoad } from "./useCatalogueLoader";
import { BulkStatusDialog } from "./BulkStatusDialog";
import { rowSaleOf, saleOf } from "../sale/compareAt";
import { ArrangeShop } from "./ArrangeShop";
import { ArrangeDialog } from "./ArrangeDialog";
import { collectionDrafts, collectionsDraftKey } from "./useCollections";
import type { ShopCollection } from "../qdn/collections";
import { featuredOrder, productOrderOf } from "../qdn/productOrder";
import { useShopCollections } from "../pages/Store/useShopCollections";
import { SectionDivider } from "../pages/Store/ProductList";
import { selectMenuProps } from "../components/common/menuStyle";

export const PRODUCTS_PAGE = 24;

const STATUS_CHIPS: StatusFilter[] = ["all", "AVAILABLE", "AUCTION", "OUT_OF_STOCK", "RETIRED"];
const STATUS_COLOR: Record<string, "success" | "warning" | "info" | "default"> = {
  AVAILABLE: "success",
  AUCTION: "info",
  OUT_OF_STOCK: "warning",
  RETIRED: "default",
};

const dateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });
const auctionTimeFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/**
 * An auction's start and end on its row (Simon, 2026-10-24: "show when it
 * starts and finishes on the products list"), from its product-list row, in
 * the past tense once passed.
 */
function AuctionTimes({ row }: { row: unknown }) {
  const now = useNow(60_000);
  const times = auctionRowOf(row);
  if (!times) return null;
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "flex-start", gap: 0.5, minWidth: 0 }}>
      <GavelOutlinedIcon sx={{ fontSize: 18, mt: "1px", flexShrink: 0 }} aria-hidden />
      <Box component="span" sx={{ minWidth: 0 }}>
        {now >= times.start ? "Started" : "Starts"} {auctionTimeFormat.format(times.start)} · {now >= times.end ? "Ended" : "Ends"} {auctionTimeFormat.format(times.end)}
      </Box>
    </Box>
  );
}

export function StatusChip({ status, auction, left }: { status: string; auction?: unknown; left?: number }) {
  const s = statusOf({ status, auction });
  // A counted product (stock/model.ts): what's left, or Sold out once none is.
  const soldOut = s === "AVAILABLE" && left === 0;
  // The status colour is the border; the text stays text.primary, because
  // orange (and blue) text on white is under 4.5:1 in the light themes.
  const tone = soldOut ? "warning" : STATUS_COLOR[s];
  return (
    <Chip
      size="small"
      variant="outlined"
      label={soldOut ? "Sold out" : s === "AVAILABLE" && left !== undefined ? `${STATUS_LABEL[s]} · ${left} left` : STATUS_LABEL[s]}
      sx={{ fontWeight: 600, color: "text.primary", ...(tone === "default" ? {} : { borderColor: `${tone}.main` }) }}
    />
  );
}

interface ProductsTabProps {
  /** Open the form for a new product. */
  onAdd: () => void;
  /** Open the form for a product: the draft if there is one, else the published product. */
  onEdit: (product: Record<string, any> & { id: string }) => void;
  /** The product index is loaded and belongs to the current shop. */
  ready: boolean;
  /** Not ready yet, and still loading (else the status card above says why). */
  loading?: boolean;
  /** Delete these products (the seller page asks first); `onDeleted` runs once they are gone. */
  onDelete?: (products: { id: string; catalogueId?: string; title?: string }[], onDeleted: () => void) => void;
}

export function ProductsTab({ onAdd, onEdit, ready, loading = false, onDelete }: ProductsTabProps) {
  const phone = usePhoneLayout();
  const owner = useSelector((state: RootState) => state.global.currentStore?.owner || state.auth.user?.name);
  const storeId = useSelector((state: RootState) => state.global.currentStore?.id ?? "");
  const rows = useSelector((state: RootState) => state.global.listProducts.products) as SellerRow[];
  const categories = useSelector((state: RootState) => state.global.listProducts.categories);
  const productsToSave = useSelector((state: RootState) => state.global.productsToSave);
  const dataContainer = useSelector((state: RootState) => state.global.dataContainer);
  // The order buyers see under Collections: the collections' products first, collection by collection,
  // then the rest in the seller's own order (Arrange). The list opens on it once there is one. Collections
  // changed and not published yet (the seller page's Publish changes bar) show as they will be.
  const publishedCollections = useShopCollections(owner ?? "", storeId, dataContainer).collections;
  const collectionsKey = collectionsDraftKey(useSelector((state: RootState) => state.auth.user?.name), storeId);
  const collectionsDraft = collectionDrafts.useDraft(collectionsKey);
  const shopCollections = collectionsDraft ?? publishedCollections;
  const featured = useMemo(() => featuredOrder(shopCollections, productOrderOf(dataContainer)), [shopCollections, dataContainer]);
  const order = featured.order;
  const { request, retry, refresh, statusOf: loadOf, productOf } = useCatalogueLoader(owner);

  const [filters, setFilters] = useState<SellerFilters>(DEFAULT_FILTERS);
  const [chosenSort, setChosenSort] = useState<SellerSort | null>(null);
  const defaultSort: SellerSort = order.length > 0 ? "featured" : "newest";
  const sort: SellerSort = chosenSort === "featured" && order.length === 0 ? "newest" : (chosenSort ?? defaultSort);
  const view: SellerFilters = { ...filters, sort };
  const [shown, setShown] = useState(PRODUCTS_PAGE);
  const [sheetOpen, setSheetOpen] = useState(false);
  // The product the seller tapped before its catalogue had loaded; its form opens once it lands.
  const [pendingEdit, setPendingEdit] = useState<string | null>(null);
  const openedFor = useRef<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [arranging, setArranging] = useState(false);
  // The collection being arranged from its line in the list (by id).
  const [arrangingCollection, setArrangingCollection] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  // Focus follows select mode: into its bar when it starts, back to Select when it ends.
  const selectButton = useRef<HTMLButtonElement>(null);
  const selectAllButton = useRef<HTMLButtonElement>(null);
  const focusNext = useRef<"bar" | "select" | null>(null);
  useEffect(() => {
    if (focusNext.current === "bar" && selecting) selectAllButton.current?.focus();
    if (focusNext.current === "select" && !selecting) selectButton.current?.focus();
    focusNext.current = null;
  }, [selecting]);

  const detailsOf = (row: SellerRow) => productOf(row.catalogueId, row.productId);
  // Counted products (stock/model.ts): what's left of each, from the shop's order notes.
  const { left: stockLeftOf } = useStockLeft(
    rows.flatMap((row) => {
      const stock = stockOf(row);
      return stock ? [{ shortStoreId: shortStoreIdOf(storeId), productId: row.productId, stock }] : [];
    })
  );
  const filtered = filterSellerProducts(rows, view, detailsOf, order);
  // With an order, each product's place in it is a column of its own.
  const places = useMemo(() => (order.length > 0 ? shopOrderPlaces(rows, order) : null), [rows, order]);
  const columns = rowColumns(!!places);
  const sortBy = (next: SellerSort) => {
    setChosenSort(next);
    setShown(PRODUCTS_PAGE);
  };
  const counts = useMemo(() => statusCounts(rows), [rows]);
  const visible = filtered.slice(0, shown);
  const sortedCategories = useMemo(() => [...categories].sort((a, b) => a.localeCompare(b)), [categories]);

  // A search (or a sort by title) needs every product's title: load the
  // catalogues of the products the other filters leave, 5 at a time.
  const searchCatalogues = needsDetails(view)
    ? [...new Set(filterSellerProducts(rows, { ...filters, query: "", sort: "newest" }, detailsOf).map((r) => r.catalogueId))]
    : [];
  const searchKey = searchCatalogues.join("|");
  useEffect(() => {
    if (searchKey) request(searchKey.split("|"));
  }, [searchKey, request]);

  // A collection's own order (its page, and its part of the Collections sort): its listed products.
  const collectionToArrange = shopCollections.find((c) => c.id === arrangingCollection) ?? null;
  const collectionRows = useMemo(() => {
    if (!collectionToArrange) return [];
    const byId = new Map(rows.map((row) => [row.productId, row]));
    return collectionToArrange.products.flatMap((id) => {
      const row = byId.get(id);
      return row && row.status !== "RETIRED" ? [row] : [];
    });
  }, [collectionToArrange, rows]);
  // The new order goes into the collections draft, published with the seller's other changes;
  // products not arranged (retired, or not in the list) keep their places after it.
  const saveCollectionOrder = (collection: ShopCollection, order: string[]) => {
    const placed = new Set(order);
    const next = shopCollections.map((c) =>
      c.id === collection.id ? { ...c, products: [...order, ...c.products.filter((id) => !placed.has(id))] } : c
    );
    collectionDrafts.set(collectionsKey, JSON.stringify(next) === JSON.stringify(publishedCollections) ? null : next);
  };

  const edit = (row: SellerRow) => {
    const draft = productsToSave[row.productId];
    if (draft) return onEdit(draft as unknown as Record<string, any> & { id: string });
    const details = productOf(row.catalogueId, row.productId);
    if (details) return onEdit(productForEdit(row, details));
    const load = loadOf(row.catalogueId);
    // Loaded, and the product isn't in it: read it once more (a copy from
    // before another device's publish), else open the form from the index row.
    if (load === "ready" && !refresh(row.catalogueId)) return onEdit(productFromIndexRow(row, storeId));
    openedFor.current = null;
    setPendingEdit(row.productId);
    if (load === "failed") retry(row.catalogueId);
    else if (load !== "ready") request([row.catalogueId]);
  };

  // Open the form once the catalogue of the product the seller tapped lands:
  // from its entry there, or from its index row if it isn't there.
  const pendingRow = pendingEdit ? rows.find((r) => r.productId === pendingEdit) : undefined;
  const pendingDetails = pendingRow ? productOf(pendingRow.catalogueId, pendingRow.productId) : undefined;
  const pendingLoad = pendingRow ? loadOf(pendingRow.catalogueId) : "idle";
  const opening =
    pendingRow && !pendingDetails && pendingLoad !== "failed" && pendingLoad !== "ready" ? pendingRow.productId : null;
  useEffect(() => {
    if (!pendingRow || openedFor.current === pendingRow.productId) return;
    if (pendingDetails) {
      openedFor.current = pendingRow.productId;
      onEdit(productForEdit(pendingRow, pendingDetails));
    } else if (pendingLoad === "ready") {
      openedFor.current = pendingRow.productId;
      onEdit(productFromIndexRow(pendingRow, storeId));
    }
  }, [pendingRow, pendingDetails, pendingLoad, storeId, onEdit]);

  const toggle = useCallback((row: SellerRow) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(row.productId)) next.delete(row.productId);
      else next.add(row.productId);
      return next;
    });
  }, []);
  // Only products still listed count (a delete or a reload may have removed some).
  const chosen = rows.filter((row) => selected.has(row.productId));
  const allChosen = filtered.length > 0 && filtered.every((row) => selected.has(row.productId));
  // Chosen, then hidden by a search or a filter: they still go, so the bar says so.
  const shownIds = new Set(filtered.map((row) => row.productId));
  const hiddenChosen = chosen.filter((row) => !shownIds.has(row.productId)).length;
  const startSelecting = () => {
    focusNext.current = "bar";
    setSelecting(true);
  };
  const stopSelecting = () => {
    focusNext.current = "select";
    setSelecting(false);
    setSelected(new Set());
  };
  const knownTitle = (row: SellerRow) => {
    const title = detailsOf(row)?.title;
    return typeof title === "string" && title.trim() ? title.trim() : undefined;
  };
  // Change status (BulkStatusDialog): the chosen products, then the drafts' notice.
  const [bulkStatus, setBulkStatus] = useState(false);
  const [bulkDrafted, setBulkDrafted] = useState<string | null>(null);
  const askDelete = () => {
    if (!onDelete || chosen.length === 0) return;
    onDelete(
      chosen.map((row) => ({ id: row.productId, catalogueId: row.catalogueId, title: knownTitle(row) })),
      stopSelecting
    );
  };

  const update = (patch: Partial<SellerFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setShown(PRODUCTS_PAGE);
  };
  const filtersActive = filters.category !== "" || sort !== defaultSort;

  const categorySelect = (
    <TextField
      select
      label="Category"
      value={filters.category}
      onChange={(e) => update({ category: e.target.value })}
      slotProps={{ select: { MenuProps: selectMenuProps } }}
      sx={{ minWidth: 180 }}
      fullWidth={phone}
    >
      <MenuItem value="">All categories</MenuItem>
      {sortedCategories.map((c) => (
        <MenuItem key={c} value={c}>
          {c}
        </MenuItem>
      ))}
    </TextField>
  );
  const sortSelect = (
    <TextField
      select
      label="Sort"
      value={sort}
      onChange={(e) => sortBy(e.target.value as SellerSort)}
      slotProps={{ select: { MenuProps: selectMenuProps } }}
      sx={{ minWidth: 190 }}
      fullWidth={phone}
    >
      {(Object.keys(SORT_LABEL) as SellerSort[]).filter((s) => !s.startsWith("featured") || order.length > 0).map((s) => (
        <MenuItem key={s} value={s}>
          {SORT_LABEL[s]}
        </MenuItem>
      ))}
    </TextField>
  );

  if (!ready && !loading) {
    return <EmptyState title="Your products show here once your product list loads" description="See the note above." />;
  }
  if (!ready) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }} aria-busy="true" aria-label="Loading products">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} variant="rounded" height={72} />
        ))}
      </Box>
    );
  }

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", gap: 2 }}
      onKeyDown={
        selecting
          ? (event) => {
              if (event.key !== "Escape") return;
              event.stopPropagation();
              stopSelecting();
            }
          : undefined
      }
    >
      {selecting ? (
        <Box
          role="toolbar"
          aria-label="Selected products"
          sx={(theme) => ({
            ...stickyBelowHeader(theme, "8px"),
            display: "flex",
            alignItems: "center",
            gap: 1,
            flexWrap: "wrap",
            pb: 1,
            bgcolor: "background.default",
            borderBottom: 1,
            borderColor: "divider",
          })}
        >
          <Typography role="status" sx={{ flex: phone ? "1 1 100%" : 1, minWidth: 0, fontWeight: 600 }}>
            {chosen.length === 0
              ? "Select products to change or delete"
              : `${chosen.length === 1 ? "1 selected" : `${chosen.length} selected`}${
                  hiddenChosen > 0 ? `, ${hiddenChosen} hidden by the search or filters` : ""
                }`}
          </Typography>
          <Button
            ref={selectAllButton}
            onClick={() => setSelected(allChosen ? new Set() : new Set([...selected, ...filtered.map((row) => row.productId)]))}
            disabled={filtered.length === 0}
            sx={{ minHeight: 44 }}
          >
            {allChosen ? "Select none" : "Select all"}
          </Button>
          <Button variant="outlined" onClick={() => setBulkStatus(true)} disabled={chosen.length === 0} sx={{ minHeight: 44 }}>
            Change status
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteOutlineOutlinedIcon />}
            onClick={askDelete}
            disabled={chosen.length === 0}
            sx={{ minHeight: 44 }}
          >
            Delete
          </Button>
          <Button color="inherit" onClick={stopSelecting} sx={{ minHeight: 44 }}>
            Cancel
          </Button>
        </Box>
      ) : (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          {/* On phones the count has its own line, so the buttons never squeeze it. */}
          <Typography sx={{ flex: phone ? "1 1 100%" : 1, minWidth: 0, color: "text.secondary" }}>
            {rows.length === 1 ? "1 product" : `${rows.length} products`}
            {counts.AUCTION > 0 ? ` · ${counts.AUCTION === 1 ? "1 auction" : `${counts.AUCTION} auctions`}` : ""}
            {counts.OUT_OF_STOCK > 0 ? ` · ${counts.OUT_OF_STOCK} out of stock` : ""}
          </Typography>
          {/* On phones: Add product across the row first, then Arrange and Select side by side. */}
          {rows.filter((row) => row.status !== "RETIRED").length > 1 && (
            <Button
              variant="outlined"
              startIcon={<SwapVertIcon />}
              onClick={() => setArranging(true)}
              sx={{ minHeight: 44, ...(phone && { flex: "1 1 0", order: 1 }) }}
            >
              Arrange
            </Button>
          )}
          {onDelete && rows.length > 0 && (
            <Button
              ref={selectButton}
              variant="outlined"
              startIcon={<ChecklistOutlinedIcon />}
              onClick={startSelecting}
              sx={{ minHeight: 44, ...(phone && { flex: "1 1 0", order: 1 }) }}
            >
              Select
            </Button>
          )}
          <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd} sx={{ minHeight: 44, ...(phone && { flex: "1 1 100%" }) }}>
            Add product
          </Button>
        </Box>
      )}

      {rows.length === 0 ? (
        <EmptyState
          title="No products yet"
          description="Add your first product. It waits in Ready to publish until you publish it to your shop."
          actionLabel="Add product"
          onAction={onAdd}
        />
      ) : (
        <>
          <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", flexWrap: phone ? "nowrap" : "wrap" }}>
            <TextField
              type="search"
              value={filters.query}
              onChange={(e) => update({ query: e.target.value })}
              placeholder="Search your products"
              slotProps={{
                htmlInput: { "aria-label": "Search your products" },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ flex: 1, minWidth: phone ? 0 : 240 }}
            />
            {phone ? (
              <IconButton aria-label="Category and sort" onClick={() => setSheetOpen(true)} sx={{ width: 56, height: 56 }}>
                <Badge color="primary" variant="dot" invisible={!filtersActive}>
                  <TuneOutlinedIcon />
                </Badge>
              </IconButton>
            ) : (
              <>
                {categorySelect}
                {sortSelect}
              </>
            )}
          </Box>

          <Box role="group" aria-label="Status" sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            {STATUS_CHIPS.filter((s) => s !== "AUCTION" || counts.AUCTION > 0 || filters.status === "AUCTION").map((s) => {
              const selected = filters.status === s;
              return (
                <Chip
                  key={s}
                  label={`${s === "all" ? "All" : STATUS_LABEL[s]} ${counts[s]}`}
                  onClick={() => update({ status: s })}
                  color={selected ? "primary" : "default"}
                  variant={selected ? "filled" : "outlined"}
                  aria-pressed={selected}
                  sx={{ height: { xs: 44, sm: 36 }, borderRadius: 999, fontWeight: selected ? 700 : 500 }}
                />
              );
            })}
          </Box>

          {filtered.length === 0 ? (
            <EmptyState
              title="No products match"
              description={
                filters.query && searchCatalogues.some((id) => loadOf(id) !== "ready")
                  ? "Some product details are still loading, so the search may find more in a moment."
                  : "Try another search or filter."
              }
              actionLabel="Clear filters"
              onAction={() => update({ query: "", status: "all", category: "" })}
            />
          ) : (
            <>
              {/* The columns sort the list: a click sorts by one, a second the other way. */}
              <Box
                role="group"
                aria-label="Sort by column"
                sx={{
                  display: { xs: "none", md: "grid" },
                  gridTemplateColumns: columns,
                  alignItems: "center",
                  gap: 2,
                  px: 1.5,
                }}
              >
                {places && <SortHeader column="order" sort={sort} onSort={sortBy} />}
                <span />
                <SortHeader column="title" sort={sort} onSort={sortBy} />
                <SortHeader column="price" sort={sort} onSort={sortBy} />
                <SortHeader column="status" sort={sort} onSort={sortBy} />
                <SortHeader column="added" sort={sort} onSort={sortBy} />
                <span />
              </Box>
              <Box component="ul" aria-label="Products" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                {visible.map((row, i) => {
                  // Shop order, first to last: a line with the collection's title where its products start.
                  const section = sort === "featured" && featured.sectionOf.size > 0 ? (featured.sectionOf.get(row.productId) ?? -1) : null;
                  const previous = section !== null && i > 0 ? (featured.sectionOf.get(visible[i - 1].productId) ?? -1) : null;
                  const starts = section !== null && section !== previous && (section >= 0 || i > 0);
                  const collection = section !== null && section >= 0 ? shopCollections[section] : undefined;
                  const sectionTitle = collection ? collection.title || "Collection" : "Not in a collection";
                  return [
                    starts && (
                      <SectionDivider
                        key={`section-${row.productId}`}
                        title={sectionTitle}
                        first={i === 0}
                        heading="h2"
                        action={
                          <Button
                            size="small"
                            startIcon={<SwapVertIcon />}
                            aria-label={collection ? `Arrange ${sectionTitle}` : "Arrange the products not in a collection"}
                            onClick={() => (collection ? setArrangingCollection(collection.id) : setArranging(true))}
                            sx={{ minHeight: 44, flexShrink: 0 }}
                          >
                            Arrange
                          </Button>
                        }
                      />
                    ),
                    <ProductRow
                      key={row.productId}
                      row={row}
                      stockLeft={stockLeftOf.get(row.productId)}
                      place={places ? (places.get(row.productId) ?? null) : undefined}
                      details={detailsOf(row)}
                      load={loadOf(row.catalogueId)}
                      edited={!!productsToSave[row.productId]}
                      opening={opening === row.productId}
                      onVisible={request}
                      onRetry={retry}
                      onMissing={refresh}
                      onEdit={edit}
                      selecting={selecting}
                      selected={selected.has(row.productId)}
                      onToggle={toggle}
                    />,
                  ];
                })}
              </Box>
              {filtered.length > shown && (
                <Button variant="outlined" onClick={() => setShown((n) => n + PRODUCTS_PAGE)} sx={{ alignSelf: "center", minHeight: 44 }}>
                  Show more ({filtered.length - shown} more)
                </Button>
              )}
              {isFiltered(filters) && (
                <Typography variant="body2" color="text.secondary" role="status">
                  {filtered.length === 1 ? "1 product matches" : `${filtered.length} products match`}
                </Typography>
              )}
            </>
          )}
        </>
      )}

      {phone && (
        <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Category and sort">
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            {categorySelect}
            {sortSelect}
            <Button variant="contained" onClick={() => setSheetOpen(false)} sx={{ minHeight: 44 }}>
              Done
            </Button>
          </Box>
        </BottomSheet>
      )}
      {collectionToArrange && (
        <ArrangeDialog
          key={collectionToArrange.id}
          title={`Arrange ${collectionToArrange.title || "this collection"}`}
          intro="Buyers see this collection's products in this order, on its page and in its part of the Collections sort. The new order waits with your other changes until you publish them."
          rows={collectionRows}
          doneLabel="Save order"
          onDone={(order) => {
            saveCollectionOrder(collectionToArrange, order);
            setArrangingCollection(null);
          }}
          onClose={() => setArrangingCollection(null)}
        />
      )}
      {arranging && <ArrangeShop collections={shopCollections} onClose={() => setArranging(false)} onPublished={() => setChosenSort(null)} />}
      {bulkStatus && (
        <BulkStatusDialog
          rows={chosen}
          onClose={() => setBulkStatus(false)}
          onDrafted={(count) => {
            setBulkStatus(false);
            stopSelecting();
            setBulkDrafted(count === 1 ? "1 product is ready to publish with its new status." : `${count} products are ready to publish with their new status.`);
          }}
        />
      )}
      <Snackbar open={!!bulkDrafted} autoHideDuration={6000} onClose={() => setBulkDrafted(null)} message={bulkDrafted ?? ""} />
    </Box>
  );
}

/** The list's columns on wider screens: the shop order (when there is one), the picture, product, price, status, added. */
function rowColumns(withOrder: boolean): string {
  return `${withOrder ? "96px " : ""}56px minmax(0, 1fr) 150px 130px 120px 24px`;
}

/** Up for the sorts that go from small to large (A–Z, low to high, first to last, oldest first). */
const SORT_UP: ReadonlySet<SellerSort> = new Set(["featured", "title", "price-asc", "status", "oldest"]);

/** How each sort reads after the column's name: "Price, low to high". */
const SORT_WAY: Record<SellerSort, string> = {
  featured: "first to last",
  "featured-desc": "last to first",
  newest: "newest first",
  oldest: "oldest first",
  "price-asc": "low to high",
  "price-desc": "high to low",
  title: "A to Z",
  "title-desc": "Z to A",
  status: "available first",
  "status-desc": "retired first",
};

function SortHeader({ column, sort, onSort }: { column: SortColumn; sort: SellerSort; onSort: (sort: SellerSort) => void }) {
  const { label } = SORT_COLUMNS[column];
  const on = sortColumnOf(sort)?.column === column;
  const next = sortForColumn(column, sort);
  const Arrow = SORT_UP.has(on ? sort : next) ? ArrowUpwardIcon : ArrowDownwardIcon;
  return (
    <ButtonBase
      onClick={() => onSort(next)}
      aria-label={on ? `${label}, ${SORT_WAY[sort]}: sort ${SORT_WAY[next]}` : `Sort by ${label.toLowerCase()}, ${SORT_WAY[next]}`}
      sx={{
        justifySelf: "start",
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        minHeight: 36,
        px: 0.5,
        mx: -0.5,
        borderRadius: 1,
        fontSize: 13,
        fontWeight: on ? 700 : 600,
        color: on ? "text.primary" : "text.secondary",
        whiteSpace: "nowrap",
        "& .qp-sort-arrow": { opacity: on ? 1 : 0, transition: "opacity 150ms ease" },
        "&:hover": { color: "text.primary", "& .qp-sort-arrow": { opacity: on ? 1 : 0.5 } },
        "&.Mui-focusVisible": { outline: 2, outlineStyle: "solid", outlineColor: "primary.main" },
      }}
    >
      {label}
      <Arrow className="qp-sort-arrow" sx={{ fontSize: 16 }} aria-hidden />
    </ButtonBase>
  );
}

interface ProductRowProps {
  row: SellerRow;
  /** Its place in the shop's order (null: not listed there, retired); undefined: no order column. */
  place?: number | null;
  details: Record<string, any> | undefined;
  load: CatalogueLoad;
  edited: boolean;
  opening: boolean;
  onVisible: (catalogueIds: string[]) => void;
  onRetry: (catalogueId: string) => void;
  /** The catalogue is loaded but lacks this product: read it again (once). */
  onMissing: (catalogueId: string) => void;
  onEdit: (row: SellerRow) => void;
  /** Select mode: a tap selects the product instead of opening it. */
  selecting?: boolean;
  selected?: boolean;
  onToggle?: (row: SellerRow) => void;
  /** Units left of a counted product (stock/model.ts), once read. */
  stockLeft?: number;
}

const ProductRow = memo(function ProductRow({
  row,
  stockLeft,
  place,
  details,
  load,
  edited,
  opening,
  onVisible,
  onRetry,
  onMissing,
  onEdit,
  selecting = false,
  selected = false,
  onToggle,
}: ProductRowProps) {
  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: "200px 0px", fallbackInView: true });
  useEffect(() => {
    if (inView) onVisible([row.catalogueId]);
  }, [inView, row.catalogueId, onVisible]);

  // In its index, not in its catalogue (once that has been read again).
  const missing = load === "ready" && !details;
  useEffect(() => {
    if (inView && missing) onMissing(row.catalogueId);
  }, [inView, missing, row.catalogueId, onMissing]);

  const title = typeof details?.title === "string" && details.title ? details.title : null;
  const sale = details ? saleOf(details as Parameters<typeof saleOf>[0])?.percent : rowSaleOf(row as { sale?: unknown });
  const images: unknown[] = Array.isArray(details?.images) ? details.images : [];
  const mainIndex = typeof details?.mainImageIndex === "number" ? details.mainImageIndex : 0;
  const image = (images[mainIndex] ?? images[0]) as string | undefined;
  const created = row.created ? dateFormat.format(new Date(row.created)) : "";

  return (
    <Box component="li" ref={ref} sx={{ display: "flex", alignItems: "stretch", gap: 1 }}>
      <ButtonBase
        onClick={() => (selecting ? onToggle?.(row) : onEdit(row))}
        role={selecting ? "checkbox" : undefined}
        aria-checked={selecting ? selected : undefined}
        aria-busy={opening || undefined}
        sx={{
          flex: 1,
          minWidth: 0,
          display: "grid",
          gridTemplateColumns: { xs: "56px minmax(0, 1fr) 24px", md: rowColumns(place !== undefined) },
          alignItems: "center",
          gap: { xs: 1.5, md: 2 },
          p: 1.5,
          minHeight: 72,
          textAlign: "left",
          borderRadius: 1,
          border: 1,
          borderColor: selected ? "primary.main" : "divider",
          bgcolor: selected ? "action.selected" : "background.paper",
          transition: "background-color 150ms ease",
          "&:hover": { bgcolor: "action.hover" },
          "&.Mui-focusVisible": { outline: 2, outlineStyle: "solid", outlineColor: "primary.main", outlineOffset: 2 },
        }}
      >
        {/*
          The row is named by what it shows (its title, status, price, category, date), after a
          word for what a tap does: WCAG 2.5.3 wants the visible text in the name, and the
          columns differ by width.
        */}
        <Box component="span" sx={visuallyHiddenSx}>
          {selecting ? "Select" : "Edit"}
        </Box>
        {place !== undefined && (
          <Typography component="span" sx={{ display: { xs: "none", md: "block" }, fontWeight: 700, color: place ? "text.primary" : "text.secondary" }}>
            {place ? <>{place}<Box component="span" sx={visuallyHiddenSx}> in shop order</Box></> : "–"}
          </Typography>
        )}
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: 1,
            overflow: "hidden",
            bgcolor: "action.hover",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "text.secondary",
          }}
        >
          {image ? (
            <ProductImage src={image} alt="" />
          ) : load === "loading" || load === "idle" ? (
            <Skeleton variant="rectangular" width={56} height={56} />
          ) : (
            <ImageOutlinedIcon />
          )}
        </Box>
        <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 0.5 }}>
          {title ? (
            <Typography sx={{ fontWeight: 600, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflowWrap: "anywhere" }}>
              {title}
            </Typography>
          ) : load === "peers" ? (
            <Typography color="text.secondary">Fetching from peers…</Typography>
          ) : load === "failed" ? (
            <Typography color="text.secondary">Not available on your node right now</Typography>
          ) : missing ? (
            <Typography color="text.secondary">Missing from its catalogue: open it to add its details again</Typography>
          ) : details ? (
            <Typography color="text.secondary">Untitled product</Typography>
          ) : (
            <Skeleton width="60%" />
          )}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", color: "text.secondary", fontSize: 14 }}>
            <Box sx={{ display: { xs: "contents", md: "none" } }}>
              <StatusChip status={row.status} auction={row.auction} left={stockLeft} />
              <AmountTag value={row.priceQort} coin="QORT" size="small" />
            </Box>
            {row.category && (
              <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
                <CategoryIcon category={row.category} size={20} />
                {row.category}
              </Box>
            )}
            <AuctionTimes row={row} />
            {/* On sale (sale/compareAt.ts): what buyers save, from the product or its row. */}
            {sale && <Chip size="small" color="error" label={`${sale}% off`} sx={{ fontWeight: 700 }} />}
            {edited && (
              <Chip size="small" variant="outlined" label="Edited, not published" sx={{ color: "text.primary", borderColor: "info.main" }} />
            )}
            {opening && <span role="status">Opening…</span>}
          </Box>
        </Box>
        <Box sx={{ display: { xs: "none", md: "block" } }}>
          <AmountTag value={row.priceQort} coin="QORT" size="small" />
        </Box>
        <Box sx={{ display: { xs: "none", md: "block" } }}>
          <StatusChip status={row.status} auction={row.auction} left={stockLeft} />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", md: "block" } }}>
          {created}
        </Typography>
        {!selecting ? (
          <ChevronRightIcon sx={{ color: "text.secondary" }} />
        ) : selected ? (
          <CheckBoxIcon color="primary" />
        ) : (
          <CheckBoxOutlineBlankIcon sx={{ color: "text.secondary" }} />
        )}
      </ButtonBase>
      {load === "failed" && (
        <Button variant="outlined" onClick={() => onRetry(row.catalogueId)} sx={{ minHeight: 44, alignSelf: "center" }}>
          Retry
        </Button>
      )}
    </Box>
  );
});
