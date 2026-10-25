import { AppBar, Typography } from "@mui/material";
import { styled, type Theme } from "@mui/material/styles";
import { headerFill, primarySoft } from "../../../hub-theme";
import { PHONE_MEDIA } from "../../../hooks/usePhoneLayout";
import { CartSVG } from "../../../assets/svgs/CartSVG";
import { HEADER_OFFSET } from "./useHideOnScroll";

/** The header's slide on phones; sticky sub-headers follow it with the same timing. */
const SLIDE = "180ms ease";

/**
 * Positions a page's sticky sub-header: just below the header while it
 * shows, at the top of the screen once it slides away, and under it in the
 * stacking order, so the header never comes back underneath. `padTop` is the
 * bar's own top padding; the notch inset is added only once the header has
 * gone and the bar is at the top.
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

/** The sticky, translucent header (docs/DESIGN.md → Layout → Headers). */
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
 * The header's content, in the same centred column as the pages' grid
 * (layout/Page.tsx: 1280 px with 16 / 24 px side padding), so the logo lines
 * up with the content's left edge. Phones keep an 8 px edge.
 */
export const HeaderInner = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
  width: "100%",
  maxWidth: 1280,
  minWidth: 0,
  minHeight: 56,
  padding: theme.spacing(0, 2),
  boxSizing: "border-box",
  [theme.breakpoints.up("sm")]: { padding: theme.spacing(0, 3) },
  // What the header drops to stay on one line, then the navigation's own row (useHeaderFit.ts measures and sets data-fit).
  '&[data-fit~="icons"] nav .MuiSvgIcon-root': { display: "none" },
  '&[data-fit~="name"] .qp-account-name': { display: "none" },
  '&[data-fit~="prefix"] .qp-rate-prefix': { display: "none" },
  '&[data-fit~="rate"] .qp-rate-text': { display: "none" },
  '&[data-fit~="rate"] .qp-quick-rate': { paddingLeft: theme.spacing(1), paddingRight: theme.spacing(1) },
  '&[data-fit~="rate"] .qp-quick-rate .MuiButton-startIcon': { margin: 0 },
  '&[data-fit~="title"] .qp-app-title': { display: "none" },
  '&[data-fit~="rows"]': { flexWrap: "wrap", rowGap: 0, paddingTop: theme.spacing(0.5), paddingBottom: theme.spacing(0.5) },
  '&[data-fit~="rows"] nav': { order: 1, flexBasis: "100%", marginLeft: 0, overflowX: "auto", scrollbarWidth: "none" },
  '&[data-fit~="rows"] .qp-quick-rate': { marginLeft: "auto" },
  '&[data-fit~="rows"]:has(.qp-quick-rate) .qp-header-actions': { marginLeft: 0 },
  // Last, so a landscape phone wider than 600 px gets the phone edge too.
  [`@media ${PHONE_MEDIA}`]: { padding: theme.spacing(0, 1) },
}));

export const LogoButton = styled("button")(({ theme }) => ({
  appearance: "none",
  flexShrink: 0,
  border: 0,
  background: "transparent",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
  padding: theme.spacing(0.5),
  minHeight: 44,
  borderRadius: theme.shape.borderRadius,
  color: theme.palette.primary.main,
  font: "inherit",
  // The logo, not the button's padding, starts at the column's edge.
  marginLeft: theme.spacing(-0.5),
  [`@media ${PHONE_MEDIA}`]: { marginLeft: 0 },
  "&:focus-visible": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
}));

/** The app's name beside the logo, in the page's own font (Raleway in Classic). */
export const AppTitle = styled("span")(({ theme }) => ({
  fontWeight: 700,
  fontSize: 18,
  lineHeight: 1,
  whiteSpace: "nowrap",
  color: theme.palette.text.primary,
}));

/** Shops, Orders and Manage Shop on desktop. */
export const DesktopNav = styled("nav")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(0.5),
  marginLeft: theme.spacing(2),
  minWidth: 0,
}));

export const NavLinkButton = styled("button", {
  shouldForwardProp: (prop) => prop !== "active",
})<{ active?: boolean }>(({ theme, active }) => ({
  appearance: "none",
  border: 0,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: theme.spacing(0.75),
  minHeight: 40,
  padding: theme.spacing(0.5, 1.5),
  borderRadius: 999,
  font: "inherit",
  fontSize: 15,
  fontWeight: active ? 700 : 500,
  whiteSpace: "nowrap",
  color: active ? theme.palette.primary.main : theme.palette.text.primary,
  backgroundColor: active ? primarySoft(theme) : "transparent",
  transition: "background-color 150ms ease, color 150ms ease",
  "& .MuiSvgIcon-root": { fontSize: 20 },
  "&:hover": { backgroundColor: active ? primarySoft(theme) : theme.palette.action.hover },
  "&:focus-visible": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
}));

export const HeaderActions = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(0.5),
  marginLeft: "auto",
  minWidth: 0,
  flexShrink: 0,
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
  "@media (hover: hover)": { "&:hover": { backgroundColor: theme.palette.action.hover } },
  "&:focus-visible": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
  [`@media ${PHONE_MEDIA}`]: {
    padding: theme.spacing(0.5),
    border: 0,
  },
}));

export const NavbarName = styled(Typography)(({ theme }) => ({
  fontSize: 15,
  fontWeight: 600,
  lineHeight: 1.3,
  color: theme.palette.text.primary,
  maxWidth: 160,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  // Narrower desktop headers drop it as they need (useHeaderFit.ts); phones keep the avatar.
  [`@media ${PHONE_MEDIA}`]: {
    display: "none",
  },
}));

/** A small uppercase title over a group of rows in the account menu. */
export const MenuSectionTitle = styled("p")(({ theme }) => ({
  margin: 0,
  padding: theme.spacing(1.25, 2, 0.5),
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: theme.palette.text.secondary,
}));

/**
 * The original's cart icon, still used by the shop and product pages. It
 * takes its colour from the `color` prop; the hover is theme-neutral.
 */
export const CartIcon = styled(CartSVG)({
  cursor: "pointer",
  transition: "opacity 150ms ease",
  "&:hover": { opacity: 0.75 },
});
