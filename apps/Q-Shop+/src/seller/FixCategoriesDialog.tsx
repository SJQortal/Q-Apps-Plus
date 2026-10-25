/**
 * Fix categories (the shop checkup, seller/checkup.ts): every listed product
 * whose category isn't one of the list (constants/categories.ts), with the
 * category its title suggests (utils/categoryMatch.ts) already picked. Add
 * to drafts puts each changed product in Ready to publish, edited in its
 * category only (its pictures, prices and the rest as published), so the
 * seller publishes them together from the Products tab.
 */
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Box, Button, MenuItem, Skeleton, TextField, Typography } from "@mui/material";
import type { RootState } from "../state/store";
import { setProductsToSave } from "../state/features/globalSlice";
import { ResponsiveDialog } from "../components/common/mobile";
import { CategoryIcon } from "../components/CategoryIcon";
import { ProductImage } from "../components/common/ProductImage";
import { selectMenuProps } from "../components/common/menuStyle";
import { SHOP_CATEGORIES } from "../constants/categories";
import { suggestCategory } from "../utils/categoryMatch";
import { productForEdit } from "./productDraft";
import { useCatalogueLoader } from "./useCatalogueLoader";
import type { SellerRow } from "./productList";

function titleOf(details: Record<string, unknown> | undefined): string {
  return typeof details?.title === "string" ? details.title.trim() : "";
}

function pictureOf(details: Record<string, unknown> | undefined): string | undefined {
  const images = Array.isArray(details?.images) ? (details.images as unknown[]) : [];
  return typeof images[0] === "string" ? images[0] : undefined;
}

export function FixCategoriesDialog({ rows, onClose, onDrafted }: { rows: SellerRow[]; onClose: () => void; onDrafted: (count: number) => void }) {
  const dispatch = useDispatch();
  const name = useSelector((state: RootState) => state.auth.user?.name ?? "");
  const owner = useSelector((state: RootState) => state.global.currentStore?.owner || name);
  const { request, productOf, statusOf } = useCatalogueLoader(owner);
  const catalogues = [...new Set(rows.map((r) => r.catalogueId))].join("|");
  useEffect(() => {
    if (catalogues) request(catalogues.split("|"));
  }, [catalogues, request]);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const detailsOf = (row: SellerRow) => productOf(row.catalogueId, row.productId) as Record<string, unknown> | undefined;
  // The title's suggestion until the seller picks one.
  const choiceOf = (row: SellerRow) => picked[row.productId] ?? suggestCategory(titleOf(detailsOf(row))) ?? "";
  const ready = rows.filter((row) => detailsOf(row) && choiceOf(row));
  const loading = rows.some((row) => !detailsOf(row) && statusOf(row.catalogueId) !== "failed");
  const sorted = useMemo(() => [...rows].sort((a, b) => (a.category ?? "").localeCompare(b.category ?? "")), [rows]);

  const draft = () => {
    let count = 0;
    for (const row of ready) {
      const details = detailsOf(row);
      if (!details) continue;
      const category = choiceOf(row);
      dispatch(setProductsToSave({ ...productForEdit(row, details), category, isUpdate: true, user: name }));
      count++;
    }
    onDrafted(count);
  };

  return (
    <ResponsiveDialog
      open
      onClose={onClose}
      title="Fix categories"
      maxWidth="md"
      actions={
        <>
          <Button color="inherit" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="contained" onClick={draft} disabled={ready.length === 0}>
            {ready.length === 1 ? "Add 1 to drafts" : `Add ${ready.length} to drafts`}
          </Button>
        </>
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Q-Shop+ shops share one list of categories, so buyers can find the same kind of product in every shop. Each product below has its own
          words from before; the one its title suggests is picked. Check them, then add them to your drafts and publish them together on the
          Products tab.
        </Typography>
        <Box component="ul" aria-label="Products to recategorize" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1 }}>
          {sorted.map((row) => {
            const details = detailsOf(row);
            const title = titleOf(details);
            const pic = pictureOf(details);
            return (
              <Box
                component="li"
                key={row.productId}
                sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1.5, p: 1, border: 1, borderColor: "divider", borderRadius: 1.5 }}
              >
                <Box sx={{ width: 44, height: 44, borderRadius: 1, overflow: "hidden", bgcolor: "action.hover", flexShrink: 0 }}>{pic && <ProductImage src={pic} alt="" />}</Box>
                <Box sx={{ flex: "1 1 180px", minWidth: 0 }}>
                  {details ? (
                    <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{title || "Untitled product"}</Typography>
                  ) : statusOf(row.catalogueId) === "failed" ? (
                    <Typography color="text.secondary">Not available on your node right now</Typography>
                  ) : (
                    <Skeleton width="60%" />
                  )}
                  <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                    Now: {row.category?.trim() || "none"}
                  </Typography>
                </Box>
                <TextField
                  select
                  size="small"
                  label="Category"
                  value={choiceOf(row)}
                  onChange={(e) => setPicked((prev) => ({ ...prev, [row.productId]: e.target.value }))}
                  disabled={!details}
                  slotProps={{ select: { MenuProps: selectMenuProps, displayEmpty: true }, inputLabel: { shrink: true }, htmlInput: { "aria-label": `Category of ${title || row.productId}` } }}
                  sx={{ flex: "1 1 220px", minWidth: 200, "& .MuiInputBase-root": { minHeight: 44 } }}
                >
                  <MenuItem value="" disabled>
                    Pick one
                  </MenuItem>
                  {SHOP_CATEGORIES.map((category) => (
                    <MenuItem key={category} value={category} sx={{ gap: 1 }}>
                      <CategoryIcon category={category} size={20} />
                      {category}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
            );
          })}
        </Box>
        {loading && (
          <Typography variant="body2" color="text.secondary" role="status">
            Reading your products…
          </Typography>
        )}
      </Box>
    </ResponsiveDialog>
  );
}
