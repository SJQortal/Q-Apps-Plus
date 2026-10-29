/**
 * The product form's Collections: the shop's collections the product is in,
 * picked by title. What's picked goes into the collections draft when the
 * form saves (seller/productCollections.ts), published with the seller's
 * other changes.
 */
import { Autocomplete, Chip, TextField, Typography } from "@mui/material";
import type { ShopCollection } from "../qdn/collections";
import { autocompletePaperProps } from "../components/common/menuStyle";

export function CollectionsField({
  collections,
  value,
  onChange,
  status,
}: {
  collections: ShopCollection[];
  value: string[];
  onChange: (ids: string[]) => void;
  /** "ready": pick; "loading": not read yet; "unavailable": couldn't be read, so nothing changes. */
  status: "ready" | "loading" | "unavailable";
}) {
  if (status === "ready" && collections.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Collections: none yet. Make them in the Collections tab, then add products to them here or there.
      </Typography>
    );
  }
  const byId = new Map(collections.map((c) => [c.id, c]));
  const picked = value.flatMap((id) => {
    const c = byId.get(id);
    return c ? [c] : [];
  });
  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      options={collections}
      value={picked}
      onChange={(_, next) => onChange(next.map((c) => c.id))}
      getOptionLabel={(c) => c.title || "Untitled collection"}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      disabled={status !== "ready"}
      slotProps={{ paper: autocompletePaperProps }}
      renderValue={(chosen, getItemProps) =>
        chosen.map((c, index) => {
          const { key, ...itemProps } = getItemProps({ index });
          return <Chip key={key} {...itemProps} label={c.title || "Untitled collection"} />;
        })
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label="Collections"
          placeholder={picked.length === 0 && status === "ready" ? "Not in a collection" : undefined}
          helperText={
            status === "loading"
              ? "Reading your collections…"
              : status === "unavailable"
                ? "Your collections couldn't be read from your node, so this product's stay as they are."
                : "Where it shows in your shop. Collections publish with your other changes."
          }
        />
      )}
    />
  );
}
