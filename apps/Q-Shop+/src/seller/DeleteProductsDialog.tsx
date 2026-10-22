/**
 * Asks before deleting products, then sends the delete: useDeleteProducts
 * builds it (the product list first, then the catalogues that held them)
 * and PublishProductsDialog sends it, in batches past 20. It names what goes
 * (up to six titles), says what stays (orders keep their own copy), and
 * points to Retired for taking a product off sale without deleting it.
 */
import { useState } from "react";
import { useSelector } from "react-redux";
import { Alert, Box, Button, CircularProgress, Typography } from "@mui/material";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import type { RootState } from "../state/store";
import { ResponsiveDialog } from "../components/common/mobile";
import { FormError } from "./FormError";
import { PublishProductsDialog } from "./PublishProductsDialog";
import { useDeleteProducts } from "./useDeleteProducts";

/** How many titles the question lists before "and N more". */
export const LISTED_TITLES = 6;

export interface ProductToDelete {
  id: string;
  title: string;
}

export interface DeleteProductsDialogProps {
  products: ProductToDelete[];
  onClose: () => void;
  /** Everything was deleted. */
  onDeleted?: () => void;
}

export function DeleteProductsDialog({ products, onClose, onDeleted }: DeleteProductsDialogProps) {
  const publicKey = useSelector((state: RootState) => state.auth.user?.publicKey);
  const del = useDeleteProducts();
  const [sending, setSending] = useState(false);
  const n = products.length;
  const shown = products.slice(0, LISTED_TITLES);

  const run = async () => {
    if (await del.prepare(products.map((p) => p.id))) setSending(true);
  };

  if (sending && del.job) {
    return (
      <PublishProductsDialog
        open
        resources={del.job.resources}
        labels={del.job.labels}
        publicKey={publicKey}
        order="given"
        verb="delete"
        settledNote="The products leave your shop once your product list is sent."
        onDone={() => {
          del.done();
          onDeleted?.();
          onClose();
        }}
        onClose={(sent) => {
          del.closed(sent);
          onClose();
        }}
      />
    );
  }

  const working = del.preparing;
  return (
    <ResponsiveDialog
      open
      onClose={working ? () => {} : onClose}
      title={n === 1 ? "Delete this product?" : `Delete ${n} products?`}
      maxWidth="xs"
      dismissible={!working}
      busy={working}
      actions={
        <>
          <Button color="inherit" onClick={onClose} disabled={working}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => void run()}
            disabled={working || n === 0}
            startIcon={working ? <CircularProgress size={18} color="inherit" /> : <DeleteOutlineOutlinedIcon />}
          >
            {n === 1 ? "Delete product" : `Delete ${n} products`}
          </Button>
        </>
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Typography>
          {n === 1 ? "It leaves your shop" : "They leave your shop"}: buyers can no longer find, open or order{" "}
          {n === 1 ? "it" : "them"}, here or in Q-Shop.
        </Typography>
        <Box component="ul" aria-label={n === 1 ? "Product to delete" : "Products to delete"} sx={{ m: 0, pl: 2.5, display: "flex", flexDirection: "column", gap: 0.5 }}>
          {shown.map((p) => (
            <Typography component="li" key={p.id} sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
              {p.title}
            </Typography>
          ))}
          {n > shown.length && (
            <Typography component="li" color="text.secondary">
              and {n - shown.length} more
            </Typography>
          )}
        </Box>
        <Typography variant="body2" color="text.secondary">
          Orders that include {n === 1 ? "it" : "them"} keep their own copy. To take a product off sale without deleting it, set
          it to Retired instead.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Hub asks you to confirm the change to your product list, with a small fee.
        </Typography>
        {del.notice && <Alert severity="info">{del.notice}</Alert>}
        <FormError message={del.error} />
      </Box>
    </ResponsiveDialog>
  );
}
