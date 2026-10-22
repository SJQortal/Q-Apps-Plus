/**
 * Create shop: the shop's id (letters, digits and dashes, cleaned as the
 * original cleaned it, with a preview of the identifier and link it makes),
 * then the shop form. Full screen on phones. Publishing goes through
 * hooks/useShopPublish.ts (the original's STORE + empty product index).
 * Fix: the original left "creating" on after a validation error; here every
 * attempt ends with the button usable again.
 */
import { useState } from "react";
import { useSelector } from "react-redux";
import { Box, Button, CircularProgress, TextField, Typography } from "@mui/material";
import type { RootState } from "../../state/store";
import { ResponsiveDialog } from "../common/mobile";
import { ShopFormError, useShopPublish } from "../../hooks/useShopPublish";
import { finalizeShortStoreId, sanitizeShortStoreIdInput, storeIdentifier } from "../../qdn/identifiers";
import { storeLink } from "../../qdn/links";
import { ShopForm } from "../../seller/ShopForm";
import { FormError } from "../../seller/FormError";
import { MAX_SHOP_ID, shopFormValues, toStoreFields, validateShopForm, type ShopFormValues } from "../../seller/shopFields";

export interface ForeignCoins {
  [key: string]: string;
}

interface CreateShopDialogProps {
  open: boolean;
  onClose: () => void;
  /** Published: the new shop's id. */
  onCreated: (storeId: string) => void;
}

const CreateStoreModal = ({ open, onClose, onCreated }: CreateShopDialogProps) => {
  const name = useSelector((state: RootState) => state.auth.user?.name) ?? "";
  const { createShop } = useShopPublish();
  const [shopId, setShopId] = useState("");
  const [values, setValues] = useState<ShopFormValues>(() => shopFormValues(null));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finalId = finalizeShortStoreId(shopId.trim());
  const identifier = finalId ? storeIdentifier(finalId) : "";

  const submit = async () => {
    setError(null);
    if (!finalId) return setError("Pick a shop id: letters, numbers and dashes.");
    const invalid = validateShopForm(values);
    if (invalid) return setError(invalid);
    setCreating(true);
    try {
      const id = await createShop({ ...toStoreFields(values), shortStoreId: shopId });
      if (id) onCreated(id);
    } catch (e) {
      setError(e instanceof ShopFormError ? e.message : "Failed to create the shop");
    } finally {
      setCreating(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onClose={creating ? () => {} : onClose}
      title="Create shop"
      maxWidth="sm"
      dismissible={false}
      actions={
        <>
          <Button color="inherit" onClick={onClose} disabled={creating}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void submit()}
            disabled={creating}
            startIcon={creating ? <CircularProgress size={18} color="inherit" /> : undefined}
          >
            {creating ? "Creating…" : "Create shop"}
          </Button>
        </>
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <Typography variant="body2" color="text.secondary">
          Your shop is published under your name, {name || "your Qortal name"}. Hub asks you to confirm and charges a small fee.
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <TextField
            label="Shop id"
            value={shopId}
            onChange={(e) => setShopId(sanitizeShortStoreIdInput(e.target.value))}
            required
            fullWidth
            helperText="Letters, numbers and dashes. It can't be changed later."
            slotProps={{ htmlInput: { maxLength: MAX_SHOP_ID, autoCapitalize: "off", autoComplete: "off", spellCheck: false } }}
          />
          <Box
            aria-live="polite"
            sx={{ p: 1.5, borderRadius: 1, bgcolor: "action.hover", display: "flex", flexDirection: "column", gap: 0.5, minWidth: 0 }}
          >
            <Typography variant="body2" color="text.secondary">
              Identifier
            </Typography>
            <Typography sx={{ fontFamily: "monospace", fontSize: 14, overflowWrap: "anywhere" }}>
              {identifier || "q-store-general-…"}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Link
            </Typography>
            <Typography sx={{ fontFamily: "monospace", fontSize: 14, overflowWrap: "anywhere" }}>
              {identifier && name ? storeLink(name, identifier) : "Pick a shop id"}
            </Typography>
          </Box>
        </Box>
        <ShopForm values={values} onChange={setValues} onImageError={setError} />
        <FormError message={error} />
      </Box>
    </ResponsiveDialog>
  );
};

export default CreateStoreModal;
