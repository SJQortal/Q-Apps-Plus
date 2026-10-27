/**
 * Add product and Edit product: a dialog (full screen on phones) around
 * ProductForm. Saving puts the product in `global.productsToSave`, as the
 * original's NewProduct.addProduct did; the seller publishes all drafts
 * together from "Ready to publish". The objects come from
 * seller/productDraft.ts (the original's shapes; ProductManager.pin pins them).
 * A published product also has Delete, which the seller page asks about first.
 *
 * A product in variants (variants/model.ts) is edited with its whole group:
 * the dialog reads the group's other products first (useVariantGroup), then
 * the form starts from the lead with every item, and saving makes a draft
 * for each (variants/drafts.ts groupEditDrafts). Delete takes them all.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Box, Button, IconButton, Skeleton, Tooltip, Typography, type SxProps, type Theme } from "@mui/material";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import ShortUniqueId from "short-unique-id";
import type { RootState } from "../../../state/store";
import { removeFromProductsToSave, setProductsToSave } from "../../../state/features/globalSlice";
import { ResponsiveDialog } from "../../../components/common/mobile";
import { assetCoinId, coinLabel, shopAssets, shopCoins } from "../../../money/coins";
import { assetInfo } from "../../../qdn/assets";
import { ProductForm } from "../ProductForm/ProductForm";
import { FormError } from "../../../seller/FormError";
import { listedCategory, oldCategoryOf } from "../../../constants/categories";
import { suggestCategory } from "../../../utils/categoryMatch";
import { fiatPricingOf } from "../../../money/fiatPricing";
import { needsMorePictures } from "../../../qdn/productPictures";
import { auctionTermsOf } from "../../../auctions/rules";
import { useMorePictures } from "../../../hooks/useMorePictures";
import { groupEditDrafts, groupFormValues, removedMembers, variantDrafts, variantFormProblem } from "../../../variants/drafts";
import { variantLabel, variantOf, type ProductVariant } from "../../../variants/model";
import { useVariantGroup } from "../../../variants/useVariantGroup";
import { sameContent } from "../../../seller/sameContent";
import { usePhoneLayout } from "../../../hooks/usePhoneLayout";
import {
  editedProductDraft,
  formValuesFor,
  newProductDraft,
  validateProductForm,
  type ProductFormValues,
} from "../../../seller/productDraft";

const uid = new ShortUniqueId({ length: 10 });

/**
 * Delete or Duplicate in the form's bar: with its word, or on phones as its
 * icon alone (named, with a tooltip), so Cancel and Save to drafts keep the
 * bar's one row at 360 px instead of breaking onto two lines.
 */
function ActionButton({
  label,
  icon,
  iconOnly,
  onClick,
  color = "inherit",
  sx,
}: {
  label: string;
  icon: ReactNode;
  iconOnly: boolean;
  onClick: () => void;
  color?: "inherit" | "error";
  sx?: SxProps<Theme>;
}) {
  if (!iconOnly) {
    return (
      <Button color={color} startIcon={icon} onClick={onClick} sx={sx}>
        {label}
      </Button>
    );
  }
  return (
    <Tooltip title={label}>
      <IconButton color={color} aria-label={label} onClick={onClick} sx={[{ width: 44, height: 44 }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
        {icon}
      </IconButton>
    </Tooltip>
  );
}

export interface ProductDialogProps {
  open: boolean;
  onClose: () => void;
  /**
   * The product to edit: a published one as seller/productDraft's
   * productForEdit merges it, or a draft. Null adds a new product.
   */
  product: (Record<string, any> & { id: string }) | null;
  /** Delete this (published) product, or a group's products; the form stays open until they are deleted. */
  onDelete?: (products: { id: string; catalogueId?: string; title?: string }[]) => void;
  /** A new product's starting values: a copy of another's (Duplicate). */
  initialValues?: ProductFormValues | null;
  /** Duplicate: a new product starting from this form's values (sellers with many similar products). */
  onDuplicate?: (values: ProductFormValues) => void;
}

/**
 * A copy's values: "(copy)" after the title, at a fixed price, on its own (not
 * in a variant group), for sale, and in a category from the list (a new
 * product's must be: an old one gives way to the title's suggestion).
 */
export function copyValues(values: ProductFormValues): ProductFormValues {
  const { auction: _auction, ...rest } = values;
  const category = listedCategory(values.category) ?? suggestCategory(values.title) ?? "";
  // A counted product's copy counts its own stock: the seller types it (the original's count, its date and its voided orders stay with it).
  const stock = values.stock ? { tracked: values.stock.tracked, quantity: values.stock.saved ? "" : values.stock.quantity } : values.stock;
  return { ...rest, title: `${values.title.trim()} (copy)`.slice(0, 180), category, sale: "fixed", variants: null, status: "AVAILABLE", stock };
}

type Base = Record<string, any> & { id: string };

/** A variant group being edited: its products, the lead first among equals. */
interface EditedGroup {
  variant: ProductVariant;
  members: Base[];
}

/** A product without what saving stamps on it (when, who, that it's an edit). */
function withoutStamps(product: Record<string, unknown>): Record<string, unknown> {
  const { updated: _u, created: _c, isUpdate: _i, user: _w, ...rest } = product;
  return rest;
}

function sameValues(a: ProductFormValues, b: ProductFormValues): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function ProductDialog(props: ProductDialogProps) {
  const variant = props.product ? variantOf(props.product) : null;
  if (props.product && variant) return <GroupDialog {...props} product={props.product} variant={variant} />;
  return <ProductEditor {...props} />;
}

/** A variant's dialog: its group's products are read first, then the form edits them all. */
function GroupDialog(props: ProductDialogProps & { product: Base; variant: ProductVariant }) {
  const { product, variant, ...rest } = props;
  const group = useVariantGroup(product, variant);
  if (group.status === "ready") return <ProductEditor {...rest} product={group.lead} group={{ variant: group.variant, members: group.members }} />;
  return (
    <ResponsiveDialog
      open={props.open}
      onClose={props.onClose}
      title="Edit product"
      maxWidth="sm"
      actions={
        <>
          <Button color="inherit" onClick={props.onClose}>
            Cancel
          </Button>
          {group.status === "failed" && (
            <Button variant="contained" onClick={group.retry}>
              Try again
            </Button>
          )}
        </>
      }
    >
      {group.status === "failed" ? (
        <Typography role="alert">Some of {variant.title}&apos;s items couldn&apos;t be read from your node, so they can&apos;t be edited together yet.</Typography>
      ) : (
        <Box role="status" sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Typography>Reading all of {variant.title}&apos;s items…</Typography>
          <Skeleton variant="rounded" height={120} />
        </Box>
      )}
    </ResponsiveDialog>
  );
}

function ProductEditor({ open, onClose, product, onDelete, initialValues = null, onDuplicate, group = null }: ProductDialogProps & { group?: EditedGroup | null }) {
  const dispatch = useDispatch();
  const name = useSelector((state: RootState) => state.auth.user?.name);
  const currentStore = useSelector((state: RootState) => state.global.currentStore);
  const dataContainer = useSelector((state: RootState) => state.global.dataContainer);
  const productsToSave = useSelector((state: RootState) => state.global.productsToSave);
  const phone = usePhoneLayout();

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
    const start = !product && initialValues ? initialValues : formValuesFor(product, coins, pricing);
    // A listed category saved in another spelling shows as the list's; an old one trimmed, as oldCategoryOf
    // gives it (the original saved categories as typed, spaces and all).
    const values = { ...start, category: listedCategory(start.category) ?? start.category.trim() };
    // A group: the lead's fields under the group's title, and every item.
    if (!group) return values;
    return { ...values, title: group.variant.title, variants: groupFormValues({ variant: group.variant, members: group.members, lead: values, coins, pricing }) };
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
  // In the shop's product list (not just a draft): it can be deleted; a group's listed products together.
  const listedProducts = (group ? group.members : product ? [product] : []).filter((p) => !!dataContainer?.products?.[p.id]);
  const removed = useMemo(
    () =>
      group && values.variants
        ? removedMembers(values.variants, group.members).map((m) => ({
            label: variantLabel(variantOf(m)?.values ?? []) || String(m.title ?? ""),
            draft: !m.isUpdate && !m.catalogueId,
          }))
        : [],
    [group, values.variants]
  );

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
    const inVariants = (!product || !!group) && !!values.variants && values.sale !== "auction";
    const invalid = validateProductForm(values, coins, { oldCategory, pricing, wholeOnly, now, savedAuction: auctionTermsOf(product), imagesOptional: inVariants, priceOptional: inVariants });
    if (invalid) return setError(invalid);
    const { variants, ...form } = values;
    const coinChecks = { label: (coin: string) => coinLabel(coin, currentStore), wholeOnly };
    const trimmed = { ...form, title: values.title.trim(), category: values.category.trim() };
    // A group: a draft for each item, new ones too; those taken out retired, or dropped while only drafts.
    if (group && variants) {
      if (picturesPending) return setError("The product's pictures are still being read from your node. Save once they are in.");
      const problem = variantFormProblem(variants, trimmed, pricing, coinChecks);
      if (problem) return setError(problem);
      const { drafts, dropped } = groupEditDrafts({
        values: trimmed,
        form: variants,
        group: group.variant.group,
        members: group.members,
        coins,
        storeId: currentStore.id,
        name,
        uid: () => uid(),
        now,
        pricing,
      });
      for (const id of dropped) dispatch(removeFromProductsToSave(id));
      for (const draft of drafts) dispatch(setProductsToSave(draft));
      onClose();
      return;
    }
    // A new product in variants: one draft each (variants/drafts.ts).
    if (inVariants && variants) {
      const problem = variantFormProblem(variants, trimmed, pricing, coinChecks);
      if (problem) return setError(problem);
      for (const draft of variantDrafts({ values: trimmed, form: variants, coins, storeId: currentStore.id, name, uid: () => uid(), now, pricing })) {
        dispatch(setProductsToSave(draft));
      }
      onClose();
      return;
    }
    const draft = product
      ? editedProductDraft({ base: product, values: trimmed, coins, name, pricing, picturesKept: picturesPending, now })
      : newProductDraft({ values: trimmed, coins, storeId: currentStore.id, name, uid: uid(), now, pricing });
    // A published product saved as it is (changed and put back, say): no draft, so nothing waits to be published.
    if (product && !productsToSave[product.id] && sameContent(withoutStamps(draft), withoutStamps(product))) return onClose();
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
            {onDelete && listedProducts.length > 0 && (
              <ActionButton
                label={group && listedProducts.length > 1 ? `Delete all ${listedProducts.length}` : "Delete"}
                icon={<DeleteOutlineOutlinedIcon />}
                color="error"
                iconOnly={phone}
                onClick={() =>
                  onDelete(
                    listedProducts.map((p) => ({
                      id: p.id,
                      catalogueId: typeof p.catalogueId === "string" ? p.catalogueId : undefined,
                      title: String(p.title || (group ? "" : values.title) || "").trim() || undefined,
                    }))
                  )
                }
                sx={{ mr: "auto" }}
              />
            )}
            {onDuplicate && product && !group && !picturesPending && (
              <ActionButton
                label="Duplicate"
                icon={<ContentCopyOutlinedIcon />}
                iconOnly={phone}
                onClick={() => onDuplicate(copyValues(values))}
                sx={listedProducts.length > 0 && onDelete ? undefined : { mr: "auto" }}
              />
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
            variantGroup={group && { removed }}
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
