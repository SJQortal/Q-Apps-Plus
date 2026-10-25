/**
 * The parts of a product list that the shop page and the Products page share
 * (round 5): the grid of tiles or rows, its skeleton, the Grid / List toggle,
 * the category chips and the Auctions toggle.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Box, Chip, Link, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import ViewAgendaOutlinedIcon from "@mui/icons-material/ViewAgendaOutlined";
import { CategoryIcon } from "../../components/CategoryIcon";
import CheckIcon from "@mui/icons-material/Check";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import { PHONE_MEDIA } from "../../hooks/usePhoneLayout";
import { setProductView } from "../../utils/productView";
import { primarySoft } from "../../hub-theme";
import { ProductCardSkeleton, type ProductCardLayout } from "./ProductCard/ProductCard";

export const FETCHING_NOTE = "Fetching from peers…";

/** The value, once it has stopped changing for `ms`. */
export function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/**
 * Selected chips are filled and ticked, others outlined, in neutral colours:
 * the Classic theme's primary is the original's surface colour (white in
 * light mode), so a primary chip would vanish there.
 */
export function FilterChip({ label, on, onClick, category }: { label: string; on: boolean; onClick: () => void; category?: string }) {
  return (
    <Chip
      label={label}
      onClick={onClick}
      // A category's chip shows its icon (components/CategoryIcon.tsx); chosen, a check.
      icon={on ? <CheckIcon /> : category ? <CategoryIcon category={category} size={22} /> : undefined}
      variant={on ? "filled" : "outlined"}
      aria-pressed={on}
      sx={{
        minHeight: 36,
        maxWidth: "100%",
        fontWeight: on ? 700 : 500,
        ...(on && { bgcolor: "action.selected", "&:hover": { bgcolor: "action.focus" } }),
      }}
    />
  );
}

/**
 * Auctions only, at a tap (sorted by when they end unless the buyer picked
 * a sort): shown while the list has auctions still open, or while it's on.
 */
/** "On sale (3)": only products on sale (sale/compareAt.ts); shown when there are some. */
export function SaleToggle({ count, on, onChange, exact = true }: { count: number; on: boolean; onChange: (on: boolean) => void; exact?: boolean }) {
  if (count === 0 && !on) return null;
  return (
    <Chip
      icon={on ? <CheckIcon /> : <LocalOfferOutlinedIcon />}
      label={exact ? `On sale (${count})` : "On sale"}
      onClick={() => onChange(!on)}
      variant={on ? "filled" : "outlined"}
      aria-pressed={on}
      sx={{
        minHeight: 44,
        borderRadius: 22,
        px: 0.5,
        fontWeight: on ? 700 : 500,
        ...(on && { bgcolor: "action.selected", "&:hover": { bgcolor: "action.focus" } }),
      }}
    />
  );
}

export function AuctionsToggle({
  count,
  on,
  onChange,
  exact = true,
}: {
  count: number;
  on: boolean;
  onChange: (on: boolean) => void;
  /** False while the list is still being read: no count yet. */
  exact?: boolean;
}) {
  if (count === 0 && !on) return null;
  return (
    <Chip
      icon={on ? <CheckIcon /> : <GavelOutlinedIcon />}
      label={exact ? `Auctions (${count})` : "Auctions"}
      onClick={() => onChange(!on)}
      variant={on ? "filled" : "outlined"}
      aria-pressed={on}
      sx={{
        minHeight: 44,
        borderRadius: 22,
        px: 0.5,
        fontWeight: on ? 700 : 500,
        ...(on && { bgcolor: "action.selected", "&:hover": { bgcolor: "action.focus" } }),
      }}
    />
  );
}

/** What a price field takes: digits and one dot (a comma becomes one), up to 8 decimals. */
function cleanPrice(text: string): string {
  const [whole, ...rest] = text.replace(/,/g, ".").replace(/[^0-9.]/g, "").split(".");
  return rest.length ? `${whole}.${rest.join("").slice(0, 8)}` : whole;
}

/** A price range in QORT: two small fields, either may stay empty ("Price" before them unless a heading says so). */
export function PriceRangeFields({
  min,
  max,
  onChange,
  titled = true,
}: {
  min: string;
  max: string;
  onChange: (range: { min: string; max: string }) => void;
  titled?: boolean;
}) {
  const field = (label: "Min" | "Max", value: string, set: (text: string) => void) => (
    <TextField
      size="small"
      label={label}
      value={value}
      onChange={(event) => set(cleanPrice(event.target.value))}
      sx={{ width: 96, "& .MuiInputBase-root": { minHeight: 44 } }}
      slotProps={{ htmlInput: { inputMode: "decimal", autoComplete: "off", "aria-label": `${label} price in QORT` } }}
    />
  );
  return (
    <Box role="group" aria-label="Price in QORT" sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
      {titled && (
        <Typography variant="body2" color="text.secondary" aria-hidden>
          Price
        </Typography>
      )}
      {field("Min", min, (text) => onChange({ min: text, max }))}
      <Typography color="text.secondary" aria-hidden>
        –
      </Typography>
      {field("Max", max, (text) => onChange({ min, max: text }))}
      <Typography variant="body2" color="text.secondary" aria-hidden>
        QORT
      </Typography>
    </Box>
  );
}

export function CategoryChips({
  categories,
  selected,
  onToggle,
  onClear,
}: {
  categories: string[];
  selected: string[];
  onToggle: (category: string) => void;
  onClear: () => void;
}) {
  if (categories.length === 0) return null;
  return (
    <Box role="group" aria-label="Categories" sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
      <FilterChip label="All" on={selected.length === 0} onClick={onClear} />
      {categories.map((category) => (
        <FilterChip key={category} label={category} category={category} on={selected.includes(category)} onClick={() => onToggle(category)} />
      ))}
    </Box>
  );
}

export function ProductGridSkeleton({ count, note, layout = "tile" }: { count: number; note?: string; layout?: ProductCardLayout }) {
  return (
    <ProductGrid aria-busy layout={layout}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <ProductCardSkeleton note={i === 0 ? note : undefined} layout={layout} />
        </li>
      ))}
    </ProductGrid>
  );
}

/**
 * Tiles: as many columns as fit (two on a phone). Rows: one column (two side
 * by side on a phone held sideways).
 */
export function ProductGrid({ children, layout, ...rest }: { children: ReactNode; layout: ProductCardLayout; "aria-busy"?: boolean }) {
  return (
    <Box
      component="ul"
      {...rest}
      sx={{
        listStyle: "none",
        m: 0,
        p: 0,
        display: "grid",
        gap: { xs: 1.5, sm: 2 },
        gridTemplateColumns: layout === "tile" ? "repeat(auto-fill, minmax(min(100%, 200px), 1fr))" : "minmax(0, 1fr)",
        [`@media ${PHONE_MEDIA}`]: {
          gridTemplateColumns:
            layout === "tile"
              ? "repeat(auto-fill, minmax(min(100%, 148px), 1fr))"
              : "repeat(auto-fill, minmax(min(100%, 320px), 1fr))",
        },
        "& > li": { minWidth: 0 },
      }}
    >
      {children}
    </Box>
  );
}

/**
 * A titled line across a product grid: where one collection's products start
 * in Featured (qdn/productOrder.ts featuredOrder). The title opens the
 * collection when there is one.
 */
export function SectionDivider({
  title,
  to,
  first = false,
  heading = "h3",
}: {
  title: string;
  to?: string;
  first?: boolean;
  /** The heading level under the page's own headings. */
  heading?: "h2" | "h3";
}) {
  return (
    <Box component="li" data-section sx={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 1.5, pt: first ? 0 : 1.5 }}>
      <Typography component={heading} sx={{ fontWeight: 700, fontSize: 15, minWidth: 0, overflowWrap: "anywhere" }}>
        {to ? (
          <Link component={RouterLink} to={to} color="inherit" underline="hover">
            {title}
          </Link>
        ) : (
          title
        )}
      </Typography>
      <Box aria-hidden sx={{ flex: "1 1 24px", borderTop: 1, borderColor: "divider" }} />
    </Box>
  );
}

/** Grid or List: the buyer's choice for every shop (utils/productView.ts). */
export function ProductViewToggle({ layout }: { layout: ProductCardLayout }) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={layout === "tile" ? "grid" : "list"}
      onChange={(_event, next: "grid" | "list" | null) => next && setProductView(next)}
      aria-label="Show products as"
      sx={(theme) => ({
        "& .MuiToggleButton-root": { minHeight: 44, minWidth: 44, px: 1.25 },
        // The chosen one stands out in every theme, not by a faint background alone.
        "& .MuiToggleButton-root.Mui-selected, & .MuiToggleButton-root.Mui-selected:hover": {
          bgcolor: primarySoft(theme),
          color: theme.palette.primary.main,
          borderColor: theme.palette.primary.main,
        },
      })}
    >
      {/* ToggleButtonGroup clones its direct children, so no Tooltip wrappers: a title does the job. */}
      <ToggleButton value="grid" aria-label="Grid" title="Grid">
        <GridViewOutlinedIcon fontSize="small" />
      </ToggleButton>
      <ToggleButton value="list" aria-label="List" title="List">
        <ViewAgendaOutlinedIcon fontSize="small" />
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
