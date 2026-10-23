/**
 * Where the shop ships (Simon: "the shop creator can choose the countries he
 * ships to … tick for example Europe, or North America or Asia, and have all
 * the countries from there included (with the ability to exclude some)").
 *
 * Quick picks (Worldwide, the European Union, Clear), then a row per region
 * with a checkbox (ticked, partly ticked or not) and how many of its
 * countries are in; a region opens to its countries, to leave some out or add
 * single ones (with a search box in the bigger regions). The summary in words
 * is what the shop's "Ships to" says (constants/shipping.ts).
 */
import { useId, useMemo, useState } from "react";
import { Box, Button, Checkbox, Collapse, FormControlLabel, IconButton, InputAdornment, TextField, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";
import { EU_COUNTRIES, SHIPPING_REGIONS, countryName, shippingSummary, type ShippingRegion } from "../constants/shipping";

const SEARCH_FROM = 20;

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
          control={
            <Checkbox
              checked={all}
              indeterminate={inside > 0 && !all}
              onChange={(e) => onSet(region.codes, e.target.checked)}
              sx={{ width: 44, height: 44 }}
            />
          }
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

export function ShipsToPicker({
  value,
  onChange,
  typed,
}: {
  /** The countries it ships to (codes); null while the shop keeps its typed text. */
  value: string[] | null;
  onChange: (codes: string[]) => void;
  /** The shop's typed "Ships to", from before the list. */
  typed?: string;
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
  };
  const summary = shippingSummary(value ?? []);
  const inhabited = SHIPPING_REGIONS.filter((r) => r.id !== "remote").flatMap((r) => r.codes);

  return (
    <Box component="section" aria-labelledby={headingId} sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Typography id={headingId} sx={{ fontWeight: 600 }}>
        Ships to
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
    </Box>
  );
}
