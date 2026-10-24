/**
 * One look for every drop-down in the app: the menus of select fields (sorts,
 * coins, currencies, settings) and the suggestion lists of search fields
 * (categories, assets, countries). The browser's own select lists can't be
 * themed (Hub showed them in the system's colours), so selects use MUI's
 * menu, which also opens at the field's width, just below it.
 *
 * Colours from the theme only (CLAUDE.md rule 3): the surface, a divider
 * border, rows of 44 px, the chosen row in the primary colour's tint.
 */
import { alpha, type Theme } from "@mui/material/styles";
import type { SxProps } from "@mui/material";

/** The paper of a menu or a suggestion list. */
export const dropdownPaperSx: SxProps<Theme> = (theme: Theme) => ({
  mt: 0.5,
  borderRadius: "12px",
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
  backgroundImage: "none",
  boxShadow: theme.shadows[8],
  "& .MuiMenu-list, & .MuiAutocomplete-listbox": { p: 0.5 },
  "& .MuiMenuItem-root, & .MuiAutocomplete-option": {
    minHeight: 44,
    borderRadius: "8px",
    my: "2px",
  },
  "& .MuiMenuItem-root.Mui-selected, & .MuiAutocomplete-option[aria-selected='true']": {
    backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.24 : 0.12),
    fontWeight: 600,
  },
  "& .MuiMenuItem-root.Mui-selected:hover, & .MuiAutocomplete-option[aria-selected='true'].Mui-focused": {
    backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.32 : 0.18),
  },
});

/** For a select field: `slotProps={{ select: { MenuProps: selectMenuProps } }}`. */
export const selectMenuProps = {
  anchorOrigin: { vertical: "bottom", horizontal: "left" },
  transformOrigin: { vertical: "top", horizontal: "left" },
  slotProps: {
    // The menu opens at the end of the page, outside its landmarks; its panel is a region of its own
    // (axe region). It can't open inside the page: MUI would then hide the whole page, menu
    // included, from screen readers (aria-hidden on the page's root).
    paper: { sx: [dropdownPaperSx, { maxHeight: "min(60vh, 420px)" }], role: "region", "aria-label": "Choices" },
  },
} as const;

/** For an Autocomplete: `slotProps={{ paper: { sx: dropdownPaperSx } }}`. */
export const autocompletePaperProps = { sx: dropdownPaperSx };
