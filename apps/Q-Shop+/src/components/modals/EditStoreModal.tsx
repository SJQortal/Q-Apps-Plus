/**
 * Edit shop: the shop form filled in from the current shop, full screen on
 * phones. Saving republishes the shop through hooks/useShopPublish.ts (the
 * original's payload). Advanced keeps the original's "Recreate shop data".
 */
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Box, Button, CircularProgress, Collapse, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { AppDispatch, RootState } from "../../state/store";
import { loadOwnShop } from "../../hooks/useOwnShops";
import { ResponsiveDialog } from "../common/mobile";
import { ShopFormError, useShopPublish } from "../../hooks/useShopPublish";
import { ShopForm } from "../../seller/ShopForm";
import { FormError } from "../../seller/FormError";
import { RecreateShopDataDialog } from "../../seller/RecreateShopDataDialog";
import { shopFormValues, toStoreFields, validateShopForm, type ShopFormValues } from "../../seller/shopFields";

interface EditShopDialogProps {
  open: boolean;
  onClose: () => void;
  /** The shop the seller asked to edit; while another of theirs is still current, it waits for this one to load. */
  storeId?: string | null;
}

const EditStoreModal = ({ open, onClose, storeId }: EditShopDialogProps) => {
  const dispatch = useDispatch<AppDispatch>();
  const currentStore = useSelector((state: RootState) => state.global.currentStore);
  const ownShopStatus = useSelector((state: RootState) => state.global.ownShopStatus);
  const myStores = useSelector((state: RootState) => state.store.myStores);
  const loading = !currentStore || (!!storeId && storeId !== currentStore.id);
  const wanted = loading && storeId ? myStores.find((s) => s.id === storeId) : undefined;
  const failed = loading && (ownShopStatus === "unavailable" || ownShopStatus === "error");

  // Make the shop being edited the current one, if it isn't yet (once per shop; a failure shows below).
  const asked = useRef<string | null>(null);
  useEffect(() => {
    if (!wanted || asked.current === wanted.id) return;
    asked.current = wanted.id;
    void loadOwnShop(dispatch, wanted);
  }, [wanted, dispatch]);

  if (loading) {
    return (
      <ResponsiveDialog open={open} onClose={onClose} title="Edit shop" maxWidth="xs">
        {failed ? (
          <Typography role="status" sx={{ py: 2 }}>
            Couldn&apos;t load this shop from your node. Close this and try again in a moment.
          </Typography>
        ) : (
          <Box role="status" sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 2 }}>
            <CircularProgress size={22} />
            <Typography>Loading your shop…</Typography>
          </Box>
        )}
      </ResponsiveDialog>
    );
  }
  return <EditShopForm key={currentStore.id} open={open} onClose={onClose} store={currentStore} />;
};

function EditShopForm({
  open,
  onClose,
  store,
}: {
  open: boolean;
  onClose: () => void;
  store: NonNullable<RootState["global"]["currentStore"]>;
}) {
  const { editShop } = useShopPublish();
  const [values, setValues] = useState<ShopFormValues>(() => shopFormValues(store));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [recreateOpen, setRecreateOpen] = useState(false);

  const save = async () => {
    setError(null);
    const invalid = validateShopForm(values);
    if (invalid) return setError(invalid);
    setSaving(true);
    try {
      if (await editShop(toStoreFields(values))) onClose();
    } catch (e) {
      setError(e instanceof ShopFormError ? e.message : "Failed to update the shop");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ResponsiveDialog
        open={open}
        onClose={saving ? () => {} : onClose}
        title="Edit shop"
        maxWidth="sm"
        dismissible={false}
        busy={saving}
        actions={
          <>
            <Button color="inherit" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => void save()}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={18} color="inherit" /> : undefined}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </>
        }
      >
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <ShopForm values={values} onChange={setValues} onImageError={setError} />
          <Box component="section" aria-label="Advanced" sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Button
              color="inherit"
              onClick={() => setAdvanced((v) => !v)}
              aria-expanded={advanced}
              endIcon={<ExpandMoreIcon sx={{ transform: advanced ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }} />}
              sx={{
                alignSelf: "flex-start",
                minHeight: 44,
                px: 0,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "text.secondary",
              }}
            >
              Advanced
            </Button>
            <Collapse in={advanced} unmountOnExit>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1, alignItems: "flex-start" }}>
                <Typography variant="body2" color="text.secondary">
                  If your products don&apos;t load or show wrongly, you can start your product list again. Every product
                  disappears from your shop.
                </Typography>
                <Button variant="outlined" color="error" onClick={() => setRecreateOpen(true)} sx={{ minHeight: 44 }}>
                  Recreate shop data
                </Button>
              </Box>
            </Collapse>
          </Box>
          <FormError message={error} />
        </Box>
      </ResponsiveDialog>
      {recreateOpen && (
        <RecreateShopDataDialog
          open={recreateOpen}
          onClose={() => {
            setRecreateOpen(false);
          }}
        />
      )}
    </>
  );
}

export default EditStoreModal;
