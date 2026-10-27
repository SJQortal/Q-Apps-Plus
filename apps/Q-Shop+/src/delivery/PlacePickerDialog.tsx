/**
 * Where the buyer gets things delivered (buyerPlace.ts): a country, and a
 * state in the United States, typed to find. Kept on this device for every
 * product page's delivery prices; checkout still asks for the full address.
 *
 * The countries are a list in the dialog itself, large and easy to read
 * (Simon, from Hub: the drop-down "is very small"): type to narrow it, then
 * pick one; the arrow keys move between the search and the list.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { alpha } from "@mui/material/styles";
import { Box, Button, ButtonBase, InputAdornment, TextField, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CheckIcon from "@mui/icons-material/Check";
import { ResponsiveDialog } from "../components/common/mobile";
import { ALL_COUNTRY_CODES, ALL_STATE_CODES, US, countryCode, countryName, stateName } from "../constants/shipping";
import { matchCountries } from "../constants/countrySearch";
import { cleanPlace, pickedBuyerPlace, setBuyerPlace, type BuyerPlace } from "./buyerPlace";

const byName = (a: string, b: string) => a.localeCompare(b);

/** One row of the list. */
const ROW = 48;

/**
 * As many whole rows as fit in `share` of the window (3 to `most`): the
 * list's height is whole rows, and scrolling stops on a row, so no name is
 * cut off at its top or bottom edge (Simon, 2026-10-26).
 */
function wholeRows(windowHeight: number, share: number, most: number): number {
  return Math.max(3, Math.min(most, Math.floor((windowHeight * share) / ROW)));
}

function useWindowHeight(): number {
  const [height, setHeight] = useState(() => (typeof window === "undefined" ? 800 : window.innerHeight));
  useEffect(() => {
    const onResize = () => setHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return height;
}

/** The delivery form's list writes a few names oddly ("People'S"): shown as they're spelled, kept as they are. */
const shownName = (name: string) => name.replace(/'S\b/g, "'s");

/** Countries by any name they go by (constants/countrySearch.ts); states by their own. */
function narrow(names: string[], query: string, codeOf: (name: string) => string | null): string[] {
  return matchCountries(names, query, (n) => n, codeOf);
}

function PlaceList({
  label,
  names,
  value,
  onPick,
  codeOf,
  rows,
  autoFocus = false,
}: {
  label: string;
  names: string[];
  value: string | null;
  onPick: (name: string) => void;
  codeOf: (name: string) => string | null;
  /** Whole rows the list shows (wholeRows). */
  rows: number;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const shown = narrow(names, query, codeOf);
  const list = useRef<HTMLDivElement>(null);
  const options = () => [...(list.current?.querySelectorAll<HTMLElement>("[role=option]") ?? [])];
  // The chosen one in view when the list opens.
  useEffect(() => {
    list.current?.querySelector<HTMLElement>("[aria-selected=true]")?.scrollIntoView?.({ block: "center" });
  }, []);
  const move = (e: KeyboardEvent, from: number) => {
    const all = options();
    const to = e.key === "ArrowDown" ? from + 1 : e.key === "ArrowUp" ? from - 1 : e.key === "Home" ? 0 : e.key === "End" ? all.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    if (to < 0) return void list.current?.parentElement?.querySelector<HTMLInputElement>("input")?.focus();
    all[Math.min(to, all.length - 1)]?.focus();
  };
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <TextField
        type="search"
        label={label}
        value={query}
        autoFocus={autoFocus}
        placeholder="Type to find it"
        onChange={(e) => {
          setQuery(e.target.value);
          // From the top: a list scrolled to the chosen one cut the narrowed list's first and last rows off (Simon).
          if (list.current) list.current.scrollTop = 0;
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            options()[0]?.focus();
          }
          if (e.key === "Enter" && shown.length > 0) {
            e.preventDefault();
            onPick(shown[0]);
          }
        }}
        slotProps={{
          inputLabel: { shrink: true },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />
      <Box
        ref={list}
        role="listbox"
        aria-label={label}
        // A steady height of whole rows (the dialog doesn't jump while typing narrows the list), stopping on a row.
        sx={{
          height: rows * ROW + 10,
          overflowY: "auto",
          border: 1,
          borderColor: "divider",
          borderRadius: 2,
          p: 0.5,
          scrollSnapType: "y mandatory",
          scrollPaddingBlock: "4px",
          overscrollBehavior: "contain",
        }}
      >
        {shown.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 1.5 }}>
            Nothing matches &ldquo;{query.trim()}&rdquo;.
          </Typography>
        ) : (
          shown.map((name, i) => {
            const chosen = name === value;
            return (
              <ButtonBase
                key={name}
                role="option"
                aria-selected={chosen}
                // One stop for Tab: the chosen one, else the first.
                tabIndex={chosen || (!shown.includes(value ?? "") && i === 0) ? 0 : -1}
                onClick={() => onPick(name)}
                onKeyDown={(e) => move(e, i)}
                sx={(theme) => ({
                  width: "100%",
                  minHeight: ROW,
                  px: 1.5,
                  scrollSnapAlign: "start",
                  borderRadius: 1.5,
                  justifyContent: "space-between",
                  textAlign: "left",
                  fontFamily: theme.typography.fontFamily,
                  fontSize: 16,
                  fontWeight: chosen ? 700 : 400,
                  bgcolor: chosen ? alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.24 : 0.12) : "transparent",
                  "&:hover, &.Mui-focusVisible": { bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.32 : 0.18) },
                })}
              >
                {shownName(name)}
                {chosen && <CheckIcon fontSize="small" color="primary" />}
              </ButtonBase>
            );
          })
        )}
      </Box>
    </Box>
  );
}

export function PlacePickerDialog({ place, onClose, onPicked }: { place: BuyerPlace | null; onClose: () => void; onPicked?: (place: BuyerPlace) => void }) {
  const countries = useMemo(() => ALL_COUNTRY_CODES.map(countryName).sort(byName), []);
  const states = useMemo(() => ALL_STATE_CODES.map(stateName).sort(byName), []);
  const [country, setCountry] = useState<string | null>(place?.country ?? null);
  const [state, setState] = useState<string | null>(place?.state || null);
  const inUs = countryCode(country) === US;
  const windowHeight = useWindowHeight();
  const countryRows = wholeRows(windowHeight, inUs ? 0.3 : 0.5, inUs ? 5 : 9);
  const stateRows = wholeRows(windowHeight, 0.26, 4);
  const save = () => {
    const next = cleanPlace({ country, state: inUs ? state : "" });
    if (!next) return;
    setBuyerPlace(next);
    onPicked?.(next);
    onClose();
  };
  return (
    <ResponsiveDialog
      open
      onClose={onClose}
      title="Deliver to"
      maxWidth="sm"
      actions={
        <>
          {/* Only a country picked here can be forgotten (not the one from the address kept at checkout). */}
          {place && pickedBuyerPlace() && (
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
        <PlaceList
          label="Country"
          names={countries}
          value={country}
          onPick={(name) => {
            setCountry(name);
            setState(null);
          }}
          codeOf={countryCode}
          rows={countryRows}
          autoFocus
        />
        {inUs && (
          <PlaceList label="State (optional)" names={states} value={state} onPick={setState} codeOf={() => null} rows={stateRows} />
        )}
        {inUs && (
          <Typography variant="body2" color="text.secondary">
            Some shops price states differently.
          </Typography>
        )}
      </Box>
    </ResponsiveDialog>
  );
}
