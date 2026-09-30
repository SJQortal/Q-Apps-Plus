import { AppBar, Typography } from "@mui/material";
import { styled, type Theme } from "@mui/material/styles";
import { headerFill } from "../../../hub-theme";
import { PHONE_MEDIA } from "../../../hooks/usePhoneLayout";
import { HEADER_OFFSET } from "./useHideOnScroll";

/** The header's slide on phones; sticky sub-headers follow it with the same timing. */
const SLIDE = "180ms ease";

/**
 * Positions a page's sticky sub-header (Back plus title): just below the
 * header while it shows, at the top of the screen once it slides away, and
 * under it in the stacking order, so the header never comes back underneath.
 * `padTop` is the bar's own top padding; the notch inset is added only once
 * the header has gone and the bar is at the top.
 */
export const stickyBelowHeader = (theme: Theme, padTop: string) =>
  ({
    position: "sticky",
    top: HEADER_OFFSET,
    zIndex: theme.zIndex.appBar - 1,
    paddingTop: `max(${padTop}, calc(${padTop} + env(safe-area-inset-top, 0px) - ${HEADER_OFFSET}))`,
    transition: `top ${SLIDE}`,
    "@media (prefers-reduced-motion: reduce)": { transition: "none" },
  }) as const;

export const CustomAppBar = styled(AppBar, {
  shouldForwardProp: (prop) => prop !== "collapsed",
})<{ collapsed?: boolean }>(({ theme, collapsed }) => ({
  display: "flex",
  flexDirection: "row",
  justifyContent: "center",
  alignItems: "center",
  width: "100%",
  minHeight: 56,
  backgroundImage: "none",
  backgroundColor: headerFill(theme),
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  borderBottom: `1px solid ${theme.palette.divider}`,
  color: theme.palette.text.primary,
  boxShadow: "none",
  paddingTop: "env(safe-area-inset-top, 0px)",
  paddingLeft: "env(safe-area-inset-left, 0px)",
  paddingRight: "env(safe-area-inset-right, 0px)",
  transform: collapsed ? "translateY(-100%)" : "translateY(0)",
  transition: `transform ${SLIDE}`,
  willChange: "transform",
  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
}));

/**
 * The header's content, in the same centred column as Home's (1200 px wide
 * with the page's 16 / 24 px side padding), so on a wide window the logo
 * lines up with the content's left edge and the actions end at its right
 * edge instead of at the window's. Phones keep their 8 px edge.
 */
export const HeaderInner = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(0.5),
  width: "100%",
  maxWidth: 1200,
  minWidth: 0,
  padding: theme.spacing(0, 2),
  [theme.breakpoints.up("md")]: { padding: theme.spacing(0, 3) },
  // Last, so a landscape phone wider than 900 px gets the phone edge too.
  [`@media ${PHONE_MEDIA}`]: { padding: theme.spacing(0, 1) },
}));

export const LogoContainer = styled("button")(({ theme }) => ({
  appearance: "none",
  border: 0,
  background: "transparent",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
  padding: theme.spacing(0.5),
  minHeight: 44,
  borderRadius: theme.shape.borderRadius,
  color: "inherit",
  font: "inherit",
  minWidth: 0,
  // The logo image, not the button's padding, starts at the column's edge.
  marginLeft: theme.spacing(-0.5),
  [`@media ${PHONE_MEDIA}`]: { marginLeft: 0 },
  "&:focus-visible": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
}));

export const AppTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  fontSize: 18,
  whiteSpace: "nowrap",
  color: theme.palette.text.primary,
}));

export const AppTagline = styled(Typography)(({ theme }) => ({
  fontSize: 13,
  whiteSpace: "nowrap",
  color: theme.palette.text.secondary,
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}));

export const AvatarContainer = styled("button")(({ theme }) => ({
  appearance: "none",
  border: `1px solid ${theme.palette.divider}`,
  background: "transparent",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
  padding: theme.spacing(0.5, 1, 0.5, 0.5),
  minHeight: 44,
  minWidth: 44,
  justifyContent: "center",
  borderRadius: 999,
  color: theme.palette.text.primary,
  font: "inherit",
  transition: "background-color 150ms ease",
  "&:hover": { backgroundColor: theme.palette.action.hover },
  "&:focus-visible": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
  [theme.breakpoints.down("sm")]: {
    padding: theme.spacing(0.5),
    border: 0,
  },
}));

export const NavbarName = styled(Typography)(({ theme }) => ({
  fontSize: 15,
  fontWeight: 600,
  color: theme.palette.text.primary,
  maxWidth: 160,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  [theme.breakpoints.down("sm")]: {
    display: "none",
  },
}));
