/**
 * The products a shipping profile delivers (delivery/model.ts): picked from
 * the shop's products, searchable, with their pictures. A product in another
 * profile says so; picking it moves it here.
 */
import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Box, Button, Checkbox, FormControlLabel, InputAdornment, Skeleton, TextField, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import type { RootState } from "../state/store";
import { ResponsiveDialog } from "../components/common/mobile";
import { ProductImage } from "../components/common/ProductImage";
import type { SellerRow } from "./productList";
import { useCatalogueLoader } from "./useCatalogueLoader";

const PAGE = 30;

const titleOf = (details: Record<string, unknown> | undefined) => (typeof details?.title === "string" ? details.title.trim() : "");

export function DeliveryProductsDialog({
  profileName,
  picked: initial,
  elsewhere,
  onSave,
  onClose,
}: {
  profileName: string;
  picked: string[];
  /** Products in other profiles: their profile's name. */
  elsewhere: Map<string, string>;
  onSave: (products: string[]) => void;
  onClose: () => void;
}) {
  const owner = useSelector((state: RootState) => state.global.currentStore?.owner || state.auth.user?.name);
  const rows = useSelector((state: RootState) => state.global.listProducts.products) as SellerRow[];
  const { request, statusOf, productOf } = useCatalogueLoader(owner);
  const [picked, setPicked] = useState<string[]>(initial);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const pickedSet = useMemo(() => new Set(picked), [picked]);
  const needle = query.trim().toLowerCase();
  const details = (row: SellerRow) => productOf(row.catalogueId, row.productId) as Record<string, unknown> | undefined;
  const matching = rows.filter((row) => row.status !== "RETIRED" && (!needle || titleOf(details(row)).toLowerCase().includes(needle)));
  const visible = matching.slice(0, shown);
  const wanted = needle ? rows : visible;
  const wantedKey = [...new Set(wanted.map((row) => row.catalogueId))].join("|");
  useEffect(() => {
    if (wantedKey) request(wantedKey.split("|"));
  }, [wantedKey, request]);
  const toggle = (id: string) => setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <ResponsiveDialog
      open
      onClose={onClose}
      title={`Products in ${profileName}`}
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
          These products are delivered at this profile&apos;s prices; every other product at the General ones. Digital products are never delivered.
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
        {rows.length === 0 ? (
          <Typography color="text.secondary">Your shop has no products yet.</Typography>
        ) : (
          <Box component="ul" aria-label="Products to choose from" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 0.5 }}>
            {visible.map((row) => {
              const d = details(row);
              const name = titleOf(d);
              const images: unknown[] = Array.isArray(d?.images) ? (d.images as unknown[]) : [];
              const pic = images[0] as string | undefined;
              const other = elsewhere.get(row.productId);
              const loading = !d && statusOf(row.catalogueId) !== "failed" && statusOf(row.catalogueId) !== "ready";
              return (
                <li key={row.productId}>
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
                          {d?.type === "digital" && (
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
              );
            })}
          </Box>
        )}
        {matching.length > shown && (
          <Button variant="outlined" onClick={() => setShown((n) => n + PAGE)} sx={{ minHeight: 44, alignSelf: "flex-start" }}>
            Show more ({matching.length - shown} more)
          </Button>
        )}
      </Box>
    </ResponsiveDialog>
  );
}
