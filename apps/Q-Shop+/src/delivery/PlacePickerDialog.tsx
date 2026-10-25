/**
 * Where the buyer gets things delivered (buyerPlace.ts): a country, and a
 * state in the United States, typed to find. Kept on this device for every
 * product page's delivery prices; checkout still asks for the full address.
 */
import { useMemo, useState } from "react";
import { Autocomplete, Box, Button, TextField, Typography } from "@mui/material";
import { ResponsiveDialog } from "../components/common/mobile";
import { autocompletePaperProps } from "../components/common/menuStyle";
import { ALL_COUNTRY_CODES, ALL_STATE_CODES, US, countryCode, countryName, stateName } from "../constants/shipping";
import { cleanPlace, setBuyerPlace, type BuyerPlace } from "./buyerPlace";

const byName = (a: string, b: string) => a.localeCompare(b);

export function PlacePickerDialog({ place, onClose }: { place: BuyerPlace | null; onClose: () => void }) {
  const countries = useMemo(() => ALL_COUNTRY_CODES.map(countryName).sort(byName), []);
  const states = useMemo(() => ALL_STATE_CODES.map(stateName).sort(byName), []);
  const [country, setCountry] = useState<string | null>(place?.country ?? null);
  const [state, setState] = useState<string | null>(place?.state || null);
  const inUs = countryCode(country) === US;
  const save = () => {
    const next = cleanPlace({ country, state: inUs ? state : "" });
    if (!next) return;
    setBuyerPlace(next);
    onClose();
  };
  return (
    <ResponsiveDialog
      open
      onClose={onClose}
      title="Where should things be delivered?"
      maxWidth="xs"
      actions={
        <>
          {place && (
            <Button
              color="inherit"
              onClick={() => {
                setBuyerPlace(null);
                onClose();
              }}
              sx={{ mr: "auto" }}
            >
              Forget it
            </Button>
          )}
          <Button color="inherit" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="contained" onClick={save} disabled={!country}>
            Show prices
          </Button>
        </>
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Product pages then show what delivery costs there. It stays on this device; checkout asks for your full address.
        </Typography>
        <Autocomplete
          // The list stays inside the dialog (its landmark).
          disablePortal
          slotProps={{ paper: autocompletePaperProps }}
          options={countries}
          value={country}
          onChange={(_, value) => {
            setCountry(value);
            setState(null);
          }}
          autoHighlight
          openOnFocus
          renderInput={(params) => <TextField {...params} label="Country" autoFocus />}
        />
        {inUs && (
          <Autocomplete
            disablePortal
            slotProps={{ paper: autocompletePaperProps }}
            options={states}
            value={state}
            onChange={(_, value) => setState(value)}
            autoHighlight
            openOnFocus
            renderInput={(params) => <TextField {...params} label="State (optional)" helperText="Some shops price states differently." />}
          />
        )}
      </Box>
    </ResponsiveDialog>
  );
}
