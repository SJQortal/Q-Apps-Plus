/**
 * One delivery zone of a shipping profile (delivery/model.ts): where it goes
 * (countries by region, and US states, with seller/ShipsToPicker.tsx), what
 * delivering one item costs, what each extra item adds, and from what amount
 * of items it's free, with a worked example under them. Amounts in the
 * shop's currency (or QORT).
 */
import { useState } from "react";
import { Box, Button, InputAdornment, TextField, Typography } from "@mui/material";
import { ResponsiveDialog } from "../components/common/mobile";
import { priceDecimals, sanitizeFiatInput } from "../money/fiatPricing";
import { deliveryMoney } from "../delivery/model";
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
  // Any change answers the last message: it is shown again only if Save finds it still wrong.
  const typed = (set: (v: string) => void) => (e: { target: { value: string } }) => {
    set(clean(e.target.value));
    setError(null);
  };
  const amountField = {
    htmlInput: { inputMode: "decimal" as const },
    input: { endAdornment: <InputAdornment position="end">{currency}</InputAdornment> },
    // Always above the box: a long label beside the currency would run into it.
    inputLabel: { shrink: true },
  };
  const firstValue = parseDeliveryAmount(first, currency);
  const extraValue = extra.trim() ? parseDeliveryAmount(extra, currency) : 0;
  const freeValue = freeOver.trim() ? parseDeliveryAmount(freeOver, currency) : 0;
  const money = (v: number) => deliveryMoney(v, currency);
  const example =
    Number.isFinite(firstValue) && Number.isFinite(extraValue) && Number.isFinite(freeValue)
      ? [
          `1 item: ${firstValue > 0 ? money(firstValue) : "free"}`,
          ...(extraValue > 0 ? [`3 items: ${money(firstValue)} + 2 × ${money(extraValue)} = ${money(firstValue + 2 * extraValue)}`] : []),
          ...(freeValue > 0 ? [`Free when the items in the order come to ${money(freeValue)} or more`] : []),
        ]
      : null;

  const save = () => {
    setError(null);
    if (countries.length === 0) return setError("Tick where this zone delivers to.");
    if (!Number.isFinite(firstValue)) return setError(`Type what delivering one item costs, in ${currency} (0 for free).`);
    if (!Number.isFinite(extraValue)) return setError("Check what each extra item adds.");
    if (!Number.isFinite(freeValue)) return setError("Check the amount from which delivery is free.");
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
        <ShipsToPicker
          value={countries}
          onChange={(next) => {
            setCountries(next);
            setError(null);
          }}
          states={states}
          onStatesChange={(next) => {
            setStates(next);
            setError(null);
          }}
          title="Delivers to"
        />
        <Typography sx={{ fontWeight: 600 }}>Price</Typography>
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(3, minmax(0, 1fr))" } }}>
          <TextField
            label="First item"
            required
            value={first}
            onChange={typed(setFirst)}
            placeholder="0.00"
            helperText="Delivering one item. 0: free"
            slotProps={amountField}
          />
          <TextField
            label="Each extra item"
            value={extra}
            onChange={typed(setExtra)}
            placeholder="0.00"
            helperText="Optional: added for every item after the first"
            slotProps={amountField}
          />
          <TextField
            label="Free delivery from"
            value={freeOver}
            onChange={typed(setFreeOver)}
            placeholder="None"
            helperText="Optional: when the items come to this much"
            slotProps={amountField}
          />
        </Box>
        {example && (
          <Box role="status" aria-label="Example" sx={{ p: 1.5, borderRadius: 1.5, bgcolor: "action.hover" }}>
            {example.map((line) => (
              <Typography key={line} variant="body2" sx={{ overflowWrap: "anywhere" }}>
                {line}
              </Typography>
            ))}
          </Box>
        )}
        {error && (
          <Typography role="alert" color="error">
            {error}
          </Typography>
        )}
      </Box>
    </ResponsiveDialog>
  );
}
