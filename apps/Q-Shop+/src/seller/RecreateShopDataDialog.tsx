/**
 * The original's "Recreate shop data" (Edit shop → Advanced): publishes a
 * new, empty product index, which hides every product of the shop. A last
 * resort, so the seller types the shop's id to confirm. The same publish
 * creates a product list for a shop that has none on QDN (`missing`), with a
 * plainer confirmation, since there is nothing to hide.
 */
import { useState } from "react";
import { useSelector } from "react-redux";
import { Alert, Box, Button, CircularProgress, TextField, Typography } from "@mui/material";
import type { RootState } from "../state/store";
import { ResponsiveDialog } from "../components/common/mobile";
import { ShopFormError, useShopPublish } from "../hooks/useShopPublish";
import { shortStoreIdOf } from "../qdn/identifiers";
import { FormError } from "./FormError";

interface RecreateShopDataDialogProps {
  open: boolean;
  onClose: () => void;
  /** "recreate": the advanced setting (hides every product); "missing": the shop has no product list on QDN. */
  mode?: "recreate" | "missing";
}

export function RecreateShopDataDialog({ open, onClose, mode = "recreate" }: RecreateShopDataDialogProps) {
  const currentStore = useSelector((state: RootState) => state.global.currentStore);
  const { recreateProductList } = useShopPublish();
  const [typed, setTyped] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shortId = currentStore?.shortStoreId || (currentStore?.id ? shortStoreIdOf(currentStore.id) : "");
  const confirmed = mode === "missing" || (shortId !== "" && typed.trim() === shortId);

  const run = async () => {
    setError(null);
    setWorking(true);
    try {
      if (await recreateProductList()) onClose();
    } catch (e) {
      setError(e instanceof ShopFormError ? e.message : "Couldn't publish the product list. Please try again.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onClose={working ? () => {} : onClose}
      title={mode === "missing" ? "Create product list" : "Recreate shop data"}
      maxWidth="xs"
      dismissible={!working}
      actions={
        <>
          <Button color="inherit" onClick={onClose} disabled={working}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={mode === "missing" ? "primary" : "error"}
            onClick={() => void run()}
            disabled={!confirmed || working}
            startIcon={working ? <CircularProgress size={18} color="inherit" /> : undefined}
          >
            {mode === "missing" ? "Create product list" : "Recreate shop data"}
          </Button>
        </>
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {mode === "missing" ? (
          <Typography>
            Your shop has no product list on QDN, so products can&apos;t be added. This publishes an empty one. Hub asks you to
            confirm and charges a small fee.
          </Typography>
        ) : (
          <>
            <Alert severity="warning">
              This publishes an empty product list for your shop. Every product disappears from your shop, and buyers can no
              longer find or order them. Your orders and reviews stay.
            </Alert>
            <Typography>
              Use it only as a last resort, when your products don&apos;t load or show wrongly. To go ahead, type your shop id,{" "}
              <Box component="strong" sx={{ fontFamily: "monospace" }}>
                {shortId}
              </Box>
              .
            </Typography>
            <TextField
              label="Shop id"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              fullWidth
              slotProps={{ htmlInput: { autoComplete: "off", autoCapitalize: "off", spellCheck: false } }}
            />
          </>
        )}
        <FormError message={error} />
      </Box>
    </ResponsiveDialog>
  );
}
