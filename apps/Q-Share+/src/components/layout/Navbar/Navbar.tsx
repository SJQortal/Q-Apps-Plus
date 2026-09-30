import React, { useReducer, useRef, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  IconButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  MenuList,
  Popover,
  Tooltip,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import CollectionsBookmarkOutlinedIcon from "@mui/icons-material/CollectionsBookmarkOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PersonOffOutlinedIcon from "@mui/icons-material/PersonOffOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { useInView } from "react-intersection-observer";
import { useLocation, useNavigate } from "react-router-dom";
import { BlockedNamesModal } from "../../common/BlockedNamesModal/BlockedNamesModal";
import { BottomSheet } from "../../common/mobile/BottomSheet";
import { DownloadTaskManager } from "../../common/DownloadTaskManager";
import { PublishFile } from "../../PublishFile/PublishFile.tsx";
import QShareLogoSrc from "../../../assets/img/q-share-icon.webp";
import { primarySoft } from "../../../hub-theme";
import { PHONE_MEDIA, usePhoneLayout } from "../../../hooks/usePhoneLayout";
import { avatarUrl } from "../../../utils/qortalLinks";
import {
  AppTagline,
  AppTitle,
  AvatarContainer,
  Brand,
  CustomAppBar,
  HeaderInner,
  LogoContainer,
  NavbarName,
  TaglineSlot,
} from "./Navbar-styles";
import { useHideOnScroll, usePublishHeaderOffset } from "./useHideOnScroll";

interface Props {
  isAuthenticated: boolean;
  userName: string | null;
  userAvatar: string;
  authenticate: () => void;
  /** Show Sign in: no account and no request out (Hub was declined, or answered too late). */
  canSignIn?: boolean;
  accountNames: { name: string }[];
  setActiveName: (name: string) => void;
}

const NAV_BUTTON_SX = { color: "text.primary", minWidth: 44, minHeight: 44 } as const;

/**
 * The account menu's first column (MenuItem gives ListItemIcon 36 px):
 * 32 px avatars and 20 px icons share one centre line.
 */
const MENU_LEAD_SX = { width: 36, mr: 1, justifyContent: "center" } as const;

/**
 * Account-menu rows are 44 px tap targets wherever the phone layout applies,
 * landscape phones 600 px and wider included. A plain `minHeight` loses to
 * MenuItem's own `min-height: auto` from 600 px up, a media rule emitted
 * after it; this one is emitted later still, so it wins.
 */
const MENU_ROW_SX = { [`@media ${PHONE_MEDIA}`]: { minHeight: 44 } } as const;

/**
 * What each avatar URL did this session. Most names have no avatar, and a
 * 404 is not cached, so a name known to have none shows its letter on every
 * later open without asking again. One that loaded shows at once (from the
 * browser's image cache) instead of waiting to scroll into view.
 */
const avatarResults = new Map<string, "loaded" | "missing">();

const AVATAR_IMG_STYLE = { width: "100%", height: "100%", objectFit: "cover" } as const;

/**
 * A name's avatar (its `qortal_avatar` thumbnail), or the name's first letter
 * when it has none. Hidden from screen readers: the name beside it says it.
 *
 * A plain <img>, not Avatar's `src`: MUI preloads every `src` with
 * `new Image()` as soon as the Avatar mounts, whatever `loading` says, so
 * opening the menu asked for every name's avatar at once. A menu row asks
 * only once it scrolls into the menu's view; `eager` is for the header's own.
 */
function NameAvatar({ name, src, size, eager = false }: { name: string; src?: string; size: number; eager?: boolean }) {
  const url = src || avatarUrl(name);
  const known = avatarResults.get(url);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const { ref, inView } = useInView({ triggerOnce: true, skip: eager || known !== undefined });
  const settle = (result: "loaded" | "missing") => {
    if (avatarResults.get(url) === result) return;
    avatarResults.set(url, result);
    rerender();
  };
  const requested = known === "loaded" || (known === undefined && (eager || inView));

  return (
    <Avatar
      ref={ref}
      aria-hidden
      sx={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.45),
        fontWeight: 700,
        // The tint holds the spot until the image is in, and backs the letter.
        bgcolor: known === "loaded" ? "transparent" : primarySoft,
        color: "primary.main",
      }}
    >
      {requested ? (
        <img src={url} alt="" onLoad={() => settle("loaded")} onError={() => settle("missing")} style={AVATAR_IMG_STYLE} />
      ) : (
        // Always a child, even while it waits: without one MUI draws its generic person icon.
        <span>{known === "missing" ? Array.from(name)[0]?.toUpperCase() : null}</span>
      )}
    </Avatar>
  );
}

/**
 * The sticky header. On phones it slides away when you scroll down and comes
 * back when you scroll up; the rest of the navigation lives in BottomNav.
 */
const NavBar: React.FC<Props> = ({
  isAuthenticated,
  userName,
  userAvatar,
  authenticate,
  canSignIn = false,
  accountNames,
  setActiveName,
}) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const phone = usePhoneLayout();
  const { hidden, reveal } = useHideOnScroll(phone);
  // The pages' sticky sub-headers stack under the header using this (Navbar-styles stickyBelowHeader).
  const headerRef = useRef<HTMLElement>(null);
  usePublishHeaderOffset(headerRef, hidden);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isOpenBlockedNamesModal, setIsOpenBlockedNamesModal] = useState<boolean>(false);

  const menuOpen = phone ? sheetOpen : Boolean(anchorEl);
  const closeMenu = () => {
    setAnchorEl(null);
    setSheetOpen(false);
  };
  const openMenu = (e: React.MouseEvent<HTMLElement>) => {
    if (phone) setSheetOpen(true);
    else setAnchorEl(e.currentTarget);
  };

  const names = accountNames.filter((n) => n.name);
  const signedIn = isAuthenticated && !!userName;

  // Mounted only while the menu is open (Popover and BottomSheet both unmount
  // their content when closed); each other name's avatar loads once its row
  // scrolls into view (NameAvatar).
  const menuItems = (
    <MenuList disablePadding aria-label="Account menu" sx={{ minWidth: 220 }}>
      {names.map((n) => {
        const active = n.name === userName;
        return (
          <MenuItem
            key={n.name}
            role="menuitemradio"
            aria-checked={active}
            selected={active}
            onClick={() => {
              setActiveName(n.name);
              closeMenu();
            }}
            sx={MENU_ROW_SX}
          >
            <ListItemIcon sx={MENU_LEAD_SX}>
              {/* The active name reuses the header's avatar URL, already loaded. */}
              <NameAvatar name={n.name} src={active ? userAvatar : undefined} size={32} />
            </ListItemIcon>
            <ListItemText primary={n.name} slotProps={{ primary: { noWrap: true } }} />
            {active && <CheckIcon fontSize="small" sx={{ color: "primary.main", ml: 1, flexShrink: 0 }} />}
          </MenuItem>
        );
      })}
      <MenuItem
        onClick={() => {
          closeMenu();
          setIsOpenBlockedNamesModal(true);
        }}
        sx={{ ...MENU_ROW_SX, borderTop: names.length ? 1 : 0, borderColor: "divider" }}
      >
        <ListItemIcon sx={MENU_LEAD_SX}>
          <PersonOffOutlinedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Blocked names" />
      </MenuItem>
      <MenuItem
        selected={pathname.startsWith("/settings")}
        onClick={() => {
          closeMenu();
          navigate("/settings");
        }}
        sx={MENU_ROW_SX}
      >
        <ListItemIcon sx={MENU_LEAD_SX}>
          <SettingsOutlinedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Settings" />
      </MenuItem>
    </MenuList>
  );

  return (
    <CustomAppBar ref={headerRef} position="sticky" elevation={0} collapsed={hidden} onFocus={reveal}>
      <HeaderInner>
        <Brand>
          <LogoContainer type="button" onClick={() => navigate("/")} aria-label="Q-Share+ home">
            <img src={QShareLogoSrc} alt="" width={36} height={36} style={{ width: "auto", height: 36 }} />
            <AppTitle>Q-Share+</AppTitle>
          </LogoContainer>
          {/* Beside the title, outside the button, so the button's name holds all its visible text. */}
          {!phone && (
            <TaglineSlot>
              <AppTagline>Public file sharing on Qortal</AppTagline>
            </TaglineSlot>
          )}
        </Brand>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
          {!phone && (
            <Tooltip title="Collections">
              <IconButton
                aria-label="Collections"
                aria-current={pathname.startsWith("/collections") ? "page" : undefined}
                onClick={() => navigate("/collections")}
                sx={{ ...NAV_BUTTON_SX, color: pathname.startsWith("/collections") ? "primary.main" : "text.primary" }}
              >
                <CollectionsBookmarkOutlinedIcon />
              </IconButton>
            </Tooltip>
          )}
          <DownloadTaskManager hideButton={phone} />
          {!phone && (
            <Tooltip title="Settings">
              <IconButton
                aria-label="Settings"
                aria-current={pathname.startsWith("/settings") ? "page" : undefined}
                onClick={() => navigate("/settings")}
                sx={{ ...NAV_BUTTON_SX, color: pathname.startsWith("/settings") ? "primary.main" : "text.primary" }}
              >
                <SettingsOutlinedIcon />
              </IconButton>
            </Tooltip>
          )}
          {canSignIn && (
            <Button
              variant="contained"
              onClick={authenticate}
              sx={{ minHeight: phone ? 44 : 40, flexShrink: 0, whiteSpace: "nowrap" }}
            >
              Sign in
            </Button>
          )}
          {signedIn && <PublishFile hideTrigger={phone} />}
          {signedIn && (
            <AvatarContainer
              type="button"
              aria-label={`Account menu for ${userName}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={openMenu}
            >
              <NameAvatar name={userName} src={userAvatar} size={28} eager />
              <NavbarName>{userName}</NavbarName>
              {!phone && <ExpandMoreIcon fontSize="small" sx={{ color: "text.secondary" }} />}
            </AvatarContainer>
          )}

          {phone ? (
            <BottomSheet open={sheetOpen} onClose={closeMenu} title={userName || "Account"}>
              {menuItems}
            </BottomSheet>
          ) : (
            <Popover
              id="user-popover"
              open={Boolean(anchorEl)}
              anchorEl={anchorEl}
              onClose={closeMenu}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
              slotProps={{ paper: { role: "dialog", "aria-label": "Account menu" } }}
            >
              {menuItems}
            </Popover>
          )}
          {isOpenBlockedNamesModal && (
            <BlockedNamesModal open={isOpenBlockedNamesModal} onClose={() => setIsOpenBlockedNamesModal(false)} />
          )}
        </Box>
      </HeaderInner>
    </CustomAppBar>
  );
};

export default NavBar;
