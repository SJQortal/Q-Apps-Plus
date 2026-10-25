/**
 * The home page's search field and its sort and filters: a row on desktop,
 * a "Sort & filter" button and a bottom sheet on phones (docs/DESIGN.md →
 * Mobile: menus and filters open as sheets).
 */
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Box,
  Button,
  Chip,
  FormControl,
  FormControlLabel,
  FormLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Radio,
  RadioGroup,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";
import TuneIcon from "@mui/icons-material/Tune";
import { BottomSheet } from "../components/common/mobile/BottomSheet";
import { PHONE_MEDIA } from "../hooks/usePhoneLayout";
import { PAY_FILTERS, SHOP_SORTS, parsePay, parseShips, parseSort, type PayFilter, type ShopSort } from "./sortFilter";
import { selectMenuProps } from "../components/common/menuStyle";
import { countryCode, countryName } from "../constants/shipping";
import type { BuyerPlace } from "../delivery/buyerPlace";

const PlacePickerDialog = lazy(() => import("../delivery/PlacePickerDialog").then((m) => ({ default: m.PlacePickerDialog })));

export const SEARCH_DEBOUNCE_MS = 300;
/** The search text is capped like Hub caps a name search; Core matches substrings. */
const SEARCH_MAX_LENGTH = 100;

/**
 * The search field. It applies what is typed once typing pauses (300 ms), or
 * at once on Enter (which also closes a phone's keyboard), and follows the
 * URL when Back or a link changes `?q=`.
 */
export function ShopSearchField({ q, onSearch }: { q: string; onSearch: (text: string) => void }) {
  const [text, setText] = useState(q);
  const [seenQ, setSeenQ] = useState(q);
  const input = useRef<HTMLInputElement>(null);
  // The URL changed under the field (Back, a link): show what it searches for.
  if (seenQ !== q) {
    setSeenQ(q);
    if (text.trim() !== q) setText(q);
  }

  useEffect(() => {
    const next = text.trim();
    if (next === q) return;
    const timer = setTimeout(() => onSearch(next), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, q, onSearch]);

  return (
    <Box
      component="form"
      role="search"
      aria-label="Shops"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(text.trim());
        input.current?.blur();
      }}
    >
      <TextField
        fullWidth
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Search shops, sellers and descriptions"
        inputRef={input}
        slotProps={{
          htmlInput: {
            "aria-label": "Search shops",
            inputMode: "search",
            enterKeyHint: "search",
            autoComplete: "off",
            spellCheck: false,
            maxLength: SEARCH_MAX_LENGTH,
          },
          input: {
            sx: { minHeight: 48, bgcolor: "background.paper" },
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: "text.secondary" }} />
              </InputAdornment>
            ),
            endAdornment: text ? (
              <InputAdornment position="end">
                <IconButton
                  aria-label="Clear the search"
                  edge="end"
                  // Keep focus (and a phone's keyboard) in the field.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setText("");
                    onSearch("");
                    input.current?.focus();
                  }}
                  sx={{ width: 40, height: 40, [`@media ${PHONE_MEDIA}`]: { width: 44, height: 44 } }}
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : undefined,
          },
        }}
      />
    </Box>
  );
}

export interface SortFilterProps {
  sort: ShopSort;
  pay: PayFilter;
  /** "Ships to": a country code, or "" for anywhere. */
  ships: string;
  /** Where the buyer gets things delivered (delivery/buyerPlace.ts), offered first. */
  place: BuyerPlace | null;
  mine: boolean;
  /** Show "My shops" (signed in, with a shop). */
  canFilterMine: boolean;
  onSort: (sort: ShopSort) => void;
  onPay: (pay: PayFilter) => void;
  onShips: (ships: string) => void;
  onMine: (mine: boolean) => void;
  onReset: () => void;
  /** The count line, e.g. "24 shops". */
  status: ReactNode;
}

const ANY = "any";
const PICK = "pick";

/** The countries "Ships to" offers: the buyer's, and the one picked if another. */
function shipsChoices(ships: string, place: BuyerPlace | null): string[] {
  const mine = place ? countryCode(place.country) : null;
  return [...new Set([mine, ships].filter((c): c is string => !!c))];
}

/** Picking another country: the buyer's place for product pages too, and the filter. */
function ShipsPicker({ place, open, onClose, onShips }: { place: BuyerPlace | null; open: boolean; onClose: () => void; onShips: (ships: string) => void }) {
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <PlacePickerDialog place={place} onClose={onClose} onPicked={(next) => onShips(parseShips(countryCode(next.country)))} />
    </Suspense>
  );
}

/** Desktop and wide Hub panes: one row of controls. */
export function SortFilterRow({ sort, pay, ships, place, mine, canFilterMine, onSort, onPay, onShips, onMine, status }: SortFilterProps) {
  const [picking, setPicking] = useState(false);
  return (
    <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
      <TextField
        select
        size="small"
        label="Sort by"
        value={sort}
        onChange={(event) => onSort(parseSort(event.target.value))}
        slotProps={{ select: { MenuProps: selectMenuProps } }}
        sx={{ minWidth: 190 }}
      >
        {SHOP_SORTS.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        size="small"
        label="Pays in"
        value={pay || ANY}
        onChange={(event) => onPay(parsePay(event.target.value === ANY ? "" : event.target.value))}
        slotProps={{ select: { MenuProps: selectMenuProps } }}
        sx={{ minWidth: 190 }}
      >
        {PAY_FILTERS.map((option) => (
          <MenuItem key={option.value || ANY} value={option.value || ANY}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        size="small"
        label="Ships to"
        value={ships || ANY}
        onChange={(event) => (event.target.value === PICK ? setPicking(true) : onShips(parseShips(event.target.value === ANY ? "" : event.target.value)))}
        slotProps={{ select: { MenuProps: selectMenuProps } }}
        sx={{ minWidth: 190, maxWidth: 260 }}
      >
        <MenuItem value={ANY}>Anywhere</MenuItem>
        {shipsChoices(ships, place).map((code) => (
          <MenuItem key={code} value={code}>
            {countryName(code)}
          </MenuItem>
        ))}
        <MenuItem value={PICK}>Choose a country…</MenuItem>
      </TextField>
      <ShipsPicker place={place} open={picking} onClose={() => setPicking(false)} onShips={onShips} />
      {canFilterMine && (
        <Chip
          label="My shops"
          clickable
          onClick={() => onMine(!mine)}
          color={mine ? "primary" : "default"}
          variant={mine ? "filled" : "outlined"}
          aria-pressed={mine}
          sx={{ minHeight: 40 }}
        />
      )}
      <Typography role="status" variant="body2" color="text.secondary" sx={{ ml: "auto" }}>
        {status}
      </Typography>
    </Box>
  );
}

/** Phones: a button that opens the sheet, and the filters that are on as chips that turn them off. */
export function SortFilterSheet(props: SortFilterProps) {
  const { sort, pay, ships, place, mine, canFilterMine, onSort, onPay, onShips, onMine, onReset, status } = props;
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const active = (sort !== "newest" ? 1 : 0) + (pay ? 1 : 0) + (ships ? 1 : 0) + (mine ? 1 : 0);
  const chip = { minHeight: 44, fontSize: 14 } as const;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Button
          variant={active ? "contained" : "outlined"}
          startIcon={<TuneIcon />}
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          sx={{ minHeight: 44, flexShrink: 0 }}
        >
          {active ? `Sort & filter · ${active}` : "Sort & filter"}
        </Button>
        <Typography role="status" variant="body2" color="text.secondary" sx={{ ml: "auto", textAlign: "right" }}>
          {status}
        </Typography>
      </Box>
      {active > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {sort !== "newest" && (
            <RemovableChip label={SHOP_SORTS.find((s) => s.value === sort)?.label ?? ""} onRemove={() => onSort("newest")} />
          )}
          {pay && <RemovableChip label={`Pays in ${pay === "assets" ? "Q-Assets" : pay}`} onRemove={() => onPay("")} />}
          {ships && <RemovableChip label={`Ships to ${countryName(ships)}`} onRemove={() => onShips("")} />}
          {mine && <RemovableChip label="My shops" onRemove={() => onMine(false)} />}
        </Box>
      )}
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Sort and filter">
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <FormControl>
            <FormLabel id="home-sort-label" sx={{ fontWeight: 700, color: "text.primary" }}>
              Sort by
            </FormLabel>
            <RadioGroup aria-labelledby="home-sort-label" value={sort} onChange={(event) => onSort(parseSort(event.target.value))}>
              {SHOP_SORTS.map((option) => (
                <FormControlLabel
                  key={option.value}
                  value={option.value}
                  control={<Radio />}
                  label={option.label}
                  sx={{ minHeight: 44, mr: 0 }}
                />
              ))}
            </RadioGroup>
          </FormControl>
          <Box role="group" aria-labelledby="home-pay-label">
            <Typography id="home-pay-label" sx={{ fontWeight: 700, mb: 1 }}>
              Pays in
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {PAY_FILTERS.map((option) => (
                <Chip
                  key={option.value || ANY}
                  label={option.short}
                  clickable
                  onClick={() => onPay(option.value)}
                  color={pay === option.value ? "primary" : "default"}
                  variant={pay === option.value ? "filled" : "outlined"}
                  aria-pressed={pay === option.value}
                  // Starts with the visible ticker (WCAG 2.5.3): "ARRR, Pirate Chain".
                  aria-label={option.label.endsWith(`(${option.short})`) ? `${option.short}, ${option.label.replace(` (${option.short})`, "")}` : option.label}
                  sx={chip}
                />
              ))}
            </Box>
          </Box>
          <Box role="group" aria-labelledby="home-ships-label">
            <Typography id="home-ships-label" sx={{ fontWeight: 700, mb: 1 }}>
              Ships to
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {["", ...shipsChoices(ships, place)].map((code) => (
                <Chip
                  key={code || ANY}
                  label={code ? countryName(code) : "Anywhere"}
                  clickable
                  onClick={() => onShips(code)}
                  color={ships === code ? "primary" : "default"}
                  variant={ships === code ? "filled" : "outlined"}
                  aria-pressed={ships === code}
                  sx={chip}
                />
              ))}
              <Chip label="Choose a country…" clickable variant="outlined" onClick={() => setPicking(true)} aria-haspopup="dialog" sx={chip} />
            </Box>
            <ShipsPicker place={place} open={picking} onClose={() => setPicking(false)} onShips={onShips} />
          </Box>
          {canFilterMine && (
            <FormControlLabel
              control={<Switch checked={mine} onChange={(event) => onMine(event.target.checked)} />}
              label="Only my shops"
              sx={{ minHeight: 44, mr: 0 }}
            />
          )}
          <Box sx={{ display: "flex", gap: 1, "& .MuiButton-root": { minHeight: 48, flex: 1 } }}>
            <Button variant="contained" onClick={() => setOpen(false)}>
              Done
            </Button>
            <Button variant="outlined" onClick={onReset} disabled={!active}>
              Reset
            </Button>
          </Box>
        </Box>
      </BottomSheet>
    </Box>
  );
}

/** A filter that is on: tapping it (or its ✕) turns it off. */
function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Chip
      label={label}
      onClick={onRemove}
      onDelete={onRemove}
      aria-label={`Remove ${label}`}
      sx={{ minHeight: 44, fontSize: 14 }}
    />
  );
}
