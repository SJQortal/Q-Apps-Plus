/**
 * The parts of a product list that the shop page and the Products page share
 * (round 5): the grid of tiles or rows, its skeleton, the Grid / List toggle
 * and the category chips.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Box, Chip, ToggleButton, ToggleButtonGroup } from "@mui/material";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import ViewAgendaOutlinedIcon from "@mui/icons-material/ViewAgendaOutlined";
import CheckIcon from "@mui/icons-material/Check";
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
export function FilterChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <Chip
      label={label}
      onClick={onClick}
      icon={on ? <CheckIcon /> : undefined}
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
        <FilterChip key={category} label={category} on={selected.includes(category)} onClick={() => onToggle(category)} />
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
