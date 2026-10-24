/**
 * The product form's Variants (variants/drafts.ts): options of the seller's
 * own (Size, Colour, Scent…) and their values, how lists show the variants,
 * and each combination's price and picture. Off: one product, as before.
 */
import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import { sanitizeAmountInput } from "../seller/productDraft";
import { priceDecimals, sanitizeFiatInput } from "../money/fiatPricing";
import { MAX_OPTION_TEXT, MAX_OPTION_VALUES, MAX_VARIANTS, MAX_VARIANT_OPTIONS, combinations, valuesKey, type VariantDisplay } from "./model";
import { NO_ROW, usedOptions, type VariantFormValues } from "./drafts";

export const EMPTY_VARIANTS: VariantFormValues = { options: [{ name: "", values: [] }], display: "bundle", rows: {} };

function ValuesField({ label, values, onChange }: { label: string; values: string[]; onChange: (values: string[]) => void }) {
  const [text, setText] = useState("");
  const add = () => {
    const parts = text
      .split(",")
      .map((v) => v.trim().slice(0, MAX_OPTION_TEXT))
      .filter(Boolean);
    const next = [...values];
    for (const p of parts) if (!next.some((v) => v.toLowerCase() === p.toLowerCase()) && next.length < MAX_OPTION_VALUES) next.push(p);
    onChange(next);
    setText("");
  };
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
      {values.length > 0 && (
        <Box component="ul" aria-label={`${label} values`} sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          {values.map((v) => (
            <li key={v}>
              {/* A deletable chip is a button: Delete or Backspace removes it, as does its cross. */}
              <Chip label={v} aria-label={`Remove ${v}`} onDelete={() => onChange(values.filter((x) => x !== v))} />
            </li>
          ))}
        </Box>
      )}
      <TextField
        size="small"
        label={`${label}: add values`}
        placeholder="Type, then Enter (or commas: S, M, L)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !text && values.length > 0) onChange(values.slice(0, -1));
        }}
        onBlur={() => text.trim() && add()}
        disabled={values.length >= MAX_OPTION_VALUES}
        slotProps={{
          htmlInput: { maxLength: 200 },
          input: {
            endAdornment: text.trim() ? (
              <InputAdornment position="end">
                <Button size="small" onClick={add}>
                  Add
                </Button>
              </InputAdornment>
            ) : undefined,
          },
        }}
      />
    </Box>
  );
}

export function VariantsEditor({
  value,
  onChange,
  images,
  unit,
  basePrice,
}: {
  /** null: no variants. */
  value: VariantFormValues | null;
  onChange: (next: VariantFormValues | null) => void;
  images: string[];
  /** The variants' price unit: QORT, or the shop's currency. */
  unit: string;
  /** The product's price as typed, each variant's when it has none of its own. */
  basePrice: string;
}) {
  const on = value !== null;
  const form = value ?? EMPTY_VARIANTS;
  const set = (patch: Partial<VariantFormValues>) => onChange({ ...form, ...patch });
  const options = usedOptions(form);
  const total = options.reduce((n, o) => n * o.values.length, options.length ? 1 : 0);
  const all = combinations(options);
  const cleanPrice = (text: string) => (unit === "QORT" ? sanitizeAmountInput(text) : sanitizeFiatInput(text, priceDecimals(unit)));
  const setRow = (key: string, patch: Partial<typeof NO_ROW>) => set({ rows: { ...form.rows, [key]: { ...(form.rows[key] ?? NO_ROW), ...patch } } });

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <FormControlLabel
        control={<Switch checked={on} onChange={(_, next) => onChange(next ? EMPTY_VARIANTS : null)} />}
        label={
          <Box>
            <Typography sx={{ fontWeight: 600 }}>It comes in variants</Typography>
            <Typography variant="body2" color="text.secondary">
              Sizes, colours, scents… each with its own price, stock and picture.
            </Typography>
          </Box>
        }
        sx={{ alignItems: "flex-start", m: 0, gap: 1, "& .MuiSwitch-root": { mt: -0.5 } }}
      />
      {on && (
        <>
          <Box component="ol" aria-label="Options" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {form.options.map((option, i) => (
              <Box
                component="li"
                key={i}
                sx={{ display: "grid", gap: 1.5, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr) 44px", sm: "200px minmax(0, 1fr) 44px" } }}
              >
                <TextField
                  size="small"
                  label={`Option ${i + 1}`}
                  placeholder={["Size", "Colour", "Material"][i] ?? "Option"}
                  value={option.name}
                  onChange={(e) => set({ options: form.options.map((o, j) => (j === i ? { ...o, name: e.target.value.slice(0, MAX_OPTION_TEXT) } : o)) })}
                  sx={{ gridColumn: { xs: "1", sm: "1" } }}
                />
                <Box sx={{ gridColumn: { xs: "1 / -1", sm: "2" }, gridRow: { xs: "2", sm: "1" }, minWidth: 0 }}>
                  <ValuesField
                    label={option.name.trim() || `Option ${i + 1}`}
                    values={option.values}
                    onChange={(values) => set({ options: form.options.map((o, j) => (j === i ? { ...o, values } : o)) })}
                  />
                </Box>
                <IconButton
                  aria-label={`Remove ${option.name.trim() || `option ${i + 1}`}`}
                  onClick={() => (form.options.length === 1 ? onChange(null) : set({ options: form.options.filter((_, j) => j !== i) }))}
                  sx={{ width: 44, height: 44, gridColumn: { xs: "2", sm: "3" }, gridRow: "1" }}
                >
                  <CloseIcon />
                </IconButton>
              </Box>
            ))}
          </Box>
          {form.options.length < MAX_VARIANT_OPTIONS && (
            <Button startIcon={<AddIcon />} onClick={() => set({ options: [...form.options, { name: "", values: [] }] })} sx={{ alignSelf: "flex-start", minHeight: 44 }}>
              Add another option
            </Button>
          )}

          <Box>
            <Typography id="variants-display-label" variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
              In the shop&apos;s lists
            </Typography>
            <ToggleButtonGroup
              exclusive
              value={form.display}
              onChange={(_, display: VariantDisplay | null) => display && set({ display })}
              aria-labelledby="variants-display-label"
              sx={{ flexWrap: "wrap", "& .MuiToggleButton-root": { minHeight: 44, px: 2, textTransform: "none" } }}
            >
              <ToggleButton value="bundle">One listing, buyers choose</ToggleButton>
              <ToggleButton value="separate">Each variant on its own</ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {form.display === "bundle"
                ? "One card for the product, with its lowest price; buyers pick the variant on its page."
                : "A card for each variant, with its own picture; its page lets buyers switch to the others."}
            </Typography>
          </Box>

          {total > MAX_VARIANTS ? (
            <Typography role="alert" color="error">
              That makes {total} variants: {MAX_VARIANTS} at most. Use fewer values.
            </Typography>
          ) : all.length > 0 ? (
            <Box component="ul" aria-label="Variants" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1 }}>
              {all.map((combo, i) => {
                const key = valuesKey(combo);
                const row = form.rows[key] ?? NO_ROW;
                const label = combo.join(" / ");
                return (
                  <Box
                    component="li"
                    key={key}
                    sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", p: 1, border: 1, borderColor: "divider", borderRadius: 1.5 }}
                  >
                    <Typography sx={{ fontWeight: 600, flex: "1 1 140px", minWidth: 0, overflowWrap: "anywhere" }}>
                      {label}
                      {i === 0 && (
                        <Typography component="span" variant="body2" color="text.secondary">
                          {" "}
                          · shows all the pictures
                        </Typography>
                      )}
                    </Typography>
                    <TextField
                      size="small"
                      label="Price"
                      value={row.price}
                      onChange={(e) => setRow(key, { price: cleanPrice(e.target.value) })}
                      placeholder={basePrice || "Same"}
                      slotProps={{
                        htmlInput: { inputMode: "decimal", autoComplete: "off", "aria-label": `Price of ${label} in ${unit}` },
                        input: { endAdornment: <InputAdornment position="end">{unit}</InputAdornment> },
                        inputLabel: { shrink: true },
                      }}
                      sx={{ width: 170 }}
                    />
                    {images.length > 1 && (
                      <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={row.picture}
                        onChange={(_, picture: number | null) => setRow(key, { picture })}
                        aria-label={`Picture of ${label}`}
                        sx={{ flexWrap: "wrap", gap: 0.5, "& .MuiToggleButton-root": { p: 0.25, border: 1, borderColor: "divider", borderRadius: "8px !important" }, "& .Mui-selected": { borderColor: "primary.main" } }}
                      >
                        {images.map((img, n) => (
                          <ToggleButton key={n} value={n} aria-label={`Picture ${n + 1}`}>
                            <Box component="img" src={img} alt="" sx={{ width: 36, height: 36, objectFit: "cover", borderRadius: 1, display: "block" }} />
                          </ToggleButton>
                        ))}
                      </ToggleButtonGroup>
                    )}
                  </Box>
                );
              })}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Name an option and give it values: its variants show here.
            </Typography>
          )}
          {all.length > 0 && total <= MAX_VARIANTS && (
            <Typography variant="body2" color="text.secondary">
              {all.length} variants, each a product of its own (so Q-Shop lists them too), named for its options. An empty price is the product&apos;s;
              a picture not picked is its first. The first variant carries every picture; the others their own.
            </Typography>
          )}
        </>
      )}
    </Box>
  );
}
