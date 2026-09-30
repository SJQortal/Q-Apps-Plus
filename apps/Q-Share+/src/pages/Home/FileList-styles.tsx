import { Box, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { PHONE_MEDIA } from "../../hooks/usePhoneLayout";

const phone = `@media ${PHONE_MEDIA}`;

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
