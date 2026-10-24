/**
 * A variant's choices on its product page (variants/model.ts): each option's
 * values, the variant's own selected. A choice opens the variant it leads to
 * (its own page, so a link to it is that variant); one with no variant is
 * off, one out of stock says so.
 */
import { Box, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { variantFor, type VariantOption, type VariantSibling } from "./model";

const OUT_OF_STOCK = "OUT_OF_STOCK";

export function VariantPicker({
  options,
  values,
  siblings,
  onPick,
}: {
  options: VariantOption[];
  values: string[];
  siblings: VariantSibling[];
  onPick: (sibling: VariantSibling) => void;
}) {
  return (
    <Box component="section" aria-label="Variants" sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {options.map((option, i) => (
        <Box key={option.name}>
          <Typography id={`variant-option-${i}`} variant="body2" sx={{ mb: 0.75 }}>
            <Box component="span" sx={{ color: "text.secondary" }}>
              {option.name}:
            </Box>{" "}
            <strong>{values[i]}</strong>
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={values[i]}
            onChange={(_, value: string | null) => {
              if (!value) return;
              const next = variantFor(siblings, values, i, value);
              if (next) onPick(next);
            }}
            aria-labelledby={`variant-option-${i}`}
            sx={{ flexWrap: "wrap", gap: 1, "& .MuiToggleButton-root": { minHeight: 44, minWidth: 44, px: 1.75, textTransform: "none", borderRadius: "8px !important", border: 1, borderColor: "divider" }, "& .Mui-selected": { borderColor: "primary.main" } }}
          >
            {option.values.map((value) => {
              const target = variantFor(siblings, values, i, value);
              const out = target?.status === OUT_OF_STOCK;
              return (
                <ToggleButton key={value} value={value} disabled={!target} aria-label={out ? `${value} (out of stock)` : value} sx={out ? { textDecoration: "line-through", color: "text.secondary" } : undefined}>
                  {value}
                </ToggleButton>
              );
            })}
          </ToggleButtonGroup>
        </Box>
      ))}
    </Box>
  );
}
