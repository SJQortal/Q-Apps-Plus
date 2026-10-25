/**
 * The products a shipping profile delivers (delivery/model.ts): picked from
 * the shop's products, searchable, with their pictures. A product in another
 * profile says so; picking it moves it here. Discount codes pick their
 * products with it too (seller/DiscountDialog.tsx).
 *
 * Simon: "add option to select all, or select collection … segregate the
 * products by collections": with collections, the list is grouped under each
 * collection (a product in two shows in both), then "Not in a collection";
 * a group's own tick picks or drops all of it, and Select all every product
 * the search leaves.
 */
import { Fragment, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Box, Button, Checkbox, FormControlLabel, InputAdornment, Skeleton, TextField, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import type { RootState } from "../state/store";
import { ResponsiveDialog } from "../components/common/mobile";
import { ProductImage } from "../components/common/ProductImage";
import type { SellerRow } from "./productList";
import { useCatalogueLoader } from "./useCatalogueLoader";
import { useShopCollections } from "../pages/Store/useShopCollections";
import { collectionDrafts, collectionsDraftKey } from "./useCollections";

const PAGE = 30;
const NO_PROFILES = new Map<string, string>();

const titleOf = (details: Record<string, unknown> | undefined) => (typeof details?.title === "string" ? details.title.trim() : "");

export function DeliveryProductsDialog({
  profileName,
  title,
  intro,
  picked: initial,
  elsewhere = NO_PROFILES,
  onSave,
  onClose,
}: {
  profileName: string;
  /** The dialog's title and first line, when they aren't a shipping profile's. */
  title?: string;
  intro?: string;
  picked: string[];
  /** Products in other profiles: their profile's name. */
  elsewhere?: Map<string, string>;
  onSave: (products: string[]) => void;
  onClose: () => void;
}) {
  const owner = useSelector((state: RootState) => state.global.currentStore?.owner || state.auth.user?.name);
  const storeId = useSelector((state: RootState) => state.global.currentStore?.id ?? "");
  const dataContainer = useSelector((state: RootState) => state.global.dataContainer);
  const signedIn = useSelector((state: RootState) => state.auth.user?.name);
  const rows = useSelector((state: RootState) => state.global.listProducts.products) as SellerRow[];
  // The collections as the seller has them (unpublished changes too), as on the Products tab.
  const published = useShopCollections(owner ?? "", storeId, dataContainer).collections;
  const collections = collectionDrafts.useDraft(collectionsDraftKey(signedIn, storeId)) ?? published;
  const { request, statusOf, productOf } = useCatalogueLoader(owner);
  const [picked, setPicked] = useState<string[]>(initial);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const pickedSet = useMemo(() => new Set(picked), [picked]);
  const needle = query.trim().toLowerCase();
  const details = (row: SellerRow) => productOf(row.catalogueId, row.productId) as Record<string, unknown> | undefined;
  const matching = rows.filter((row) => row.status !== "RETIRED" && (!needle || titleOf(details(row)).toLowerCase().includes(needle)));
  // Each collection's products the search leaves, in its order, then the rest; one group without collections.
  const groups: { key: string; title: string | null; rows: SellerRow[] }[] = [];
  const byId = new Map(matching.map((row) => [row.productId, row]));
  const grouped = new Set<string>();
  for (const c of collections) {
    const inIt = c.products.flatMap((id) => (byId.has(id) ? [byId.get(id) as SellerRow] : []));
    for (const row of inIt) grouped.add(row.productId);
    if (inIt.length > 0) groups.push({ key: c.id, title: c.title || "Collection", rows: inIt });
  }
  const rest = matching.filter((row) => !grouped.has(row.productId));
  if (rest.length > 0) groups.push({ key: "rest", title: groups.length > 0 ? "Not in a collection" : null, rows: rest });
  const items = groups.flatMap((g) => g.rows.map((row) => ({ group: g, row })));
  const visible = items.slice(0, shown).map((item) => item.row);
  const wanted = needle ? rows : visible;
  const wantedKey = [...new Set(wanted.map((row) => row.catalogueId))].join("|");
  useEffect(() => {
    if (wantedKey) request(wantedKey.split("|"));
  }, [wantedKey, request]);
  const toggle = (id: string) => setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  // Picks all of `ids`, or drops them when they're all picked already.
  const toggleAll = (ids: string[]) =>
    setPicked((prev) => {
      const all = ids.every((id) => prev.includes(id));
      return all ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])];
    });
  const matchingIds = matching.map((row) => row.productId);
  const allPicked = matchingIds.length > 0 && matchingIds.every((id) => pickedSet.has(id));

  return (
    <ResponsiveDialog
      open
      onClose={onClose}
      title={title ?? `Products in ${profileName}`}
      maxWidth="sm"
      actions={
        <>
          <Button color="inherit" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => onSave(picked)}>
            {picked.length === 1 ? "Use 1 product" : `Use ${picked.length} products`}
          </Button>
        </>
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {intro ?? "These products are delivered at this profile's prices; every other product at the General ones. Digital products are never delivered."}
        </Typography>
        <TextField
          type="search"
          size="small"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShown(PAGE);
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
          sx={{ "& .MuiInputBase-root": { minHeight: 44 } }}
        />
        {matching.length > 0 && (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
            <Typography variant="body2" color="text.secondary" role="status">
              {picked.length === 1 ? "1 chosen" : `${picked.length} chosen`}
            </Typography>
            <Button size="small" onClick={() => toggleAll(matchingIds)} sx={{ minHeight: 44 }}>
              {allPicked ? (needle ? "Unselect these" : "Select none") : needle ? `Select these ${matching.length}` : "Select all"}
            </Button>
          </Box>
        )}
        {rows.length === 0 ? (
          <Typography color="text.secondary">Your shop has no products yet.</Typography>
        ) : (
          <Box component="ul" aria-label="Products to choose from" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 0.5 }}>
            {items.slice(0, shown).map(({ group, row }, i, page) => {
              const startsGroup = !!group.title && (i === 0 || page[i - 1].group !== group);
              const groupIds = group.rows.map((r) => r.productId);
              const groupPicked = groupIds.filter((id) => pickedSet.has(id)).length;
              const d = details(row);
              const name = titleOf(d);
              const images: unknown[] = Array.isArray(d?.images) ? (d.images as unknown[]) : [];
              const pic = images[0] as string | undefined;
              const other = elsewhere.get(row.productId);
              const loading = !d && statusOf(row.catalogueId) !== "failed" && statusOf(row.catalogueId) !== "ready";
              return (
                <Fragment key={`${group.key}\n${row.productId}`}>
                  {startsGroup && (
                    <Box component="li" sx={{ pt: i === 0 ? 0 : 1.5, borderBottom: 1, borderColor: "divider" }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={groupPicked === groupIds.length}
                            onChange={() => toggleAll(groupIds)}
                          />
                        }
                        label={
                          <Box component="span" sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
                            <Typography component="span" sx={{ fontWeight: 700 }}>
                              {group.title}
                            </Typography>
                            <Typography component="span" variant="body2" color="text.secondary">
                              {/* Partly chosen says how much (a half-ticked box isn't announced well). */}
                              {groupPicked > 0 && groupPicked < groupIds.length
                                ? `${groupPicked} of ${groupIds.length} chosen`
                                : groupIds.length === 1
                                  ? "1 product"
                                  : `${groupIds.length} products`}
                            </Typography>
                          </Box>
                        }
                        sx={{ m: 0, minHeight: 44 }}
                      />
                    </Box>
                  )}
                  <li>
                    <FormControlLabel
                      control={<Checkbox checked={pickedSet.has(row.productId)} onChange={() => toggle(row.productId)} />}
                      label={
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0, py: 0.5 }}>
                          <Box sx={{ width: 44, height: 44, borderRadius: 1, overflow: "hidden", bgcolor: "action.hover", flexShrink: 0 }}>
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
                            {/* Only a shipping profile delivers (discount codes pick with a title of their own). */}
                            {!title && d?.type === "digital" && (
                              <Typography variant="body2" color="text.secondary">
                                Digital: never delivered
                              </Typography>
                            )}
                            {other && !pickedSet.has(row.productId) && (
                              <Typography variant="body2" color="text.secondary">
                                In {other} now
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      }
                      sx={{ m: 0, width: "100%", alignItems: "center", "& .MuiFormControlLabel-label": { minWidth: 0, flex: 1 } }}
                    />
                  </li>
                </Fragment>
              );
            })}
          </Box>
        )}
        {items.length > shown && (
          <Button variant="outlined" onClick={() => setShown((n) => n + PAGE)} sx={{ minHeight: 44, alignSelf: "flex-start" }}>
            Show more ({items.length - shown} more)
          </Button>
        )}
      </Box>
    </ResponsiveDialog>
  );
}
