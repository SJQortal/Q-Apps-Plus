/**
 * Running low, on the seller's Overview: the counted products (stock/) with 3
 * or fewer left, and the sold-out ones, fewest first, each a tap from its
 * editor, so the seller restocks (types the count again) before buyers find
 * them gone. Nothing for a shop that counts no stock.
 */
import { useEffect, useId, useMemo } from "react";
import { useSelector } from "react-redux";
import { Box, ButtonBase, Skeleton, Typography } from "@mui/material";
import ChevronRightOutlinedIcon from "@mui/icons-material/ChevronRightOutlined";
import type { RootState } from "../state/store";
import { shortStoreIdOf } from "../qdn/identifiers";
import { stockOf } from "../stock/model";
import { useStockLeft } from "../stock/notes";
import { useCatalogueLoader } from "./useCatalogueLoader";
import { productForEdit } from "./productDraft";
import type { SellerRow } from "./productList";

export const LOW_STOCK = 3;
const SHOWN = 6;

export function LowStock({ storeId, onEdit }: { storeId: string; onEdit?: (product: Record<string, any> & { id: string }) => void }) {
  const headingId = useId();
  const name = useSelector((state: RootState) => state.auth.user?.name ?? "");
  const owner = useSelector((state: RootState) => state.global.currentStore?.owner || name);
  const rows = useSelector((state: RootState) => state.global.listProducts.products) as SellerRow[];
  const counted = useMemo(() => rows.filter((row) => row.status !== "RETIRED" && !row.auction && stockOf(row)), [rows]);
  const { left } = useStockLeft(counted.map((row) => ({ shortStoreId: shortStoreIdOf(storeId), productId: row.productId, stock: stockOf(row)! })));
  const low = counted
    .map((row) => ({ row, units: left.get(row.productId) }))
    .filter((x): x is { row: SellerRow; units: number } => x.units !== undefined && x.units <= LOW_STOCK)
    .sort((a, b) => a.units - b.units)
    .slice(0, SHOWN);
  const { request, productOf } = useCatalogueLoader(owner);
  const catalogues = [...new Set(low.map((x) => x.row.catalogueId))].join("|");
  useEffect(() => {
    if (catalogues) request(catalogues.split("|"));
  }, [catalogues, request]);
  if (low.length === 0) return null;
  return (
    <Box component="section" aria-labelledby={headingId}>
      <Typography id={headingId} component="h2" sx={{ fontSize: 18, fontWeight: 700, mb: 1.5 }}>
        Running low
      </Typography>
      <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, border: 1, borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
        {low.map(({ row, units }, i) => {
          const details = productOf(row.catalogueId, row.productId) as Record<string, unknown> | undefined;
          const title = typeof details?.title === "string" && details.title.trim() ? details.title.trim() : null;
          const label = units <= 0 ? "Sold out" : units === 1 ? "1 left" : `${units} left`;
          return (
            <Box component="li" key={row.productId} sx={{ borderTop: i === 0 ? 0 : 1, borderColor: "divider" }}>
              <ButtonBase
                onClick={() => details && onEdit?.(productForEdit(row, details))}
                disabled={!details || !onEdit}
                aria-label={`${title ?? "Product"}: ${label}. Edit it`}
                sx={{ width: "100%", minHeight: 52, px: 2, py: 1, display: "flex", alignItems: "center", gap: 1.5, justifyContent: "flex-start", textAlign: "left", "&:hover": { bgcolor: "action.hover" } }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>{title ? <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{title}</Typography> : <Skeleton width="50%" />}</Box>
                <Typography sx={{ fontWeight: 700, color: units <= 0 ? "error.main" : "warning.main", flexShrink: 0 }}>{label}</Typography>
                {onEdit && <ChevronRightOutlinedIcon aria-hidden sx={{ color: "text.secondary" }} />}
              </ButtonBase>
            </Box>
          );
        })}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Restock by typing the count again in the product.
      </Typography>
    </Box>
  );
}
