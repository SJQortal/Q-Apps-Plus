/**
 * Where the shop ships (Simon: "the shop creator can choose the countries he
 * ships to … tick for example Europe, or North America or Asia, and have all
 * the countries from there included (with the ability to exclude some)").
 *
 * Quick picks (Worldwide, USA, the European Union, Clear), then a row per
 * region with a checkbox (ticked, partly ticked or not) and how many of its
 * countries are in; a region opens to its countries, to leave some out or add
 * single ones (with a search box in the bigger regions). With the United
 * States ticked, its states can be chosen too (Simon: "make sure for the USA
 * to have it divided into states"): every state, the lower 48 and DC, or
 * single states and territories. The summary in words is what the shop's
 * "Ships to" says (constants/shipping.ts).
 */
import { useId, useMemo, useState } from "react";
import { Box, Button, Checkbox, Collapse, FormControlLabel, IconButton, InputAdornment, TextField, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";
import {
  ALL_STATE_CODES,
  EU_COUNTRIES,
  LOWER_48,
  SHIPPING_REGIONS,
  US,
  US_STATE_GROUPS,
  countryName,
  shippingSummaryWithStates,
  stateName,
  statesSummary,
  type ShippingRegion,
} from "../constants/shipping";

const SEARCH_FROM = 20;

/**
 * A region's or group's checkbox: ticked, partly ticked or not. MUI marks a
 * partly ticked one `aria-checked="mixed"` but not the native input, which
 * axe flags (aria-conditional-attr): the native state is set to match.
 */
function PartCheckbox({ checked, indeterminate, onChange }: { checked: boolean; indeterminate: boolean; onChange: (on: boolean) => void }) {
  return (
    <Checkbox
      checked={checked}
      indeterminate={indeterminate}
      slotProps={{
        input: {
          ref: (el: HTMLInputElement | null) => {
            if (el) el.indeterminate = indeterminate;
          },
        },
      }}
      onChange={(e) => onChange(e.target.checked)}
      sx={{ width: 44, height: 44 }}
    />
  );
}

function RegionRow({ region, chosen, onSet }: { region: ShippingRegion; chosen: Set<string>; onSet: (codes: readonly string[], on: boolean) => void }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inside = region.codes.filter((c) => chosen.has(c)).length;
  const all = inside === region.codes.length;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return region.codes
      .map((code) => ({ code, name: countryName(code) }))
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [region.codes, query]);
  return (
    <Box component="li" sx={{ listStyle: "none", borderTop: 1, borderColor: "divider", "&:first-of-type": { borderTop: 0 } }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minHeight: 52 }}>
        <FormControlLabel
          sx={{ flex: 1, m: 0, minWidth: 0 }}
          control={<PartCheckbox checked={all} indeterminate={inside > 0 && !all} onChange={(on) => onSet(region.codes, on)} />}
          label={
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600 }}>{region.label}</Typography>
              <Typography variant="body2" color="text.secondary">
                {inside === 0 ? `${region.codes.length} countries` : all ? `All ${region.codes.length} countries` : `${inside} of ${region.codes.length} countries`}
              </Typography>
            </Box>
          }
        />
        <IconButton
          aria-label={`Choose countries in ${region.label}`}
          aria-expanded={open}
          aria-controls={`${id}-countries`}
          onClick={() => setOpen((v) => !v)}
          sx={{ width: 44, height: 44, transform: open ? "rotate(180deg)" : undefined, transition: "transform 150ms" }}
        >
          <ExpandMoreIcon />
        </IconButton>
      </Box>
      <Collapse in={open} unmountOnExit>
        <Box id={`${id}-countries`} sx={{ pb: 1.5, pl: { xs: 1, sm: 5.5 }, pr: 1 }}>
          {region.codes.length >= SEARCH_FROM && (
            <TextField
              size="small"
              placeholder={`Find a country in ${region.label}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              fullWidth
              slotProps={{
                htmlInput: { "aria-label": `Find a country in ${region.label}` },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ mb: 1 }}
            />
          )}
          <Box
            role="group"
            aria-label={`Countries in ${region.label}`}
            sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 210px), 1fr))", columnGap: 1 }}
          >
            {shown.map((c) => (
              <FormControlLabel
                key={c.code}
                sx={{ m: 0, minHeight: 40 }}
                control={<Checkbox size="small" checked={chosen.has(c.code)} onChange={(e) => onSet([c.code], e.target.checked)} />}
                label={<Typography variant="body2">{c.name}</Typography>}
              />
            ))}
            {shown.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                No country matches.
              </Typography>
            )}
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}

/** The states it ships to within the United States: every one (null), or some. */
function UsStates({ states, onChange }: { states: string[] | null; onChange: (states: string[] | null) => void }) {
  const headingId = useId();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const chosen = new Set(states ?? ALL_STATE_CODES);
  const set = (codes: readonly string[], on: boolean) => {
    const next = new Set(chosen);
    for (const code of codes) {
      if (on) next.add(code);
      else next.delete(code);
    }
    // Every state again is no list at all.
    onChange(next.size === ALL_STATE_CODES.length ? null : ALL_STATE_CODES.filter((c) => next.has(c)));
  };
  const count = chosen.size;
  return (
    <Box component="section" aria-labelledby={headingId} sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
      <Typography id={headingId} sx={{ fontWeight: 600 }}>
        Within the United States
      </Typography>
      <Typography variant="body2" color={count ? "text.primary" : "error"} role="status">
        {count ? `${statesSummary(states)[0].toUpperCase()}${statesSummary(states).slice(1)} · ${count} of ${ALL_STATE_CODES.length}` : "No state ticked yet"}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        <Button variant="outlined" color="inherit" size="small" onClick={() => onChange(null)} sx={{ minHeight: 44 }}>
          Every state
        </Button>
        <Button variant="outlined" color="inherit" size="small" onClick={() => onChange([...LOWER_48])} sx={{ minHeight: 44 }}>
          Lower 48 and DC
        </Button>
        <Button
          color="inherit"
          size="small"
          endIcon={<ExpandMoreIcon sx={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 150ms" }} />}
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((v) => !v)}
          sx={{ minHeight: 44 }}
        >
          Choose states
        </Button>
      </Box>
      <Collapse in={open} unmountOnExit>
        <Box id={listId} sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {US_STATE_GROUPS.map((group) => {
            const inside = group.codes.filter((c) => chosen.has(c)).length;
            const all = inside === group.codes.length;
            return (
              <Box key={group.id}>
                <FormControlLabel
                  sx={{ m: 0 }}
                  control={<PartCheckbox checked={all} indeterminate={inside > 0 && !all} onChange={(on) => set(group.codes, on)} />}
                  label={
                    <Typography sx={{ fontWeight: 600 }}>
                      {group.label}
                      {group.codes.length > 1 && (
                        <Box component="span" sx={{ color: "text.secondary", fontWeight: 400 }}>
                          {" "}
                          · {inside} of {group.codes.length}
                        </Box>
                      )}
                    </Typography>
                  }
                />
                {group.codes.length > 1 && (
                  <Box
                    role="group"
                    aria-label={`${group.label} of the United States`}
                    sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 150px), 1fr))", columnGap: 1, pl: { xs: 0, sm: 5.5 } }}
                  >
                    {[...group.codes]
                      .sort((a, b) => stateName(a).localeCompare(stateName(b)))
                      .map((code) => (
                        <FormControlLabel
                          key={code}
                          sx={{ m: 0, minHeight: 40 }}
                          control={<Checkbox size="small" checked={chosen.has(code)} onChange={(e) => set([code], e.target.checked)} />}
                          label={<Typography variant="body2">{stateName(code)}</Typography>}
                        />
                      ))}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </Collapse>
    </Box>
  );
}

export function ShipsToPicker({
  value,
  onChange,
  states = null,
  onStatesChange,
  typed,
  title = "Ships to",
}: {
  /** The countries it ships to (codes); null while the shop keeps its typed text. */
  value: string[] | null;
  onChange: (codes: string[]) => void;
  /** The US states it ships to (null: every one), when it ships to the United States. */
  states?: string[] | null;
  onStatesChange?: (states: string[] | null) => void;
  /** The shop's typed "Ships to", from before the list. */
  typed?: string;
  /** Its heading ("Delivers to" in a delivery zone). */
  title?: string;
}) {
  const headingId = useId();
  const chosen = useMemo(() => new Set(value ?? []), [value]);
  const set = (codes: readonly string[], on: boolean) => {
    const next = new Set(chosen);
    for (const code of codes) {
      if (on) next.add(code);
      else next.delete(code);
    }
    onChange(SHIPPING_REGIONS.flatMap((r) => r.codes).filter((c) => next.has(c)));
    // Without the United States, no states to choose.
    if (!next.has(US) && states !== null) onStatesChange?.(null);
  };
  const shipsToUs = chosen.has(US);
  const summary = shippingSummaryWithStates(value ?? [], shipsToUs ? states : null);
  const inhabited = SHIPPING_REGIONS.filter((r) => r.id !== "remote").flatMap((r) => r.codes);

  return (
    <Box component="section" aria-labelledby={headingId} sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Typography id={headingId} sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      <Typography variant="body2" color={summary ? "text.primary" : "text.secondary"} role="status">
        {summary
          ? `${summary} · ${chosen.size === 1 ? "1 country" : `${chosen.size} countries`}`
          : value === null && typed
            ? `Now: "${typed}" (typed before). Tick the regions and countries you deliver physical products to, so buyers see it and checkout can tell them.`
            : "Tick the regions and countries you deliver physical products to."}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        <Button variant="outlined" color="inherit" size="small" onClick={() => set(inhabited, true)} sx={{ minHeight: 40 }}>
          Worldwide
        </Button>
        <Button
          variant="outlined"
          color="inherit"
          size="small"
          aria-label="USA: the United States, every state"
          onClick={() => {
            set([US], true);
            onStatesChange?.(null);
          }}
          sx={{ minHeight: 40 }}
        >
          USA
        </Button>
        <Button variant="outlined" color="inherit" size="small" onClick={() => set(EU_COUNTRIES, true)} sx={{ minHeight: 40 }}>
          European Union
        </Button>
        {chosen.size > 0 && (
          <Button color="inherit" size="small" onClick={() => onChange([])} sx={{ minHeight: 40 }}>
            Clear
          </Button>
        )}
      </Box>
      <Box component="ul" aria-label="Regions" sx={{ m: 0, p: 0, border: 1, borderColor: "divider", borderRadius: 2, px: 1 }}>
        {SHIPPING_REGIONS.map((region) => (
          <RegionRow key={region.id} region={region} chosen={chosen} onSet={set} />
        ))}
      </Box>
      {shipsToUs && onStatesChange && <UsStates states={states} onChange={onStatesChange} />}
    </Box>
  );
}
