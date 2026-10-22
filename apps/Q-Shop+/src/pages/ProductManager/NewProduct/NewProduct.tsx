/**
 * Add product and Edit product: a dialog (full screen on phones) around
 * ProductForm. Saving puts the product in `global.productsToSave`, as the
 * original's NewProduct.addProduct did; the seller publishes all drafts
 * together from "Ready to publish". The objects come from
 * seller/productDraft.ts (the original's shapes; ProductManager.pin pins them).
 * A published product also has Delete, which the seller page asks about first.
 */
import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Box, Button, Typography } from "@mui/material";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import ShortUniqueId from "short-unique-id";
import type { RootState } from "../../../state/store";
import { addProductsToSaveCategory, setProductsToSave } from "../../../state/features/globalSlice";
import { ResponsiveDialog } from "../../../components/common/mobile";
import { shopCoins } from "../../../money/coins";
import { ProductForm } from "../ProductForm/ProductForm";
import { FormError } from "../../../seller/FormError";
import {
  editedProductDraft,
  formValuesFor,
  newProductDraft,
  validateProductForm,
  type ProductFormValues,
} from "../../../seller/productDraft";

const uid = new ShortUniqueId({ length: 10 });

export interface ProductDialogProps {
  open: boolean;
  onClose: () => void;
  /**
   * The product to edit: a published one as seller/productDraft's
   * productForEdit merges it, or a draft. Null adds a new product.
   */
  product: (Record<string, any> & { id: string }) | null;
  /** Delete this (published) product; the form stays open until it is deleted. */
  onDelete?: (product: { id: string; title: string }) => void;
}

function sameValues(a: ProductFormValues, b: ProductFormValues): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function ProductDialog({ open, onClose, product, onDelete }: ProductDialogProps) {
  const dispatch = useDispatch();
  const name = useSelector((state: RootState) => state.auth.user?.name);
  const currentStore = useSelector((state: RootState) => state.global.currentStore);
  const dataContainer = useSelector((state: RootState) => state.global.dataContainer);
  const listCategories = useSelector((state: RootState) => state.global.listProducts.categories);
  const draftCategories = useSelector((state: RootState) => state.global.productsToSaveCategories);
  const productsToSave = useSelector((state: RootState) => state.global.productsToSave);

  const coins = useMemo(() => shopCoins(currentStore) as string[], [currentStore]);
  const categories = useMemo(() => {
    const all = new Set<string>([...listCategories, ...draftCategories]);
    for (const draft of Object.values(productsToSave)) if (draft?.category) all.add(draft.category);
    return [...all].filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [listCategories, draftCategories, productsToSave]);

  const [initial] = useState<ProductFormValues>(() => formValuesFor(product, coins));
  const [values, setValues] = useState<ProductFormValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const editingPublished = !!product && (!!product.isUpdate || !!product.catalogueId);
  // In the shop's product list (not just a draft): it can be deleted.
  const listed = !!product && !!dataContainer?.products?.[product.id];

  const requestClose = () => {
    if (!sameValues(values, initial)) setConfirmDiscard(true);
    else onClose();
  };

  const submit = () => {
    setError(null);
    if (!name) return setError("Sign in with your Qortal name to add products.");
    if (!currentStore?.id || !dataContainer || dataContainer.storeId !== currentStore.id) {
      return setError("Your shop's product list isn't loaded yet. Close this and try again in a moment.");
    }
    const invalid = validateProductForm(values, coins);
    if (invalid) return setError(invalid);
    const trimmed = { ...values, title: values.title.trim(), category: values.category.trim() };
    const draft = product
      ? editedProductDraft({ base: product, values: trimmed, coins, name })
      : newProductDraft({ values: trimmed, coins, storeId: currentStore.id, name, uid: uid(), now: Date.now() });
    dispatch(setProductsToSave(draft));
    if (!categories.includes(trimmed.category)) dispatch(addProductsToSaveCategory(trimmed.category));
    onClose();
  };

  return (
    <>
      <ResponsiveDialog
        open={open}
        onClose={requestClose}
        title={product ? "Edit product" : "Add product"}
        maxWidth="sm"
        dismissible={false}
        actions={
          <>
            {onDelete && listed && product && (
              <Button
                color="error"
                startIcon={<DeleteOutlineOutlinedIcon />}
                onClick={() => onDelete({ id: product.id, title: String(product.title || values.title || "This product").trim() })}
                sx={{ mr: "auto" }}
              >
                Delete
              </Button>
            )}
            <Button color="inherit" onClick={requestClose}>
              Cancel
            </Button>
            <Button variant="contained" onClick={submit}>
              {product ? "Save to drafts" : "Add to drafts"}
            </Button>
          </>
        }
      >
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {editingPublished
              ? "Changes wait in Ready to publish until you publish them."
              : "New products wait in Ready to publish, so you can add several and publish them together."}
          </Typography>
          <ProductForm
            values={values}
            onChange={setValues}
            coins={coins}
            shop={currentStore}
            categories={categories}
            editing={editingPublished}
            onImageError={setError}
          />
          <FormError message={error} />
        </Box>
      </ResponsiveDialog>
      <ResponsiveDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="Discard changes?"
        maxWidth="xs"
        actions={
          <>
            <Button color="inherit" onClick={() => setConfirmDiscard(false)}>
              Keep editing
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => {
                setConfirmDiscard(false);
                onClose();
              }}
            >
              Discard
            </Button>
          </>
        }
      >
        <Typography>What you typed in this form will be lost.</Typography>
      </ResponsiveDialog>
    </>
  );
}
