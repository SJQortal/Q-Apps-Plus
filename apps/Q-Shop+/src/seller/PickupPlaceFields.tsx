/**
 * A pickup point's details in the Delivery tab (delivery/model.ts
 * PickupPlace): its country, address, the days it's open and its hours.
 * Buyers in that country see "Collect at …" with them, and pick it free.
 */
import { useMemo } from "react";
import { Autocomplete, Box, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { autocompletePaperProps } from "../components/common/menuStyle";
import { ALL_COUNTRY_CODES, countryName } from "../constants/shipping";
import { matchCountries } from "../constants/countrySearch";
import { DAY_NAME, WEEK_ORDER, type PickupPlace } from "../delivery/model";
import { TimeField } from "../components/common/DateTimeFields";

export const NEW_PICKUP_PLACE: PickupPlace = { country: "", address: "", days: [1, 2, 3, 4, 5], from: "10:00", to: "18:00" };

export function PickupPlaceFields({ place, onChange, disabled, name }: { place: PickupPlace; onChange: (place: PickupPlace) => void; disabled: boolean; name: string }) {
  const countries = useMemo(() => [...ALL_COUNTRY_CODES].sort((a, b) => countryName(a).localeCompare(countryName(b))), []);
  return (
    <Box
      role="group"
      aria-label={`Pickup point: ${name || "this option"}`}
      sx={{ gridColumn: "1 / -1", display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 1fr) minmax(0, 2fr)" }, p: 1.5, mt: -0.5, borderRadius: 1.5, border: 1, borderColor: "divider" }}
    >
      <Autocomplete
        options={countries}
        value={place.country || null}
        onChange={(_, value) => onChange({ ...place, country: value ?? "" })}
        getOptionLabel={(code) => countryName(code)}
        filterOptions={(codes, { inputValue }) => matchCountries(codes, inputValue, countryName, (code) => code)}
        disabled={disabled}
        disablePortal
        autoHighlight
        slotProps={{ paper: autocompletePaperProps }}
        renderInput={(params) => <TextField {...params} label="Country" required error={!place.country} />}
      />
      <TextField
        label="Pickup address"
        value={place.address}
        onChange={(e) => onChange({ ...place, address: e.target.value.slice(0, 160) })}
        placeholder="Rua Augusta 10, Lisbon"
        required
        error={!place.address.trim()}
        disabled={disabled}
      />
      <Box sx={{ gridColumn: "1 / -1", minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }} id={`days-${name}`}>
          Open on
        </Typography>
        <ToggleButtonGroup
          value={place.days}
          onChange={(_, days: number[]) => onChange({ ...place, days: WEEK_ORDER.filter((d) => days.includes(d)) })}
          aria-labelledby={`days-${name}`}
          disabled={disabled}
          size="small"
          sx={{ flexWrap: "wrap", "& .MuiToggleButton-root": { minWidth: 48, minHeight: 44, textTransform: "none" } }}
        >
          {WEEK_ORDER.map((d) => (
            <ToggleButton key={d} value={d}>
              {DAY_NAME[d]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {place.days.length === 0 && (
          <Typography variant="body2" color="error" sx={{ mt: 0.5 }}>
            Pick the days it&apos;s open.
          </Typography>
        )}
      </Box>
      <Box sx={{ gridColumn: "1 / -1", display: "flex", gap: 1.5, flexWrap: "wrap" }}>
        <TimeField label="From" value={place.from ?? ""} onChange={(from) => onChange({ ...place, from })} disabled={disabled} sx={{ flex: "1 1 140px" }} />
        <TimeField label="To" value={place.to ?? ""} onChange={(to) => onChange({ ...place, to })} disabled={disabled} sx={{ flex: "1 1 140px" }} />
      </Box>
    </Box>
  );
}
