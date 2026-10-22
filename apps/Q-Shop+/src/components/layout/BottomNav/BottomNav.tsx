/**
 * The phone's navigation bar (docs/DESIGN.md → Mobile): Shops, Cart, Orders,
 * Sell and Settings, thumb-reachable at the bottom of the frame. On a phone
 * held sideways the bar is compact (icon and label side by side, 48 px), as
 * Hub's frame is only about 266 px tall there. Renders nothing on wider
 * screens, where the header carries the same items.
 */
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Badge } from "@mui/material";
import { styled } from "@mui/material/styles";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { headerFill, primarySoft } from "../../../hub-theme";
import { useLandscapePhone, usePhoneLayout } from "../../../hooks/usePhoneLayout";
import { cartLabel, navSection, useCartItemCount, usePendingOrderCount, useSell, type NavSection } from "../shellState";

/** Height of the bar without the safe-area inset; the spacer and the toasts use it too. */
export const BOTTOM_NAV_HEIGHT = 64;
/** The bar on a phone in landscape (docs/QORTAL.md → pitfall 3 asks for 52 px or less). */
export const COMPACT_BOTTOM_NAV_HEIGHT = 48;

const LABEL_CLASS = "BottomNav-label";
const INDICATOR_CLASS = "BottomNav-indicator";

const Bar = styled("nav", { shouldForwardProp: (prop) => prop !== "compact" })<{ compact?: boolean }>(
  ({ theme, compact }) => ({
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: theme.zIndex.appBar,
    display: "flex",
    alignItems: "stretch",
    justifyContent: "space-around",
    height: `calc(${compact ? COMPACT_BOTTOM_NAV_HEIGHT : BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
    paddingBottom: "env(safe-area-inset-bottom, 0px)",
    paddingLeft: "env(safe-area-inset-left, 0px)",
    paddingRight: "env(safe-area-inset-right, 0px)",
    backgroundColor: headerFill(theme, "chromeStrong"),
    backdropFilter: "blur(20px) saturate(180%)",
    WebkitBackdropFilter: "blur(20px) saturate(180%)",
    borderTop: `1px solid ${theme.palette.divider}`,
    boxSizing: "border-box",
  })
);

const Item = styled("button", {
  shouldForwardProp: (prop) => prop !== "active" && prop !== "compact",
})<{ active?: boolean; compact?: boolean }>(({ theme, active, compact }) => ({
  appearance: "none",
  border: 0,
  background: "transparent",
  cursor: "pointer",
  flex: "1 1 0",
  minWidth: 44,
  minHeight: 44,
  display: "flex",
  // Compact: icon and label side by side, so the bar can be 48 px tall.
  flexDirection: compact ? "row" : "column",
  alignItems: "center",
  justifyContent: "center",
  gap: compact ? 6 : 2,
  padding: theme.spacing(0.5, 0.25),
  font: "inherit",
  fontSize: compact ? 13 : 12,
  fontWeight: active ? 700 : 500,
  lineHeight: 1.2,
  color: active ? theme.palette.primary.main : theme.palette.text.secondary,
  borderRadius: theme.shape.borderRadius,
  transition: "color 150ms ease",
  [`& .${INDICATOR_CLASS}`]: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: compact ? theme.spacing(0.25, 1) : theme.spacing(0.25, 2),
    borderRadius: 999,
    backgroundColor: active ? primarySoft(theme) : "transparent",
    transition: "background-color 150ms ease",
  },
  "& .MuiSvgIcon-root": { fontSize: compact ? 22 : 24 },
  [`& .${LABEL_CLASS}`]: {
    maxWidth: "100%",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  // Hover only where there is a pointer that hovers: on touch screens :hover sticks after a tap.
  "@media (hover: hover)": {
    [`&:hover .${INDICATOR_CLASS}`]: { backgroundColor: active ? primarySoft(theme) : theme.palette.action.hover },
  },
  "&:focus-visible": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: -2,
  },
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
    [`& .${INDICATOR_CLASS}`]: { transition: "none" },
  },
}));

/** The cart icon with its item count, and a dot while paid orders wait to be finished. */
export function CartBadgeIcon({ items, pending }: { items: number; pending: number }) {
  return (
    <Badge
      variant="dot"
      color="warning"
      invisible={pending === 0}
      overlap="circular"
      anchorOrigin={{ vertical: "top", horizontal: "left" }}
    >
      <Badge color="primary" badgeContent={items} max={99} overlap="circular">
        <ShoppingCartOutlinedIcon />
      </Badge>
    </Badge>
  );
}

interface NavItem {
  key: NavSection;
  label: string;
  ariaLabel?: string;
  icon: ReactNode;
  onClick: () => void;
}

export function BottomNav() {
  const phone = usePhoneLayout();
  const compact = useLandscapePhone();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const items = useCartItemCount();
  const pending = usePendingOrderCount();
  const sell = useSell();

  if (!phone) return null;

  const section = navSection(pathname);
  const nav: NavItem[] = [
    { key: "shops", label: "Shops", icon: <StorefrontOutlinedIcon />, onClick: () => navigate("/") },
    {
      key: "cart",
      label: "Cart",
      ariaLabel: cartLabel(items, pending),
      icon: <CartBadgeIcon items={items} pending={pending} />,
      onClick: () => navigate("/cart"),
    },
    { key: "orders", label: "Orders", icon: <ReceiptLongOutlinedIcon />, onClick: () => navigate("/my-orders") },
    { key: "sell", label: "Sell", icon: <SellOutlinedIcon />, onClick: sell },
    { key: "settings", label: "Settings", icon: <SettingsOutlinedIcon />, onClick: () => navigate("/settings") },
  ];

  return (
    <Bar aria-label="Main" compact={compact}>
      {nav.map((item) => {
        const active = item.key === section;
        return (
          <Item
            key={item.key}
            type="button"
            compact={compact}
            active={active}
            aria-label={item.ariaLabel}
            aria-current={active ? "page" : undefined}
            onClick={item.onClick}
          >
            <span className={INDICATOR_CLASS} aria-hidden>
              {item.icon}
            </span>
            <span className={LABEL_CLASS}>{item.label}</span>
          </Item>
        );
      })}
    </Bar>
  );
}

/** How much of the bottom of a phone screen the bar covers (without the safe-area inset); 0 on wider screens. */
export function useBottomChromeHeight(): number {
  const phone = usePhoneLayout();
  const compact = useLandscapePhone();
  if (!phone) return 0;
  return compact ? COMPACT_BOTTOM_NAV_HEIGHT : BOTTOM_NAV_HEIGHT;
}

/** Keeps the page's last content clear of the fixed bar. Phones only. */
export function BottomNavSpacer() {
  const height = useBottomChromeHeight();
  if (!height) return null;
  return (
    <div
      aria-hidden
      data-testid="bottom-nav-spacer"
      style={{ height: `calc(${height}px + env(safe-area-inset-bottom, 0px))`, flexShrink: 0 }}
    />
  );
}

export default BottomNav;
