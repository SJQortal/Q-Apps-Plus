/**
 * Change the status of several products at once (the Products tab's Select):
 * Available, Out of stock or Retired (hidden from buyers). Each changed
 * product waits in Ready to publish, edited in its status only (its
 * catalogue read first, as Fix categories does), so the seller publishes
 * them together. Auctions keep theirs: an auction is stored out of stock for
 * the original app, and its own panel ends or retires it.
 */
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Box, Button, FormControlLabel, Radio, RadioGroup, Typography } from "@mui/material";
import type { RootState } from "../state/store";
import { setProductsToSave } from "../state/features/globalSlice";
import { ResponsiveDialog } from "../components/common/mobile";
import { PRODUCT_STATUSES, STATUS_LABEL, editBase, type ProductStatus } from "./productDraft";
import { useCatalogueLoader } from "./useCatalogueLoader";
import type { SellerRow } from "./productList";

const HINT: Record<ProductStatus, string> = {
  AVAILABLE: "For sale again.",
  OUT_OF_STOCK: "Still shown, can't be bought.",
  RETIRED: "Hidden from buyers; orders and links keep working.",
};

export function BulkStatusDialog({ rows, onClose, onDrafted }: { rows: SellerRow[]; onClose: () => void; onDrafted: (count: number) => void }) {
  const dispatch = useDispatch();
  const name = useSelector((state: RootState) => state.auth.user?.name ?? "");
  // Products with edits waiting in Ready to publish start from those, not the published copy.
  const drafts = useSelector((state: RootState) => state.global.productsToSave) as Record<string, unknown>;
  const owner = useSelector((state: RootState) => state.global.currentStore?.owner || name);
  const { request, productOf, statusOf } = useCatalogueLoader(owner);
  const [status, setStatus] = useState<ProductStatus>("OUT_OF_STOCK");
  const changeable = rows.filter((row) => !row.auction);
  const catalogues = [...new Set(changeable.map((r) => r.catalogueId))].join("|");
  useEffect(() => {
    if (catalogues) request(catalogues.split("|"));
  }, [catalogues, request]);
  const baseOf = (row: SellerRow) => editBase(row, productOf(row.catalogueId, row.productId) as Record<string, unknown> | undefined, drafts);
  const ready = changeable.filter((row) => {
    const base = baseOf(row);
    return base && base.status !== status;
  });
  const loading = changeable.some((row) => !baseOf(row) && statusOf(row.catalogueId) !== "failed");
  const unreadable = changeable.filter((row) => !baseOf(row) && statusOf(row.catalogueId) === "failed").length;
  const auctions = rows.length - changeable.length;

  const draft = () => {
    for (const row of ready) {
      const base = baseOf(row);
      if (base) dispatch(setProductsToSave({ ...base, status, isUpdate: true, user: name }));
    }
    onDrafted(ready.length);
  };

  return (
    <ResponsiveDialog
      open
      onClose={onClose}
      title={rows.length === 1 ? "Change 1 product's status" : `Change ${rows.length} products' status`}
      maxWidth="xs"
      actions={
        <>
          <Button color="inherit" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="contained" onClick={draft} disabled={loading || ready.length === 0}>
            {loading ? "Reading your products…" : ready.length === 1 ? "Add 1 to drafts" : `Add ${ready.length} to drafts`}
          </Button>
        </>
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <RadioGroup aria-label="New status" value={status} onChange={(e) => setStatus(e.target.value as ProductStatus)}>
          {PRODUCT_STATUSES.map((s) => (
            <FormControlLabel
              key={s}
              value={s}
              control={<Radio />}
              label={
                <Box>
                  <Typography sx={{ fontWeight: 600 }}>{STATUS_LABEL[s]}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {HINT[s]}
                  </Typography>
                </Box>
              }
              sx={{ alignItems: "flex-start", py: 0.5, mr: 0, "& .MuiRadio-root": { mt: -0.5 } }}
            />
          ))}
        </RadioGroup>
        {!loading && changeable.length > 0 && ready.length === 0 && unreadable === 0 && (
          <Typography variant="body2" color="text.secondary">
            {changeable.length === 1 ? "It's" : "They're all"} {STATUS_LABEL[status].toLowerCase()} already.
          </Typography>
        )}
        {auctions > 0 && (
          <Typography variant="body2" color="text.secondary">
            {auctions === 1 ? "1 auction keeps its status" : `${auctions} auctions keep theirs`}: its own panel ends or retires it.
          </Typography>
        )}
        {unreadable > 0 && (
          <Typography variant="body2" color="text.secondary">
            {unreadable === 1 ? "1 product isn't" : `${unreadable} products aren't`} on your node right now and stay as they are.
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary">
          They wait in Ready to publish, so you publish them together.
        </Typography>
      </Box>
    </ResponsiveDialog>
  );
}
