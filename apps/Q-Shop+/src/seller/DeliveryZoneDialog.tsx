/**
 * One delivery zone of a shipping profile (delivery/model.ts): where it goes
 * (countries by region, and US states, with seller/ShipsToPicker.tsx), what
 * the first item costs, each item after it, and the amount over which it's
 * free. Amounts in the shop's currency (or QORT).
 */
import { useState } from "react";
import { Box, Button, InputAdornment, TextField, Typography } from "@mui/material";
import { ResponsiveDialog } from "../components/common/mobile";
import { priceDecimals, sanitizeFiatInput } from "../money/fiatPricing";
import { shippingSummaryWithStates, US } from "../constants/shipping";
import type { DeliveryZone } from "../delivery/model";
import { sanitizeAmountInput } from "./productDraft";
import { ShipsToPicker } from "./ShipsToPicker";

/** A typed amount, 0 included (free); NaN when it isn't one. */
export function parseDeliveryAmount(text: string, currency: string): number {
  const t = text.trim();
  const decimals = currency === "QORT" ? 8 : priceDecimals(currency);
  if (!t || t === "." || !new RegExp(`^\\d*\\.?\\d{0,${decimals}}$`).test(t)) return NaN;
  return Number(t);
}

const asText = (value: number | undefined) => (value === undefined ? "" : String(value));

export function DeliveryZoneDialog({
  zone,
  currency,
  newId,
  onSave,
  onClose,
}: {
  /** The zone to edit, or null for a new one. */
  zone: DeliveryZone | null;
  currency: string;
  newId: () => string;
  onSave: (zone: DeliveryZone) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(zone?.name ?? "");
  const [countries, setCountries] = useState<string[]>(zone?.countries ?? []);
  const [states, setStates] = useState<string[] | null>(zone?.states ?? null);
  const [first, setFirst] = useState(asText(zone?.first));
  const [extra, setExtra] = useState(asText(zone?.extra));
  const [freeOver, setFreeOver] = useState(asText(zone?.freeOver));
  const [error, setError] = useState<string | null>(null);
  const clean = (text: string) => (currency === "QORT" ? sanitizeAmountInput(text) : sanitizeFiatInput(text, priceDecimals(currency)));
  const unit = <InputAdornment position="end">{currency}</InputAdornment>;

  const save = () => {
    setError(null);
    if (countries.length === 0) return setError("Tick where this zone delivers to.");
    const firstValue = parseDeliveryAmount(first, currency);
    if (!Number.isFinite(firstValue)) return setError(`Type what delivery costs, in ${currency} (0 for free).`);
    const extraValue = extra.trim() ? parseDeliveryAmount(extra, currency) : 0;
    const freeValue = freeOver.trim() ? parseDeliveryAmount(freeOver, currency) : 0;
    if (!Number.isFinite(extraValue)) return setError("Check the price for each item after the first.");
    if (!Number.isFinite(freeValue)) return setError("Check the amount over which delivery is free.");
    if (countries.includes(US) && states?.length === 0) return setError("Tick the US states this zone delivers to, or untick the United States.");
    onSave({
      id: zone?.id ?? newId(),
      ...(name.trim() && { name: name.trim().slice(0, 60) }),
      countries,
      ...(countries.includes(US) && states && { states }),
      first: firstValue,
      ...(extraValue > 0 && { extra: extraValue }),
      ...(freeValue > 0 && { freeOver: freeValue }),
    });
  };

  return (
    <ResponsiveDialog
      open
      onClose={onClose}
      title={zone ? "Edit delivery zone" : "New delivery zone"}
      maxWidth="sm"
      actions={
        <>
          <Button color="inherit" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="contained" onClick={save}>
            Save zone
          </Button>
        </>
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <TextField
          label="Zone name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={countries.length ? shippingSummaryWithStates(countries, states) : "Europe, Domestic…"}
          fullWidth
          slotProps={{ htmlInput: { maxLength: 60 } }}
        />
        <ShipsToPicker value={countries} onChange={setCountries} states={states} onStatesChange={setStates} title="Delivers to" />
        <Typography sx={{ fontWeight: 600 }}>Price</Typography>
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(3, minmax(0, 1fr))" } }}>
          <TextField
            label="First item"
            required
            value={first}
            onChange={(e) => setFirst(clean(e.target.value))}
            helperText="0 for free delivery"
            slotProps={{ htmlInput: { inputMode: "decimal" }, input: { endAdornment: unit } }}
          />
          <TextField
            label="Each item more"
            value={extra}
            onChange={(e) => setExtra(clean(e.target.value))}
            helperText="Optional"
            slotProps={{ htmlInput: { inputMode: "decimal" }, input: { endAdornment: unit } }}
          />
          <TextField
            label="Free over"
            value={freeOver}
            onChange={(e) => setFreeOver(clean(e.target.value))}
            helperText="Optional: the order's items"
            slotProps={{ htmlInput: { inputMode: "decimal" }, input: { endAdornment: unit } }}
          />
        </Box>
        {error && (
          <Typography role="alert" color="error">
            {error}
          </Typography>
        )}
      </Box>
    </ResponsiveDialog>
  );
}
