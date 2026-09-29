import { Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { headerFill } from "../../hub-theme";

export const Page = styled("div")(({ theme }) => ({
  width: "100%",
  maxWidth: 900,
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
  padding: theme.spacing(1.5, 2),
  paddingBottom: `calc(${theme.spacing(11)} + env(safe-area-inset-bottom, 0px))`,
  [theme.breakpoints.up("md")]: {
    padding: theme.spacing(2.5, 3),
    paddingBottom: theme.spacing(6),
  },
}));

/** Full-bleed sticky header for phones: Back, title, optional action. */
export const PhoneHeader = styled("header")(({ theme }) => ({
  position: "sticky",
  top: 0,
  zIndex: theme.zIndex.appBar + 1,
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(0.5),
  margin: theme.spacing(-1.5, -2, 0),
  padding: theme.spacing(0.5, 1),
  paddingTop: "calc(4px + env(safe-area-inset-top, 0px))",
  background: headerFill(theme),
  backdropFilter: "blur(20px) saturate(180%)",
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

export const HeaderRow = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
  flexWrap: "wrap",
}));

export const CardList = styled("ul")(({ theme }) => ({
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1),
  width: "100%",
}));

export const CardItem = styled("li")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: theme.spacing(0.5, 1.5),
  width: "100%",
  padding: theme.spacing(1.25, 1.5),
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  transition: "background-color 150ms ease, border-color 150ms ease",
  "&:hover": { backgroundColor: theme.palette.action.hover },
  "&:focus-within": { borderColor: theme.palette.primary.main },
}));

export const CardButton = styled("button")(({ theme }) => ({
  appearance: "none",
  border: 0,
  background: "transparent",
  color: "inherit",
  font: "inherit",
  textAlign: "left",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  gap: 2,
  flex: "1 1 220px",
  minWidth: 0,
  minHeight: 44,
  padding: 0,
  borderRadius: theme.shape.borderRadius,
  "&:focus-visible": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 4,
  },
}));

export const CardTitle = styled(Typography)(({ theme }) => ({
  fontSize: 16,
  fontWeight: 600,
  lineHeight: 1.3,
  color: theme.palette.text.primary,
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
  overflow: "hidden",
  wordBreak: "break-word",
}));

export const CardDescription = styled(Typography)(({ theme }) => ({
  fontSize: 14,
  color: theme.palette.text.secondary,
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
  overflow: "hidden",
  wordBreak: "break-word",
}));

export const CardMeta = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: theme.spacing(0.5, 1),
  marginTop: 2,
  color: theme.palette.text.secondary,
  fontSize: 13,
  minWidth: 0,
}));

export const PublisherLink = styled("button")(({ theme }) => ({
  appearance: "none",
  border: 0,
  background: "transparent",
  padding: theme.spacing(0.5, 0),
  minHeight: 36,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  marginLeft: "auto",
  color: theme.palette.text.secondary,
  font: "inherit",
  fontSize: 13,
  maxWidth: 220,
  "& span": { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  "&:hover span": { textDecoration: "underline", color: theme.palette.text.primary },
  "&:focus-visible": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
    borderRadius: 4,
  },
}));

export const InfoCard = styled("section")(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  gap: theme.spacing(2),
  flexWrap: "wrap",
  padding: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.paper,
}));

export const ItemRows = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1),
  width: "100%",
}));

export const ItemRow = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(0.5),
  width: "100%",
  "& > :first-of-type": { flex: 1, minWidth: 0 },
}));
