/**
 * One delivery zone of a shipping profile (delivery/model.ts): where it goes
 * (countries by region, and US states, with seller/ShipsToPicker.tsx), what
 * delivering one item costs, what each extra item adds, and from what amount
 * of items it's free, with a worked example under them. Amounts in the
 * shop's currency (or QORT). With delivery options (Express, Local pickup…),
 * each can be offered here at its own prices.
 */
import { useState } from "react";
import { Box, Button, FormControlLabel, InputAdornment, Switch, TextField, Typography } from "@mui/material";
import { ResponsiveDialog } from "../components/common/mobile";
import { priceDecimals, sanitizeFiatInput } from "../money/fiatPricing";
import { deliveryMoney } from "../delivery/model";
import { US } from "../constants/shipping";
import { BASE_OPTION_NAME, type DeliveryOption, type DeliveryRate, type DeliveryZone } from "../delivery/model";
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

type RateText = { first: string; extra: string; freeOver: string };
const rateText = (rate: DeliveryRate | undefined): RateText => ({ first: asText(rate?.first), extra: asText(rate?.extra), freeOver: asText(rate?.freeOver) });

export function DeliveryZoneDialog({
  zone,
  start,
  currency,
  newId,
  onSave,
  onClose,
  options = [],
  baseName,
}: {
  /** The zone to edit, or null for a new one. */
  zone: DeliveryZone | null;
  /** A new zone's starting places (everywhere the shop ships, say). */
  start?: Pick<DeliveryZone, "countries" | "states">;
  currency: string;
  newId: () => string;
  onSave: (zone: DeliveryZone) => void;
  onClose: () => void;
  /** The shop's other delivery options: each can be offered here at its own prices. */
  options?: DeliveryOption[];
  /** The zones' own prices' name, when the shop has options. */
  baseName?: string;
}) {
  const [countries, setCountries] = useState<string[]>(zone?.countries ?? start?.countries ?? []);
  const [states, setStates] = useState<string[] | null>(zone?.states ?? start?.states ?? null);
  const [first, setFirst] = useState(asText(zone?.first));
  const [extra, setExtra] = useState(asText(zone?.extra));
  const [freeOver, setFreeOver] = useState(asText(zone?.freeOver));
  // Each other option this zone offers, its prices as typed (absent: not offered here).
  const [rates, setRates] = useState<Record<string, RateText>>(() =>
    Object.fromEntries(options.filter((o) => zone?.rates?.[o.id]).map((o) => [o.id, rateText(zone?.rates?.[o.id])]))
  );
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
    const offered: Record<string, DeliveryRate> = {};
    for (const o of options) {
      const text = rates[o.id];
      if (!text) continue;
      const f = parseDeliveryAmount(text.first, currency);
      const x = text.extra.trim() ? parseDeliveryAmount(text.extra, currency) : 0;
      const fo = text.freeOver.trim() ? parseDeliveryAmount(text.freeOver, currency) : 0;
      if (!Number.isFinite(f)) return setError(`Type what ${o.name} costs for one item, in ${currency} (0 for free).`);
      if (!Number.isFinite(x) || !Number.isFinite(fo)) return setError(`Check the ${o.name} prices.`);
      offered[o.id] = { first: f, ...(x > 0 && { extra: x }), ...(fo > 0 && { freeOver: fo }) };
    }
    onSave({
      id: zone?.id ?? newId(),
      countries,
      ...(countries.includes(US) && states && { states }),
      first: firstValue,
      ...(extraValue > 0 && { extra: extraValue }),
      ...(freeValue > 0 && { freeOver: freeValue }),
      ...(Object.keys(offered).length > 0 && { rates: offered }),
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
        <Typography sx={{ fontWeight: 600 }}>{options.length > 0 ? `Price: ${baseName || BASE_OPTION_NAME}` : "Price"}</Typography>
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
        {options.map((o) => {
          const text = rates[o.id];
          const set = (key: keyof RateText) => (e: { target: { value: string } }) => {
            setRates((prev) => ({ ...prev, [o.id]: { ...(prev[o.id] ?? rateText(undefined)), [key]: clean(e.target.value) } }));
            setError(null);
          };
          return (
            <Box key={o.id} component="section" aria-label={`${o.name} in this zone`} sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={!!text}
                    onChange={(_, on) =>
                      setRates((prev) => {
                        const next = { ...prev };
                        if (on) next[o.id] = rateText(undefined);
                        else delete next[o.id];
                        return next;
                      })
                    }
                  />
                }
                label={`Offer ${o.name} here`}
                sx={{ m: 0, minHeight: 44 }}
              />
              {text && (
                <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(3, minmax(0, 1fr))" } }}>
                  <TextField label="First item" required value={text.first} onChange={set("first")} placeholder="0.00" helperText="0: free (a pickup, say)" slotProps={amountField} />
                  <TextField label="Each extra item" value={text.extra} onChange={set("extra")} placeholder="0.00" helperText="Optional" slotProps={amountField} />
                  <TextField label="Free delivery from" value={text.freeOver} onChange={set("freeOver")} placeholder="None" helperText="Optional" slotProps={amountField} />
                </Box>
              )}
            </Box>
          );
        })}
        {error && (
          <Typography role="alert" color="error">
            {error}
          </Typography>
        )}
      </Box>
    </ResponsiveDialog>
  );
}
