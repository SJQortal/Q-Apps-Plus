import { Box, Typography } from "@mui/material";
import { styled, type Theme } from "@mui/material/styles";
import { LANDSCAPE_PHONE_MEDIA, PHONE_MEDIA } from "../../hooks/usePhoneLayout";
import { primarySoft } from "../../hub-theme";

const phone = `@media ${PHONE_MEDIA}`;
// Also matches PHONE_MEDIA, so a rule under it must come after the phone one.
const landscapePhone = `@media ${LANDSCAPE_PHONE_MEDIA}`;

export const FileContainer = styled("ul")(({ theme }) => ({
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1),
  width: "100%",
}));

export const FileRow = styled("li")(({ theme }) => ({
  position: "relative",
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: theme.spacing(1, 1.5),
  width: "100%",
  minHeight: 64,
  padding: theme.spacing(1, 1.5),
  [phone]: {
    padding: theme.spacing(1, 1),
    // Two fixed lines on phones: the title, then publisher and actions.
    "& > .row-main": { flexBasis: "100%" },
  },
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  transition: "background-color 150ms ease, border-color 150ms ease",
  "&:hover": {
    backgroundColor: theme.palette.action.hover,
  },
  "&:focus-within": {
    borderColor: theme.palette.primary.main,
  },
  // Row actions stay visible on touch screens and appear on hover with a mouse.
  "@media (hover: hover)": {
    "& .row-actions": { opacity: 0 },
    "&:hover .row-actions, &:focus-within .row-actions": { opacity: 1 },
  },
}));

export const RowMain = styled("button")(({ theme }) => ({
  appearance: "none",
  border: 0,
  background: "transparent",
  color: "inherit",
  font: "inherit",
  textAlign: "left",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
  flex: "1 1 200px",
  minWidth: 0,
  minHeight: 44,
  padding: 0,
  borderRadius: theme.shape.borderRadius,
  "&:focus-visible": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 4,
  },
}));

/** RowMain's layout for a row with nothing to open (a deleted share in a collection). */
export const RowMainStatic = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
  flex: "1 1 200px",
  minWidth: 0,
  minHeight: 44,
}));

export const RowIcon = styled("img")(({ theme }) => ({
  width: 44,
  height: 44,
  borderRadius: theme.shape.borderRadius,
  objectFit: "cover",
  flexShrink: 0,
}));

export const VideoCardTitle = styled(Typography)(({ theme }) => ({
  fontSize: 15,
  fontWeight: 600,
  lineHeight: 1.3,
  color: theme.palette.text.primary,
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
  overflow: "hidden",
  wordBreak: "break-word",
}));

export const RowMeta = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: theme.spacing(0.5, 1),
  marginTop: 2,
  color: theme.palette.text.secondary,
  fontSize: 13,
  minWidth: 0,
}));

export const NameLink = styled("button")(({ theme }) => ({
  appearance: "none",
  border: 0,
  background: "transparent",
  padding: theme.spacing(0.5, 0),
  minHeight: 36,
  [phone]: { minHeight: 44 },
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  color: theme.palette.text.secondary,
  font: "inherit",
  fontSize: 13,
  maxWidth: 200,
  "& span": { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  "&:hover span": { textDecoration: "underline", color: theme.palette.text.primary },
  "&:focus-visible": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
    borderRadius: 4,
  },
}));

export const RowActions = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(0.25),
  flexShrink: 0,
  marginLeft: "auto",
  transition: "opacity 150ms ease",
  [phone]: {
    gap: theme.spacing(0.5),
  },
}));

/*
 * The grid layout (Settings → Layout, or the toggle on a list): one card per
 * share, as many ~220 px columns as fit; two on portrait phones and narrow
 * panes, one below 340 px. Phones in landscape keep the auto-fill columns
 * and the 44 px targets.
 */
export const FileGrid = styled("ul")(({ theme }) => ({
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: theme.spacing(1.5),
  width: "100%",
  "@media (max-width:599.95px)": {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: theme.spacing(1),
  },
  "@media (max-width:339.95px)": {
    gridTemplateColumns: "minmax(0, 1fr)",
  },
}));

export const FileCard = styled("li")(({ theme }) => ({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  // The art follows the card's corners.
  overflow: "hidden",
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  transition: "background-color 150ms ease, border-color 150ms ease",
  "&:hover": {
    backgroundColor: theme.palette.action.hover,
  },
  "&:focus-within": {
    borderColor: theme.palette.primary.main,
  },
  // As on rows: actions stay visible on touch screens and appear on hover with a mouse.
  "@media (hover: hover)": {
    "& .row-actions": { opacity: 0 },
    "&:hover .row-actions, &:focus-within .row-actions": { opacity: 1 },
  },
}));

const cardMain = (theme: Theme) =>
  ({
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    width: "100%",
    minWidth: 0,
    padding: 0,
    textAlign: "left",
    color: "inherit",
    font: "inherit",
    borderRadius: theme.shape.borderRadius,
  }) as const;

/** The card's open button: the art, title and meta line. */
export const CardMain = styled("button")(({ theme }) => ({
  ...cardMain(theme),
  appearance: "none",
  border: 0,
  background: "transparent",
  cursor: "pointer",
  // Inset: the card clips anything outside it.
  "&:focus-visible": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: -2,
  },
}));

/** CardMain's layout for a card with nothing to open (a deleted share in a collection). */
export const CardMainStatic = styled("div")(({ theme }) => cardMain(theme));

/**
 * The tinted top of a card, with the category icon (bundled, so no download
 * per card). Low on a phone in landscape, where Hub's app frame is about
 * 266 px tall and a full-height card would fill the list.
 */
export const CardArt = styled("span")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  height: 96,
  flexShrink: 0,
  backgroundColor: primarySoft(theme),
  color: theme.palette.text.secondary,
  [phone]: { height: 80 },
  [landscapePhone]: { height: 48 },
}));

/**
 * The whole icon, never cropped: Video and Book are wider than tall (about
 * 5:3), so the box is 3:2 and each icon fits inside it. No rounding: on a
 * fitted icon it would round the empty box, not the picture.
 */
export const CardIcon = styled("img")({
  width: 96,
  height: 64,
  objectFit: "contain",
  [phone]: { width: 80, height: 52 },
  [landscapePhone]: { width: 54, height: 36 },
});

export const CardBody = styled("span")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 0,
  padding: theme.spacing(1, 1.25, 0.5),
  [phone]: { padding: theme.spacing(1, 1, 0.5) },
}));

export const CardTitle = styled("span")(({ theme }) => ({
  fontSize: 15,
  fontWeight: 600,
  lineHeight: 1.3,
  color: theme.palette.text.primary,
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
  overflow: "hidden",
  wordBreak: "break-word",
}));

export const CardMeta = styled("span")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: theme.spacing(0, 0.75),
  color: theme.palette.text.secondary,
  fontSize: 13,
  lineHeight: 1.4,
  minWidth: 0,
}));

/**
 * Publisher and actions, at the bottom of the card so cards in one row line
 * up. The actions share the publisher's line when both fit and wrap below it
 * when not (always on a two-column phone grid).
 */
export const CardFooter = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: theme.spacing(0, 0.5),
  marginTop: "auto",
  padding: theme.spacing(0, 1.25, 0.75),
  minWidth: 0,
  [phone]: { padding: theme.spacing(0, 0.5, 0.5, 1) },
}));

export const CardPublisher = styled(NameLink)({
  maxWidth: "100%",
  minWidth: 0,
});

export const FiltersRail = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
  width: "100%",
  [theme.breakpoints.up("md")]: {
    width: 280,
    flexShrink: 0,
    position: "sticky",
    top: 72,
    alignSelf: "flex-start",
  },
}));
