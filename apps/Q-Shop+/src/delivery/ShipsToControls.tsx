/**
 * "Ships to" for lists (the Shops and Products pages): Anywhere, the buyer's
 * own country (buyerPlace.ts), the one chosen if another, or "Choose a
 * country…", which also becomes the buyer's country for delivery prices. A
 * select on desktop, chips in a phone's filter sheet.
 */
import { Suspense, useState } from "react";
import { Box, Chip, MenuItem, TextField, Typography } from "@mui/material";
import { selectMenuProps } from "../components/common/menuStyle";
import { countryCode, countryName } from "../constants/shipping";
import { parseShips } from "../discovery/sortFilter";
import type { BuyerPlace } from "./buyerPlace";
import { lazyWithRetry } from "../utils/lazyWithRetry";

const PlacePickerDialog = lazyWithRetry(() => import("./PlacePickerDialog").then((m) => ({ default: m.PlacePickerDialog })));

const ANY = "any";
const PICK = "pick";

/** The countries offered: the buyer's, and the one picked if another. */
function choices(value: string, place: BuyerPlace | null): string[] {
  const mine = place ? countryCode(place.country) : null;
  return [...new Set([mine, value].filter((c): c is string => !!c))];
}

function Picker({ place, open, onClose, onChange }: { place: BuyerPlace | null; open: boolean; onClose: () => void; onChange: (code: string) => void }) {
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <PlacePickerDialog place={place} onClose={onClose} onPicked={(next) => onChange(parseShips(countryCode(next.country)))} />
    </Suspense>
  );
}

interface Props {
  /** A country code, or "" for anywhere. */
  value: string;
  place: BuyerPlace | null;
  onChange: (code: string) => void;
}

export function ShipsToSelect({ value, place, onChange, sx }: Props & { sx?: object }) {
  const [picking, setPicking] = useState(false);
  return (
    <>
      <TextField
        select
        size="small"
        label="Ships to"
        value={value || ANY}
        onChange={(event) => (event.target.value === PICK ? setPicking(true) : onChange(parseShips(event.target.value === ANY ? "" : event.target.value)))}
        slotProps={{ select: { MenuProps: selectMenuProps } }}
        sx={{ minWidth: 190, maxWidth: 260, ...sx }}
      >
        <MenuItem value={ANY}>Anywhere</MenuItem>
        {choices(value, place).map((code) => (
          <MenuItem key={code} value={code}>
            {countryName(code)}
          </MenuItem>
        ))}
        <MenuItem value={PICK}>Choose a country…</MenuItem>
      </TextField>
      <Picker place={place} open={picking} onClose={() => setPicking(false)} onChange={onChange} />
    </>
  );
}

export function ShipsToChips({ value, place, onChange, chipSx, headingId }: Props & { chipSx?: object; headingId: string }) {
  const [picking, setPicking] = useState(false);
  return (
    <Box role="group" aria-labelledby={headingId}>
      <Typography id={headingId} sx={{ fontWeight: 700, mb: 1 }}>
        Ships to
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {["", ...choices(value, place)].map((code) => (
          <Chip
            key={code || ANY}
            label={code ? countryName(code) : "Anywhere"}
            clickable
            onClick={() => onChange(code)}
            color={value === code ? "primary" : "default"}
            variant={value === code ? "filled" : "outlined"}
            aria-pressed={value === code}
            sx={chipSx}
          />
        ))}
        <Chip label="Choose a country…" clickable variant="outlined" onClick={() => setPicking(true)} aria-haspopup="dialog" sx={chipSx} />
      </Box>
      <Picker place={place} open={picking} onClose={() => setPicking(false)} onChange={onChange} />
    </Box>
  );
}
