/**
 * The delivery address of a physical order, in the original's fields: name,
 * street, city, country, state (United States) or region (elsewhere), zip
 * code and an optional note. Checked with money/order.ts
 * missingDeliveryFields; errors show per field once the buyer tries to go
 * on. The form loads only for physical orders (React.lazy in its callers),
 * and the country and state lists on first use, so they stay out of every
 * other chunk. On phones a focused field scrolls into view above the
 * keyboard (the dialog around it follows the visual viewport).
 */
import { useEffect, useState, type FocusEvent } from "react";
import { Autocomplete, Box, TextField } from "@mui/material";
import { US, missingDeliveryFields, type DeliveryInput } from "../../money/order";
import { deliveryFieldId } from "./delivery";
import { autocompletePaperProps } from "../../components/common/menuStyle";

interface PlaceOption {
  text: string;
  value: string;
}

const loadCountries = () => import("../../constants/countries.json").then((m) => (m.default as PlaceOption[]).map((o) => o.text));
const loadStates = () => import("../../constants/states.json").then((m) => (m.default as PlaceOption[]).map((o) => o.text));

const MESSAGES: Partial<Record<keyof DeliveryInput, string>> = {
  customerName: "Enter the name to deliver to",
  streetAddress: "Enter the street address",
  city: "Enter the city",
  country: "Choose a country",
  state: "Choose a state",
  region: "Enter the region",
  zipCode: "Enter the zip code",
};

function keepInView(event: FocusEvent<HTMLElement>) {
  const el = event.target;
  // After the keyboard has opened and the viewport has shrunk.
  window.setTimeout(() => el.scrollIntoView?.({ block: "nearest" }), 300);
}

function usePlaces(load: () => Promise<string[]>, enabled: boolean): string[] | null {
  const [places, setPlaces] = useState<string[] | null>(null);
  useEffect(() => {
    if (!enabled || places) return;
    let alive = true;
    load().then(
      (list) => {
        if (alive) setPlaces(list);
      },
      () => {
        if (alive) setPlaces([]);
      }
    );
    return () => {
      alive = false;
    };
  }, [enabled, places, load]);
  return places;
}

export function DeliveryForm({
  value,
  onChange,
  showErrors,
  idPrefix,
}: {
  value: DeliveryInput;
  onChange: (next: DeliveryInput) => void;
  /** Show what's missing (after the buyer pressed Continue once). */
  showErrors: boolean;
  idPrefix: string;
}) {
  const isUS = value.country === US;
  const countries = usePlaces(loadCountries, true);
  const states = usePlaces(loadStates, isUS);
  const missing = new Set(showErrors ? missingDeliveryFields(value) : []);

  const text = (field: keyof DeliveryInput, label: string, autoComplete: string, extra: { required?: boolean; multiline?: boolean } = {}) => (
    <TextField
      id={deliveryFieldId(idPrefix, field)}
      label={label}
      value={value[field]}
      onChange={(e) => onChange({ ...value, [field]: e.target.value })}
      onFocus={keepInView}
      required={extra.required ?? true}
      multiline={extra.multiline}
      minRows={extra.multiline ? 2 : undefined}
      error={missing.has(field)}
      helperText={missing.has(field) ? MESSAGES[field] : undefined}
      fullWidth
      slotProps={{ htmlInput: { autoComplete } }}
    />
  );

  const place = (
    field: "country" | "state",
    label: string,
    options: string[] | null
  ) => (
    <Autocomplete
      id={deliveryFieldId(idPrefix, field)}
      options={options ?? []}
      loading={!options}
      value={value[field] || null}
      onChange={(_, next) => onChange({ ...value, [field]: next ?? "" })}
      autoHighlight
      fullWidth
      slotProps={{ paper: autocompletePaperProps }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required
          onFocus={keepInView}
          error={missing.has(field)}
          helperText={missing.has(field) ? MESSAGES[field] : undefined}
        />
      )}
    />
  );

  return (
    <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
      <Box sx={{ gridColumn: "1 / -1" }}>{text("customerName", "Customer name", "name")}</Box>
      <Box sx={{ gridColumn: "1 / -1" }}>{text("streetAddress", "Street address", "street-address")}</Box>
      {text("city", "City", "address-level2")}
      {text("zipCode", "Zip code", "postal-code")}
      {place("country", "Country", countries)}
      {isUS ? place("state", "State", states) : text("region", "Region", "address-level1")}
      <Box sx={{ gridColumn: "1 / -1" }}>
        {text("deliveryNote", "Delivery note (optional)", "off", { required: false, multiline: true })}
      </Box>
    </Box>
  );
}
