import { useId, type ReactNode } from "react";
import { useSelector } from "react-redux";
import { Box, Typography } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
import AutoStoriesOutlinedIcon from "@mui/icons-material/AutoStoriesOutlined";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import LibraryMusicOutlinedIcon from "@mui/icons-material/LibraryMusicOutlined";
import MovieOutlinedIcon from "@mui/icons-material/MovieOutlined";
import PhotoLibraryOutlinedIcon from "@mui/icons-material/PhotoLibraryOutlined";
import type { RootState } from "../../state/store";
import type { CollectionItem, CollectionSpaceId } from "../../utils/collections";
import { suggestSpaceForItems } from "./spaces/suggestSpace";

export type SpaceChoice = CollectionSpaceId | "standard";

const Tile = styled("label")(({ theme }) => ({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(0.75),
  minHeight: 44,
  minWidth: 0,
  padding: theme.spacing(1),
  cursor: "pointer",
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  transition: "background-color 150ms ease, border-color 150ms ease",
  "&:hover": { backgroundColor: theme.palette.action.hover },
  "&:has(input:focus-visible)": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
  "&:has(input:checked)": {
    borderColor: theme.palette.primary.main,
    boxShadow: `inset 0 0 0 1px ${theme.palette.primary.main}`,
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
  },
  "&:has(input:disabled)": { cursor: "default", opacity: 0.6 },
  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
}));

/** The real radio over the whole tile: the browser gives the group its arrow keys. */
const HiddenRadio = styled("input")({
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  margin: 0,
  opacity: 0,
  cursor: "inherit",
});

const Mini = styled("span")(({ theme }) => ({
  display: "flex",
  flexShrink: 0,
  gap: 3,
  height: 44,
  padding: 4,
  overflow: "hidden",
  borderRadius: 4,
  backgroundColor: theme.palette.action.hover,
  "& i": { display: "block", borderRadius: 2, backgroundColor: alpha(theme.palette.text.primary, 0.28) },
  "& i.accent": { backgroundColor: theme.palette.primary.main },
}));

const column = { display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 } as const;

/** Small drawings of each layout: a few blocks, not pictures of real content. */
const MINIS: Record<SpaceChoice, ReactNode> = {
  standard: (
    <>
      {[0, 1, 2, 3].map((n) => (
        <i key={n} style={{ flex: 1 }} />
      ))}
    </>
  ),
  music: (
    <>
      <i className="accent" style={{ width: 36, flexShrink: 0 }} />
      <span style={column}>
        {[0, 1, 2, 3].map((n) => (
          <i key={n} style={{ height: 5, width: `${95 - n * 12}%` }} />
        ))}
      </span>
    </>
  ),
  cinema: (
    <span style={column}>
      <i className="accent" style={{ flex: 1 }} />
      <span style={{ display: "flex", gap: 3, height: 9 }}>
        {[0, 1, 2, 3].map((n) => (
          <i key={n} style={{ flex: 1 }} />
        ))}
      </span>
    </span>
  ),
  library: (
    <span style={{ display: "flex", alignItems: "flex-end", gap: 2, flex: 1, height: "100%" }}>
      {[80, 100, 70, 90, 100, 65, 85, 95].map((height, n) => (
        <i key={n} className={n === 2 ? "accent" : undefined} style={{ flex: 1, height: `${height}%` }} />
      ))}
    </span>
  ),
  album: (
    <>
      <span style={column}>
        <i className="accent" style={{ flex: 3 }} />
        <i style={{ flex: 2 }} />
      </span>
      <span style={column}>
        <i style={{ flex: 2 }} />
        <i style={{ flex: 3 }} />
      </span>
      <span style={column}>
        <i style={{ flex: 3 }} />
        <i style={{ flex: 2 }} />
      </span>
    </>
  ),
};

const OPTIONS: { id: SpaceChoice; name: string; words: string; icon: ReactNode }[] = [
  { id: "standard", name: "Standard", words: "The usual list of shares.", icon: <GridViewOutlinedIcon fontSize="small" /> },
  { id: "music", name: "Music", words: "Tracks, play all and shuffle.", icon: <LibraryMusicOutlinedIcon fontSize="small" /> },
  { id: "cinema", name: "Cinema", words: "Big posters, one film up front.", icon: <MovieOutlinedIcon fontSize="small" /> },
  { id: "library", name: "Library", words: "Books on calm shelves.", icon: <AutoStoriesOutlinedIcon fontSize="small" /> },
  { id: "album", name: "Album", words: "A wall of pictures.", icon: <PhotoLibraryOutlinedIcon fontSize="small" /> },
];

const NAMES = Object.fromEntries(OPTIONS.map((option) => [option.id, option.name])) as Record<SpaceChoice, string>;

interface SpacePickerProps {
  value: SpaceChoice;
  onChange: (space: SpaceChoice) => void;
  disabled?: boolean;
  /** The collection's shares, to suggest a space from the bodies already held. */
  items?: CollectionItem[];
  /** Whether a suggestion may show: nothing chosen yet. It stays a suggestion until tapped. */
  suggest?: boolean;
}

/** The look a collection opens in: five tiles, one radio group. Folders inside take the same look. */
export function SpacePicker({ value, onChange, disabled, items, suggest }: SpacePickerProps) {
  const id = useId();
  const suggested = useSelector((state: RootState) => (suggest && items ? suggestSpaceForItems(state.file, items) : null));
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Typography id={`${id}-label`} component="div" sx={{ fontWeight: 600, fontSize: 15 }}>
        Space
      </Typography>
      <Box
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
        sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1 }}
      >
        {OPTIONS.map((option) => (
          <Tile key={option.id} sx={option.id === "standard" ? { gridColumn: "1 / -1" } : undefined}>
            <HiddenRadio
              type="radio"
              name={`${id}-space`}
              value={option.id}
              checked={value === option.id}
              disabled={disabled}
              onChange={() => onChange(option.id)}
            />
            <Mini aria-hidden>{MINIS[option.id]}</Mini>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0, color: "text.primary" }}>
              <Box component="span" aria-hidden sx={{ display: "flex", color: value === option.id ? "primary.main" : "text.secondary" }}>
                {option.icon}
              </Box>
              <Typography component="span" sx={{ fontWeight: 600, fontSize: 14, flex: 1, minWidth: 0 }}>
                {option.name}
              </Typography>
              {value === option.id ? <CheckCircleRoundedIcon aria-hidden color="primary" sx={{ fontSize: 18 }} /> : null}
            </Box>
            <Typography component="span" variant="body2" color="text.secondary" sx={{ fontSize: 13, lineHeight: 1.3 }}>
              {option.words}
              {suggested === option.id ? " Suggested for what's in it." : ""}
            </Typography>
          </Tile>
        ))}
      </Box>
      <Typography id={`${id}-hint`} variant="body2" color="text.secondary">
        Folders inside take the same look.
        {suggested && value !== suggested ? ` ${NAMES[suggested]} may suit this collection: tap it to use it.` : ""}
      </Typography>
    </Box>
  );
}
