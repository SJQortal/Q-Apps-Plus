/**
 * New collection / Edit collection (full screen on phones): its title,
 * description and picture (made 640 px wide: it shows as a card), and which
 * of the shop's products it holds, picked from a searchable list. Buyers see
 * them in the order they were picked (the collection's "Collections" sort,
 * Follow-up 14), which Arrange changes. Done puts it in the Collections
 * tab's working copy; nothing is published until the seller publishes the
 * collections there.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ProductImage } from "../components/common/ProductImage";
import { useSelector } from "react-redux";
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  InputAdornment,
  Skeleton,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import ShortUniqueId from "short-unique-id";
import type { RootState } from "../state/store";
import { ResponsiveDialog } from "../components/common/mobile";
import ImageUploader from "../components/common/ImageUploader";
import { AmountTag } from "../components/money/PriceTag";
import {
  COLLECTION_IMAGE_MAX_WIDTH,
  MAX_COLLECTION_DESCRIPTION,
  MAX_COLLECTION_TITLE,
  type ShopCollection,
} from "../qdn/collections";
import { FormError } from "./FormError";
import type { SellerRow } from "./productList";
import { useCatalogueLoader } from "./useCatalogueLoader";
import { StatusChip } from "./ProductsTab";
import { ArrangeDialog } from "./ArrangeDialog";

const uid = new ShortUniqueId({ length: 10 });

/** Products listed in the picker at a time. */
export const PICKER_PAGE = 30;

function titleOf(details: Record<string, any> | undefined): string {
  return typeof details?.title === "string" ? details.title.trim() : "";
}

export function CollectionEditor({
  collection,
  onSave,
  onClose,
}: {
  /** The collection to edit, or null for a new one. */
  collection: ShopCollection | null;
  onSave: (collection: ShopCollection) => void;
  onClose: () => void;
}) {
  const owner = useSelector((state: RootState) => state.global.currentStore?.owner || state.auth.user?.name);
  const rows = useSelector((state: RootState) => state.global.listProducts.products) as SellerRow[];
  const { request, statusOf, productOf } = useCatalogueLoader(owner);
  const [title, setTitle] = useState(collection?.title ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  const [image, setImage] = useState<string | undefined>(collection?.image);
  const [picked, setPicked] = useState<string[]>(collection?.products ?? []);
  const [query, setQuery] = useState("");
  const [onlyPicked, setOnlyPicked] = useState(false);
  const [shown, setShown] = useState(PICKER_PAGE);
  const [error, setError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [arranging, setArranging] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const changed =
    title !== (collection?.title ?? "") ||
    description !== (collection?.description ?? "") ||
    image !== collection?.image ||
    JSON.stringify(picked) !== JSON.stringify(collection?.products ?? []);
  const requestClose = () => (changed ? setConfirmDiscard(true) : onClose());

  const pickedSet = useMemo(() => new Set(picked), [picked]);
  // The picks this page lists, in their order (one from another device it doesn't list yet keeps its place at the end).
  const pickedRows = useMemo(() => {
    const byId = new Map(rows.map((row) => [row.productId, row]));
    return picked.map((id) => byId.get(id)).filter((row): row is SellerRow => !!row);
  }, [picked, rows]);
  const needle = query.trim().toLowerCase();
  const details = (row: SellerRow) => productOf(row.catalogueId, row.productId);
  const matching = rows.filter((row) => {
    if (onlyPicked && !pickedSet.has(row.productId)) return false;
    if (!needle) return true;
    return titleOf(details(row)).toLowerCase().includes(needle);
  });
  const visible = matching.slice(0, shown);

  // Titles and pictures for the products listed; a search needs every title.
  const wanted = needle ? rows : visible;
  const wantedKey = [...new Set(wanted.map((row) => row.catalogueId))].join("|");
  useEffect(() => {
    if (wantedKey) request(wantedKey.split("|"));
  }, [wantedKey, request]);

  const toggle = (productId: string) =>
    setPicked((prev) => (prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]));

  const submit = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setTitleError(true);
      titleRef.current?.focus();
      return;
    }
    const now = Date.now();
    onSave({
      id: collection?.id ?? uid(),
      title: cleanTitle.slice(0, MAX_COLLECTION_TITLE),
      description: description.trim().slice(0, MAX_COLLECTION_DESCRIPTION),
      ...(image && { image }),
      // Every pick stays, also one this page's product list doesn't show yet (another device's):
      // publishing leaves out only what the product list on QDN no longer has.
      products: picked,
      created: collection?.created || now,
      updated: now,
    });
  };

  const loadingTitles = needle && rows.some((row) => statusOf(row.catalogueId) !== "ready" && statusOf(row.catalogueId) !== "failed");

  return (
    <>
    <ResponsiveDialog
      open
      onClose={requestClose}
      title={collection ? "Edit collection" : "New collection"}
      maxWidth="sm"
      dismissible={false}
      actions={
        <>
          <Button color="inherit" onClick={requestClose}>
            Cancel
          </Button>
          <Button variant="contained" onClick={submit}>
            Done
          </Button>
        </>
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <TextField
          label="Title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value.slice(0, MAX_COLLECTION_TITLE));
            if (e.target.value.trim()) setTitleError(false);
          }}
          required
          fullWidth
          inputRef={titleRef}
          error={titleError}
          helperText={titleError ? "Give the collection a title." : `${title.length}/${MAX_COLLECTION_TITLE}`}
        />
        <TextField
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, MAX_COLLECTION_DESCRIPTION))}
          fullWidth
          multiline
          minRows={2}
          helperText={`${description.length}/${MAX_COLLECTION_DESCRIPTION}`}
        />

        <Box>
          <Typography component="h3" sx={{ fontWeight: 700, mb: 1 }}>
            Picture
          </Typography>
          <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", flexWrap: "wrap" }}>
            <Box
              sx={{
                width: 120,
                aspectRatio: "4 / 3",
                borderRadius: 1,
                overflow: "hidden",
                bgcolor: "action.hover",
                color: "text.secondary",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {image ? (
                <Box component="img" src={image} alt="The collection's picture" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <ImageOutlinedIcon aria-hidden />
              )}
            </Box>
            <Box sx={{ flex: "1 1 220px", minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
              <ImageUploader
                label={image ? "Change picture" : "Add a picture"}
                onPick={(img) => setImage(img)}
                onError={setError}
                maxWidth={COLLECTION_IMAGE_MAX_WIDTH}
              />
              {image && (
                <Button color="inherit" onClick={() => setImage(undefined)} sx={{ alignSelf: "flex-start", minHeight: 44 }}>
                  Remove picture
                </Button>
              )}
            </Box>
          </Box>
        </Box>

        <Box component="section" aria-labelledby="collection-products-heading">
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1, mb: 1 }}>
            <Typography id="collection-products-heading" component="h3" sx={{ fontWeight: 700 }}>
              Products
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: "auto" }}>
              <Typography variant="body2" color="text.secondary" role="status">
                {picked.length === 1 ? "1 selected" : `${picked.length} selected`}
              </Typography>
              {pickedRows.length > 1 && (
                <Button variant="outlined" startIcon={<SwapVertIcon />} onClick={() => setArranging(true)} sx={{ minHeight: 44 }}>
                  Arrange
                </Button>
              )}
            </Box>
          </Box>
          {picked.length > 1 && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Buyers see them in the order you picked them. Arrange changes it.
            </Typography>
          )}
          {rows.length === 0 ? (
            <Typography color="text.secondary">Your shop has no products yet. Add some, then put them in collections.</Typography>
          ) : (
            <>
              <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mb: 1 }}>
                <TextField
                  type="search"
                  size="small"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShown(PICKER_PAGE);
                  }}
                  placeholder="Search your products"
                  slotProps={{
                    htmlInput: { "aria-label": "Search your products" },
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    },
                  }}
                  sx={{ flex: "1 1 220px", minWidth: 0, "& .MuiInputBase-root": { minHeight: 44 } }}
                />
                <FormControlLabel
                  control={<Switch checked={onlyPicked} onChange={(e) => setOnlyPicked(e.target.checked)} />}
                  label="Selected only"
                  sx={{ minHeight: 44, mr: 0 }}
                />
              </Box>
              {matching.length === 0 ? (
                <Typography color="text.secondary" sx={{ py: 1 }}>
                  {loadingTitles ? "Loading your products' titles…" : "No products match."}
                </Typography>
              ) : (
                <Box component="ul" aria-label="Products to choose from" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 0.5 }}>
                  {visible.map((row) => {
                    const d = details(row);
                    const name = titleOf(d);
                    const images: unknown[] = Array.isArray(d?.images) ? d.images : [];
                    const pic = (images[typeof d?.mainImageIndex === "number" ? d.mainImageIndex : 0] ?? images[0]) as string | undefined;
                    const loading = !d && statusOf(row.catalogueId) !== "failed" && statusOf(row.catalogueId) !== "ready";
                    return (
                      <li key={row.productId}>
                        <FormControlLabel
                          control={<Checkbox checked={pickedSet.has(row.productId)} onChange={() => toggle(row.productId)} />}
                          label={
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0, py: 0.5 }}>
                              <Box
                                sx={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: 1,
                                  overflow: "hidden",
                                  bgcolor: "action.hover",
                                  flexShrink: 0,
                                }}
                              >
                                {pic && <ProductImage src={pic} alt="" />}
                              </Box>
                              <Box sx={{ minWidth: 0 }}>
                                {name ? (
                                  <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{name}</Typography>
                                ) : loading ? (
                                  <Skeleton width={140} />
                                ) : (
                                  <Typography color="text.secondary">Untitled product</Typography>
                                )}
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                                  <StatusChip status={row.status} />
                                  <AmountTag value={row.priceQort} coin="QORT" size="small" />
                                </Box>
                              </Box>
                            </Box>
                          }
                          sx={{ m: 0, width: "100%", alignItems: "center", "& .MuiFormControlLabel-label": { minWidth: 0, flex: 1 } }}
                        />
                      </li>
                    );
                  })}
                </Box>
              )}
              {matching.length > shown && (
                <Button variant="outlined" onClick={() => setShown((n) => n + PICKER_PAGE)} sx={{ mt: 1, minHeight: 44 }}>
                  Show more ({matching.length - shown} more)
                </Button>
              )}
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Retired products stay in a collection but don&apos;t show to buyers.
              </Typography>
            </>
          )}
        </Box>
        <FormError message={error} />
      </Box>
    </ResponsiveDialog>
    {arranging && (
      <ArrangeDialog
        title="Arrange this collection"
        intro="Buyers see the collection's products in this order (the Collections sort), and can still sort by newest or price."
        rows={pickedRows}
        onDone={(order) => {
          const shown = new Set(order);
          setPicked((prev) => [...order, ...prev.filter((id) => !shown.has(id))]);
          setArranging(false);
        }}
        onClose={() => setArranging(false)}
      />
    )}
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
      <Typography>What you changed in this collection will be lost.</Typography>
    </ResponsiveDialog>
    </>
  );
}
