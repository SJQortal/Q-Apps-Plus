/**
 * The seller's Products tab: every product in the shop's index as cards on
 * phones and aligned rows on wider screens, with search, status chips with
 * counts, a category filter and a sort. Status, QORT price and category come
 * from the index at once; titles and images come from the catalogues, loaded
 * only for the products on screen (useCatalogueLoader). Tapping a product
 * opens its edit form.
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";
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
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useInView } from "react-intersection-observer";
import type { RootState } from "../state/store";
import { AmountTag } from "../components/money/PriceTag";
import { EmptyState } from "../components/common/EmptyState";
import { BottomSheet } from "../components/common/mobile";
import { usePhoneLayout } from "../hooks/usePhoneLayout";
import { STATUS_LABEL, productForEdit } from "./productDraft";
import {
  DEFAULT_FILTERS,
  SORT_LABEL,
  filterSellerProducts,
  isFiltered,
  needsDetails,
  statusCounts,
  statusOf,
  type SellerFilters,
  type SellerRow,
  type SellerSort,
  type StatusFilter,
} from "./productList";
import { useCatalogueLoader, type CatalogueLoad } from "./useCatalogueLoader";

export const PRODUCTS_PAGE = 24;

const STATUS_CHIPS: StatusFilter[] = ["all", "AVAILABLE", "OUT_OF_STOCK", "RETIRED"];
const STATUS_COLOR: Record<string, "success" | "warning" | "default"> = {
  AVAILABLE: "success",
  OUT_OF_STOCK: "warning",
  RETIRED: "default",
};

const dateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });

export function StatusChip({ status }: { status: string }) {
  const s = statusOf({ status });
  return <Chip size="small" variant="outlined" color={STATUS_COLOR[s]} label={STATUS_LABEL[s]} sx={{ fontWeight: 600 }} />;
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
}

export function ProductsTab({ onAdd, onEdit, ready, loading = false }: ProductsTabProps) {
  const phone = usePhoneLayout();
  const owner = useSelector((state: RootState) => state.global.currentStore?.owner || state.auth.user?.name);
  const rows = useSelector((state: RootState) => state.global.listProducts.products) as SellerRow[];
  const categories = useSelector((state: RootState) => state.global.listProducts.categories);
  const productsToSave = useSelector((state: RootState) => state.global.productsToSave);
  const { request, retry, statusOf: loadOf, productOf } = useCatalogueLoader(owner);

  const [filters, setFilters] = useState<SellerFilters>(DEFAULT_FILTERS);
  const [shown, setShown] = useState(PRODUCTS_PAGE);
  const [sheetOpen, setSheetOpen] = useState(false);
  // The product the seller tapped before its catalogue had loaded; its form opens once it lands.
  const [pendingEdit, setPendingEdit] = useState<string | null>(null);
  const openedFor = useRef<string | null>(null);

  const detailsOf = (row: SellerRow) => productOf(row.catalogueId, row.productId);
  const filtered = filterSellerProducts(rows, filters, detailsOf);
  const counts = useMemo(() => statusCounts(rows), [rows]);
  const visible = filtered.slice(0, shown);
  const sortedCategories = useMemo(() => [...categories].sort((a, b) => a.localeCompare(b)), [categories]);

  // A search (or a sort by title) needs every product's title: load the
  // catalogues of the products the other filters leave, 5 at a time.
  const searchCatalogues = needsDetails(filters)
    ? [...new Set(filterSellerProducts(rows, { ...filters, query: "", sort: "newest" }, detailsOf).map((r) => r.catalogueId))]
    : [];
  const searchKey = searchCatalogues.join("|");
  useEffect(() => {
    if (searchKey) request(searchKey.split("|"));
  }, [searchKey, request]);

  const edit = (row: SellerRow) => {
    const draft = productsToSave[row.productId];
    if (draft) return onEdit(draft as unknown as Record<string, any> & { id: string });
    const details = productOf(row.catalogueId, row.productId);
    if (details) return onEdit(productForEdit(row, details));
    openedFor.current = null;
    setPendingEdit(row.productId);
    if (loadOf(row.catalogueId) === "failed") retry(row.catalogueId);
    else request([row.catalogueId]);
  };

  // Open the form once the catalogue of the product the seller tapped lands.
  const pendingRow = pendingEdit ? rows.find((r) => r.productId === pendingEdit) : undefined;
  const pendingDetails = pendingRow ? productOf(pendingRow.catalogueId, pendingRow.productId) : undefined;
  const pendingLoad = pendingRow ? loadOf(pendingRow.catalogueId) : "idle";
  const opening = pendingRow && !pendingDetails && pendingLoad !== "failed" ? pendingRow.productId : null;
  useEffect(() => {
    if (!pendingRow || !pendingDetails || openedFor.current === pendingRow.productId) return;
    openedFor.current = pendingRow.productId;
    onEdit(productForEdit(pendingRow, pendingDetails));
  }, [pendingRow, pendingDetails, onEdit]);

  const update = (patch: Partial<SellerFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setShown(PRODUCTS_PAGE);
  };
  const filtersActive = filters.category !== "" || filters.sort !== "newest";

  const categorySelect = (
    <TextField
      select
      label="Category"
      value={filters.category}
      onChange={(e) => update({ category: e.target.value })}
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
      value={filters.sort}
      onChange={(e) => update({ sort: e.target.value as SellerSort })}
      sx={{ minWidth: 190 }}
      fullWidth={phone}
    >
      {(Object.keys(SORT_LABEL) as SellerSort[]).map((s) => (
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
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Typography sx={{ flex: 1, minWidth: 0, color: "text.secondary" }}>
          {rows.length === 1 ? "1 product" : `${rows.length} products`}
          {counts.OUT_OF_STOCK > 0 ? ` · ${counts.OUT_OF_STOCK} out of stock` : ""}
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd} sx={{ minHeight: 44 }}>
          Add product
        </Button>
      </Box>

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
            {STATUS_CHIPS.map((s) => {
              const selected = filters.status === s;
              return (
                <Chip
                  key={s}
                  label={`${s === "all" ? "All" : STATUS_LABEL[s]} ${counts[s]}`}
                  onClick={() => update({ status: s })}
                  color={selected ? "primary" : "default"}
                  variant={selected ? "filled" : "outlined"}
                  aria-pressed={selected}
                  sx={{ minHeight: 36, fontWeight: selected ? 700 : 500 }}
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
              <Box
                aria-hidden
                sx={{
                  display: { xs: "none", md: "grid" },
                  gridTemplateColumns: ROW_COLUMNS_MD,
                  gap: 2,
                  px: 1.5,
                  color: "text.secondary",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <span />
                <span>Product</span>
                <span>Price</span>
                <span>Status</span>
                <span>Added</span>
                <span />
              </Box>
              <Box component="ul" aria-label="Products" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                {visible.map((row) => (
                  <ProductRow
                    key={row.productId}
                    row={row}
                    details={detailsOf(row)}
                    load={loadOf(row.catalogueId)}
                    edited={!!productsToSave[row.productId]}
                    opening={opening === row.productId}
                    onVisible={request}
                    onRetry={retry}
                    onEdit={edit}
                  />
                ))}
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
    </Box>
  );
}

const ROW_COLUMNS_MD = "56px minmax(0, 1fr) 150px 130px 120px 24px";

interface ProductRowProps {
  row: SellerRow;
  details: Record<string, any> | undefined;
  load: CatalogueLoad;
  edited: boolean;
  opening: boolean;
  onVisible: (catalogueIds: string[]) => void;
  onRetry: (catalogueId: string) => void;
  onEdit: (row: SellerRow) => void;
}

const ProductRow = memo(function ProductRow({ row, details, load, edited, opening, onVisible, onRetry, onEdit }: ProductRowProps) {
  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: "200px 0px", fallbackInView: true });
  useEffect(() => {
    if (inView) onVisible([row.catalogueId]);
  }, [inView, row.catalogueId, onVisible]);

  const title = typeof details?.title === "string" && details.title ? details.title : null;
  const images: unknown[] = Array.isArray(details?.images) ? details.images : [];
  const mainIndex = typeof details?.mainImageIndex === "number" ? details.mainImageIndex : 0;
  const image = (images[mainIndex] ?? images[0]) as string | undefined;
  const created = row.created ? dateFormat.format(new Date(row.created)) : "";

  return (
    <Box component="li" ref={ref} sx={{ display: "flex", alignItems: "stretch", gap: 1 }}>
      <ButtonBase
        onClick={() => onEdit(row)}
        aria-label={title ? `Edit ${title}` : "Edit product"}
        aria-busy={opening || undefined}
        sx={{
          flex: 1,
          minWidth: 0,
          display: "grid",
          gridTemplateColumns: { xs: "56px minmax(0, 1fr) 24px", md: ROW_COLUMNS_MD },
          alignItems: "center",
          gap: { xs: 1.5, md: 2 },
          p: 1.5,
          minHeight: 72,
          textAlign: "left",
          borderRadius: 1,
          border: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          transition: "background-color 150ms ease",
          "&:hover": { bgcolor: "action.hover" },
          "&.Mui-focusVisible": { outline: 2, outlineStyle: "solid", outlineColor: "primary.main", outlineOffset: 2 },
        }}
      >
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
            <Box component="img" src={image} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
          ) : (
            <Skeleton width="60%" />
          )}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", color: "text.secondary", fontSize: 14 }}>
            <Box sx={{ display: { xs: "contents", md: "none" } }}>
              <StatusChip status={row.status} />
              <AmountTag value={row.priceQort} coin="QORT" size="small" />
            </Box>
            {row.category && <span>{row.category}</span>}
            {edited && <Chip size="small" color="info" variant="outlined" label="Edited, not published" />}
            {opening && <span role="status">Opening…</span>}
          </Box>
        </Box>
        <Box sx={{ display: { xs: "none", md: "block" } }}>
          <AmountTag value={row.priceQort} coin="QORT" size="small" />
        </Box>
        <Box sx={{ display: { xs: "none", md: "block" } }}>
          <StatusChip status={row.status} />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", md: "block" } }}>
          {created}
        </Typography>
        <ChevronRightIcon sx={{ color: "text.secondary" }} />
      </ButtonBase>
      {load === "failed" && (
        <Button variant="outlined" onClick={() => onRetry(row.catalogueId)} sx={{ minHeight: 44, alignSelf: "center" }}>
          Retry
        </Button>
      )}
    </Box>
  );
});
