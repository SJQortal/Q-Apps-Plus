/**
 * The heart that keeps a shop or a product as a favourite (favorites/
 * model.ts): filled when it is one. A tap changes it at once, and Hub asks to
 * confirm the small publish.
 */
import { Button, IconButton, Tooltip, type SxProps, type Theme } from "@mui/material";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import type { Favorite } from "./model";
import { useFavorites } from "./useFavorites";

export function FavoriteButton({
  fav,
  label,
  variant = "icon",
  sx,
}: {
  fav: Favorite | null;
  /** What it is: "Seller's Shop", "Mug". */
  label: string;
  /** A labelled button among others ("Add to favourites"), or the heart alone. */
  variant?: "icon" | "button";
  sx?: SxProps<Theme>;
}) {
  const { isFavorite, toggle } = useFavorites();
  if (!fav) return null;
  const on = isFavorite(fav.identifier);
  const text = on ? `Remove ${label} from favourites` : `Add ${label} to favourites`;
  if (variant === "button") {
    return (
      // Its name is its text ("Add to favourites"): the page says what it is for (WCAG 2.5.3, label in name).
      <Button
        variant="outlined"
        color="inherit"
        aria-pressed={on}
        startIcon={on ? <FavoriteIcon sx={{ color: "error.main" }} /> : <FavoriteBorderIcon />}
        onClick={() => void toggle(fav)}
        sx={{ minHeight: 44, ...sx }}
      >
        {on ? "In your favourites" : "Add to favourites"}
      </Button>
    );
  }
  return (
    <Tooltip title={on ? "In your favourites" : "Add to favourites"}>
      <IconButton aria-label={text} onClick={() => void toggle(fav)} sx={{ width: 44, height: 44, color: on ? "error.main" : "text.secondary", ...sx }}>
        {on ? <FavoriteIcon /> : <FavoriteBorderIcon />}
      </IconButton>
    </Tooltip>
  );
}
