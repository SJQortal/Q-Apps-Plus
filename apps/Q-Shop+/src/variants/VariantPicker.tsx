/**
 * An item's choices on its product page (variants/model.ts): the variants
 * (Round, Square…), then the chosen variant's values (Pale, Orange…, with
 * their colours). A choice opens the item it leads to (its own page, so a
 * link to it is that item); one out of stock is struck through and says so.
 */
import { Box, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { itemForValue, itemForVariant, type VariantOption, type VariantSibling } from "./model";

const OUT_OF_STOCK = "OUT_OF_STOCK";

const buttonsSx = {
  flexWrap: "wrap",
  gap: 1,
  "& .MuiToggleButton-root": { minHeight: 44, minWidth: 44, px: 1.75, gap: 1, textTransform: "none", borderRadius: "8px !important", border: 1, borderColor: "divider" },
  "& .Mui-selected": { borderColor: "primary.main" },
} as const;

export function VariantPicker({
  options,
  values,
  siblings,
  onPick,
}: {
  options: VariantOption[];
  /** The item shown: its variant, and its value. */
  values: string[];
  siblings: VariantSibling[];
  onPick: (sibling: VariantSibling) => void;
}) {
  const current = options.find((o) => o.name === values[0]);
  const struck = (target: VariantSibling | null) => (target?.status === OUT_OF_STOCK ? { textDecoration: "line-through", color: "text.secondary" } : undefined);
  return (
    <Box component="section" aria-label="Variants" sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {options.length > 1 && (
        <Box>
          <Typography id="variant-choice-variant" variant="body2" sx={{ mb: 0.75 }}>
            <Box component="span" sx={{ color: "text.secondary" }}>
              Variant:
            </Box>{" "}
            <strong>{values[0]}</strong>
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={values[0]}
            onChange={(_, name: string | null) => {
              const next = name ? itemForVariant(siblings, values, name) : null;
              if (next) onPick(next);
            }}
            aria-labelledby="variant-choice-variant"
            sx={buttonsSx}
          >
            {options.map((o) => {
              const target = itemForVariant(siblings, values, o.name);
              const out = !!target && siblings.filter((s) => s.values[0] === o.name).every((s) => s.status === OUT_OF_STOCK);
              return (
                <ToggleButton key={o.name} value={o.name} disabled={!target} aria-label={out ? `${o.name} (out of stock)` : o.name} sx={out ? struck(target) : undefined}>
                  {o.name}
                </ToggleButton>
              );
            })}
          </ToggleButtonGroup>
        </Box>
      )}
      {current && current.values.length > 0 && (
        <Box>
          <Typography id="variant-choice-value" variant="body2" sx={{ mb: 0.75 }}>
            <Box component="span" sx={{ color: "text.secondary" }}>
              {options.length > 1 ? `${current.name}:` : "Choose:"}
            </Box>{" "}
            <strong>{values[1]}</strong>
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={values[1] ?? null}
            onChange={(_, value: string | null) => {
              const next = value ? itemForValue(siblings, values, value) : null;
              if (next) onPick(next);
            }}
            aria-labelledby="variant-choice-value"
            sx={buttonsSx}
          >
            {current.values.map((v) => {
              const target = itemForValue(siblings, values, v.name);
              const out = target?.status === OUT_OF_STOCK;
              return (
                <ToggleButton key={v.name} value={v.name} disabled={!target} aria-label={out ? `${v.name} (out of stock)` : v.name} sx={struck(target)}>
                  {v.color && <Box component="span" aria-hidden sx={{ width: 18, height: 18, borderRadius: "50%", bgcolor: v.color, border: 1, borderColor: "divider", flexShrink: 0 }} />}
                  {v.name}
                </ToggleButton>
              );
            })}
          </ToggleButtonGroup>
        </Box>
      )}
    </Box>
  );
}
