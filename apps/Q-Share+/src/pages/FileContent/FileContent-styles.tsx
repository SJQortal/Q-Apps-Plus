import type { ElementType } from "react";
import { Box, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { headerFill } from "../../hub-theme";

/** One column, phone first; 900 px wide on desktop. */
export const Page = styled(Box)(({ theme }) => ({
  width: "100%",
  maxWidth: 900,
  margin: "0 auto",
  padding: theme.spacing(1.5, 2),
  paddingBottom: `calc(${theme.spacing(6)} + env(safe-area-inset-bottom, 0px))`,
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
  minWidth: 0,
  [theme.breakpoints.up("md")]: {
    padding: theme.spacing(2.5, 3),
  },
}));

/** Sticky sub-header on phones: Back plus the truncated title. */
export const SubHeader = styled("header")(({ theme }) => ({
  position: "sticky",
  top: 0,
  zIndex: theme.zIndex.appBar + 1,
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(0.5),
  margin: theme.spacing(-1.5, -2, 0),
  padding: theme.spacing(0.5, 0.5),
  paddingTop: `calc(${theme.spacing(0.5)} + env(safe-area-inset-top, 0px))`,
  background: headerFill(theme),
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

export const Card = styled("section")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1.5),
  width: "100%",
  minWidth: 0,
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
}));

export const FileTitle = styled(Typography)<{ component?: ElementType }>(({ theme }) => ({
  fontSize: 20,
  fontWeight: 700,
  lineHeight: 1.3,
  color: theme.palette.text.primary,
  overflowWrap: "anywhere",
  wordBreak: "break-word",
  minWidth: 0,
  [theme.breakpoints.up("sm")]: {
    fontSize: 24,
  },
}));

export const CategoryIcon = styled("img")(({ theme }) => ({
  width: 48,
  height: 48,
  flexShrink: 0,
  borderRadius: theme.shape.borderRadius,
  objectFit: "cover",
}));

/** "by <name>" with the avatar, as a real button so it is focusable and 44 px tall. */
export const AuthorLink = styled("button")(({ theme }) => ({
  appearance: "none",
  border: 0,
  background: "transparent",
  padding: theme.spacing(0.5, 0),
  minHeight: 44,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: theme.spacing(1),
  color: theme.palette.text.secondary,
  font: "inherit",
  fontSize: 15,
  maxWidth: "100%",
  textAlign: "left",
  "& span": { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  "& strong": { color: theme.palette.text.primary, fontWeight: 600 },
  "&:hover strong": { textDecoration: "underline" },
  "&:focus-visible": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
    borderRadius: theme.shape.borderRadius,
  },
}));

export const Meta = styled(Typography)(({ theme }) => ({
  fontSize: 14,
  color: theme.palette.text.secondary,
  overflowWrap: "anywhere",
}));

/** Big primary buttons: stacked and full width on phones, a wrapped row above. */
export const ActionRow = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1),
  width: "100%",
  "& > *": { width: "100%" },
  "& .MuiButton-root": { minHeight: 48, fontSize: 15 },
  [theme.breakpoints.up("sm")]: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    "& > *": { width: "auto" },
    "& .MuiButton-root": { minHeight: 44 },
  },
}));

export const FileDescription = styled(Typography)(({ theme }) => ({
  fontSize: 16,
  lineHeight: 1.5,
  color: theme.palette.text.primary,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
}));

export const DescriptionFade = styled("div")(({ theme }) => ({
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  height: 72,
  pointerEvents: "none",
  background: `linear-gradient(to bottom, transparent, ${theme.palette.background.paper})`,
}));

export const FileList = styled("ul")(({ theme }) => ({
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1.5),
  width: "100%",
  minWidth: 0,
}));

export const SectionTitle = styled(Typography)<{ component?: ElementType }>(({ theme }) => ({
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: theme.palette.text.secondary,
}));
