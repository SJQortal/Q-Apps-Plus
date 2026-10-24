/**
 * Add product and Edit product: a dialog (full screen on phones) around
 * ProductForm. Saving puts the product in `global.productsToSave`, as the
 * original's NewProduct.addProduct did; the seller publishes all drafts
 * together from "Ready to publish". The objects come from
 * seller/productDraft.ts (the original's shapes; ProductManager.pin pins them).
 * A published product also has Delete, which the seller page asks about first.
 */
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Box, Button, Typography } from "@mui/material";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import ShortUniqueId from "short-unique-id";
import type { RootState } from "../../../state/store";
import { setProductsToSave } from "../../../state/features/globalSlice";
import { ResponsiveDialog } from "../../../components/common/mobile";
import { assetCoinId, shopAssets, shopCoins } from "../../../money/coins";
import { assetInfo } from "../../../qdn/assets";
import { ProductForm } from "../ProductForm/ProductForm";
import { FormError } from "../../../seller/FormError";
import { listedCategory, oldCategoryOf } from "../../../constants/categories";
import { fiatPricingOf } from "../../../money/fiatPricing";
import { needsMorePictures } from "../../../qdn/productPictures";
import { auctionTermsOf } from "../../../auctions/rules";
import { useMorePictures } from "../../../hooks/useMorePictures";
import { variantDrafts, variantFormProblem } from "../../../variants/drafts";
import { variantOf } from "../../../variants/model";
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
  onDelete?: (product: { id: string; catalogueId?: string; title?: string }) => void;
}

function sameValues(a: ProductFormValues, b: ProductFormValues): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function ProductDialog({ open, onClose, product, onDelete }: ProductDialogProps) {
  const dispatch = useDispatch();
  const name = useSelector((state: RootState) => state.auth.user?.name);
  const currentStore = useSelector((state: RootState) => state.global.currentStore);
  const dataContainer = useSelector((state: RootState) => state.global.dataContainer);

  const coins = useMemo(() => shopCoins(currentStore) as string[], [currentStore]);
  // Prices in a currency at the seller's rates (Shop tab → Prices), when the shop uses them.
  const pricing = useMemo(() => fiatPricingOf(dataContainer), [dataContainer]);
  // The shop's assets that can't be split (Core's info, cached): their prices are whole units.
  const [wholeOnly, setWholeOnly] = useState<string[]>([]);
  const assetIds = shopAssets(currentStore).map((a) => a.id).join(",");
  useEffect(() => {
    if (!assetIds) return;
    let alive = true;
    void Promise.all(assetIds.split(",").map((id) => assetInfo({ id: Number(id) }).catch(() => null))).then((infos) => {
      if (alive) setWholeOnly(infos.filter((a) => a?.isDivisible === false).map((a) => assetCoinId(a!.assetId)));
    });
    return () => {
      alive = false;
    };
  }, [assetIds]);
  // A category saved before the list (constants/categories.ts) stays until the seller picks another.
  const [oldCategory] = useState(() => oldCategoryOf(product));

  const [initial, setInitial] = useState<ProductFormValues>(() => {
    const start = formValuesFor(product, coins, pricing);
    // A listed category saved in another spelling shows as the list's; an old one trimmed, as oldCategoryOf
    // gives it (the original saved categories as typed, spaces and all).
    return { ...start, category: listedCategory(start.category) ?? start.category.trim() };
  });
  const [values, setValues] = useState<ProductFormValues>(initial);
  // A published product's pictures past the third are in a document of their own (qdn/productPictures.ts):
  // read first, and added after the catalogue's, before its pictures can change.
  const [loadMore] = useState(() => needsMorePictures(product));
  const more = useMorePictures(loadMore ? currentStore?.owner || name : null, loadMore ? product : null, { exact: true });
  const [addedMore, setAddedMore] = useState("");
  if (more.status === "ready" && more.key !== addedMore) {
    setAddedMore(more.key);
    setInitial((v) => ({ ...v, images: [...v.images, ...more.images] }));
    setValues((v) => ({ ...v, images: [...v.images, ...more.images] }));
  }
  // Not in (yet): the pictures can't change, and saving keeps them as they are.
  const picturesPending = loadMore && (more.status === "loading" || more.status === "failed");
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
    const now = Date.now();
    const invalid = validateProductForm(values, coins, { oldCategory, pricing, wholeOnly, now, savedAuction: auctionTermsOf(product) });
    if (invalid) return setError(invalid);
    const { variants, variantDisplay, ...form } = values;
    const trimmed = { ...form, title: values.title.trim(), category: values.category.trim() };
    // A new product in variants: one draft each (variants/drafts.ts).
    if (!product && variants && values.sale !== "auction") {
      const problem = variantFormProblem(variants, trimmed, pricing);
      if (problem) return setError(problem);
      for (const draft of variantDrafts({ values: trimmed, form: variants, coins, storeId: currentStore.id, name, uid: () => uid(), now, pricing })) {
        dispatch(setProductsToSave(draft));
      }
      onClose();
      return;
    }
    let draft: Record<string, unknown> & { id: string } = product
      ? editedProductDraft({ base: product, values: trimmed, coins, name, pricing, picturesKept: picturesPending, now })
      : newProductDraft({ values: trimmed, coins, storeId: currentStore.id, name, uid: uid(), now, pricing });
    // An existing variant keeps its group, with the lists' choice as now set.
    const variant = product ? variantOf(product) : null;
    if (variant && variantDisplay && variantDisplay !== variant.display) draft = { ...draft, variant: { ...(product!.variant as object), display: variantDisplay } };
    dispatch(setProductsToSave(draft));
    onClose();
  };

  return (
    <>
      <ResponsiveDialog
        open={open}
        onClose={requestClose}
        title={product ? "Edit product" : "Add product"}
        maxWidth="md"
        dismissible={false}
        actions={
          <>
            {onDelete && listed && product && (
              <Button
                color="error"
                startIcon={<DeleteOutlineOutlinedIcon />}
                onClick={() =>
                  onDelete({
                    id: product.id,
                    catalogueId: typeof product.catalogueId === "string" ? product.catalogueId : undefined,
                    title: String(product.title || values.title || "").trim() || undefined,
                  })
                }
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
            oldCategory={oldCategory}
            pricing={pricing}
            saved={product}
            wholeOnly={wholeOnly}
            editing={editingPublished}
            onImageError={setError}
            publisher={name}
            shopTitle={currentStore?.title}
            picturesLoad={
              picturesPending && (more.status === "loading" || more.status === "failed")
                ? { status: more.status, count: more.count, onRetry: more.retry }
                : null
            }
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
