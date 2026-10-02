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

/**
 * The logo button and the tagline on one line, the tagline's text on the
 * title's baseline. It takes the width the actions leave, so they stay at the
 * column's right edge.
 */
export const Brand = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "baseline",
  columnGap: theme.spacing(0.75),
  flex: "1 1 auto",
}));

export const LogoContainer = styled("button")(({ theme }) => ({
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

/**
 * The title and the tagline inherit the page's body font, as Typography's
 * body1 would give them, so both follow the theme (Raleway in Classic).
 */
export const AppTitle = styled("span")(({ theme }) => ({
  fontWeight: 700,
  fontSize: 18,
  whiteSpace: "nowrap",
  color: theme.palette.text.primary,
  // The button's only baseline item, so the button's baseline is the title's
  // and the tagline beside it lines up. The 36 px line fills the button's
  // content box (44 px less padding), so the title stays centred on the logo.
  alignSelf: "baseline",
  lineHeight: "36px",
}));

const TAGLINE_LINE = 20;

/**
 * Room for the tagline: whatever the logo and the actions leave (its own
 * width is 0, so it never pushes them). The tagline shows only where it fits
 * whole; otherwise it wraps onto a second line that the fixed height clips,
 * so the header never grows and never shows half a tagline. The zero-width
 * space keeps the slot's baseline where the tagline's would be once it wraps.
 */
export const TaglineSlot = styled("div")({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "baseline",
  flex: "1 1 0",
  width: 0,
  minWidth: 0,
  height: TAGLINE_LINE,
  overflow: "hidden",
  fontSize: 13,
  lineHeight: `${TAGLINE_LINE}px`,
  "&::before": { content: '"\\200B"' },
});

export const AppTagline = styled("p")(({ theme }) => ({
  margin: 0,
  whiteSpace: "nowrap",
  color: theme.palette.text.secondary,
  // A quiet rule between the title and the tagline.
  "&::before": {
    content: '""',
    display: "inline-block",
    width: 1,
    height: 14,
    marginRight: theme.spacing(1.25),
    verticalAlign: "middle",
    backgroundColor: theme.palette.divider,
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
