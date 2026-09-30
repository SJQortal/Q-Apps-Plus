import { useMemo, type ReactNode } from "react";
import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { Badge, Fab } from "@mui/material";
import { styled } from "@mui/material/styles";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import CollectionsBookmarkOutlinedIcon from "@mui/icons-material/CollectionsBookmarkOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import { headerFill, primarySoft } from "../../../hub-theme";
import { usePhoneLayout } from "../../../hooks/usePhoneLayout";
import { requestOpenPublish } from "../../../constants/events";
import { RootState } from "../../../state/store";
import { requestOpenDownloads } from "./events";

/** Height of the bar without the safe-area inset; the spacer and the Fab use it too. */
export const BOTTOM_NAV_HEIGHT = 72;
/** The floating Share button's size and its gap above the bar. */
const FAB_SIZE = 56;
const FAB_GAP = 16;

const Bar = styled("nav")(({ theme }) => ({
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: theme.zIndex.appBar,
  display: "flex",
  alignItems: "stretch",
  justifyContent: "space-around",
  height: `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
  paddingBottom: "env(safe-area-inset-bottom, 0px)",
  paddingLeft: "env(safe-area-inset-left, 0px)",
  paddingRight: "env(safe-area-inset-right, 0px)",
  backgroundColor: headerFill(theme, "chromeStrong"),
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  borderTop: `1px solid ${theme.palette.divider}`,
}));

const Item = styled("button", {
  shouldForwardProp: (prop) => prop !== "active",
})<{ active?: boolean }>(({ theme, active }) => ({
  appearance: "none",
  border: 0,
  background: "transparent",
  cursor: "pointer",
  flex: 1,
  minWidth: 44,
  minHeight: 44,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 2,
  padding: theme.spacing(0.5, 0.5),
  font: "inherit",
  fontSize: 12,
  fontWeight: active ? 700 : 500,
  lineHeight: 1.2,
  color: active ? theme.palette.primary.main : theme.palette.text.secondary,
  borderRadius: theme.shape.borderRadius,
  transition: "color 150ms ease, background-color 150ms ease",
  "& .MuiSvgIcon-root": { fontSize: 26 },
  "&:hover": { backgroundColor: primarySoft(theme) },
  "&:focus-visible": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: -2,
  },
  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
}));

const ShareFab = styled(Fab)(({ theme }) => ({
  position: "fixed",
  right: `calc(${theme.spacing(2)} + env(safe-area-inset-right, 0px))`,
  bottom: `calc(${BOTTOM_NAV_HEIGHT + FAB_GAP}px + env(safe-area-inset-bottom, 0px))`,
  width: FAB_SIZE,
  height: FAB_SIZE,
  zIndex: theme.zIndex.appBar,
  boxShadow: theme.shadows[6],
}));

interface NavItem {
  key: string;
  label: string;
  ariaLabel: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}

/**
 * The phone navigation bar (DESIGN.md → Mobile): four thumb-reachable items
 * and a floating Share button. Renders nothing on wider screens.
 */
export function BottomNav() {
  const phone = usePhoneLayout();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const signedIn = useSelector((state: RootState) => Boolean(state.auth.user?.name));
  const downloads = useSelector((state: RootState) => state.global.downloads);
  const downloadCount = useMemo(() => Object.keys(downloads ?? {}).length, [downloads]);

  if (!phone) return null;

  const isHome = pathname === "/";
  const items: NavItem[] = [
    {
      key: "home",
      label: "Home",
      ariaLabel: "Home",
      icon: <HomeOutlinedIcon />,
      active: isHome,
      onClick: () => navigate("/"),
    },
    {
      key: "collections",
      label: "Collections",
      ariaLabel: "Collections",
      icon: <CollectionsBookmarkOutlinedIcon />,
      active: pathname.startsWith("/collections"),
      onClick: () => navigate("/collections"),
    },
    {
      key: "downloads",
      label: "Downloads",
      ariaLabel: downloadCount ? `Downloads, ${downloadCount} in the list` : "Downloads",
      icon: (
        <Badge color="primary" badgeContent={downloadCount} max={99} overlap="circular">
          <DownloadOutlinedIcon />
        </Badge>
      ),
      active: false,
      onClick: () => {
        // The downloads view belongs to DownloadTaskManager; ask it to open, or go where its button is.
        if (!requestOpenDownloads() && !isHome) navigate("/");
      },
    },
    {
      key: "settings",
      label: "Settings",
      ariaLabel: "Settings",
      icon: <SettingsOutlinedIcon />,
      active: pathname.startsWith("/settings"),
      onClick: () => navigate("/settings"),
    },
  ];

  return (
    <>
      <Bar aria-label="Main">
      {signedIn && (
        <ShareFab color="primary" aria-label="Share files" onClick={requestOpenPublish}>
          <UploadFileOutlinedIcon />
        </ShareFab>
      )}
        {items.map((item) => (
          <Item
            key={item.key}
            type="button"
            active={item.active}
            aria-label={item.ariaLabel}
            aria-current={item.active ? "page" : undefined}
            onClick={item.onClick}
          >
            {item.icon}
            <span>{item.label}</span>
          </Item>
        ))}
      </Bar>
    </>
  );
}

/**
 * Keeps the page's last content clear of the fixed bar and, when signed in,
 * of the Share button floating above it (in Hub it covered the end of
 * "Submit comment"). Phones only.
 */
export function BottomNavSpacer() {
  const phone = usePhoneLayout();
  const signedIn = useSelector((state: RootState) => Boolean(state.auth.user?.name));
  if (!phone) return null;
  const height = BOTTOM_NAV_HEIGHT + (signedIn ? FAB_GAP + FAB_SIZE : 0);
  return (
    <div
      aria-hidden
      data-testid="bottom-nav-spacer"
      style={{ height: `calc(${height}px + env(safe-area-inset-bottom, 0px))`, flexShrink: 0 }}
    />
  );
}

export default BottomNav;
