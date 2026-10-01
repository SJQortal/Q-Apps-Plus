import React, { useRef, useState } from "react";
import {
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
import CollectionsBookmarkOutlinedIcon from "@mui/icons-material/CollectionsBookmarkOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PersonOffOutlinedIcon from "@mui/icons-material/PersonOffOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { useLocation, useNavigate } from "react-router-dom";
import { BlockedNamesModal } from "../../common/BlockedNamesModal/BlockedNamesModal";
import { BottomSheet } from "../../common/mobile/BottomSheet";
import { NameAvatar } from "../../common/NameAvatar";
import { NameSwitcher } from "../../common/NameSwitcher";
import { DownloadTaskManager } from "../../common/DownloadTaskManager";
import { PublishFile } from "../../PublishFile/PublishFile.tsx";
import QShareLogoSrc from "../../../assets/img/q-share-icon.webp";
import { PHONE_MEDIA, usePhoneLayout } from "../../../hooks/usePhoneLayout";
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

  // ↑ and ↓ run through the names and the rows under them as one menu, wrapping
  // at the ends; ↑ from the top row goes to the name search when there is one.
  const onMenuArrows = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const rows = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role^="menuitem"]'));
    const at = rows.indexOf(event.target as HTMLElement);
    if (at === -1) return;
    event.preventDefault();
    event.stopPropagation();
    const search = event.currentTarget.querySelector("input");
    if (event.key === "ArrowUp" && at === 0 && search) search.focus();
    else rows[event.key === "ArrowDown" ? (at + 1) % rows.length : (at - 1 + rows.length) % rows.length].focus();
  };

  // Mounted only while the menu is open (Popover and BottomSheet both unmount
  // their content when closed); each other name's avatar loads once its row
  // scrolls into view (NameAvatar). Many names get a search field (NameSwitcher).
  const menuItems = (
    <Box sx={{ minWidth: 260, maxWidth: phone ? undefined : 340 }} onKeyDownCapture={onMenuArrows}>
      {names.length > 0 && (
        <NameSwitcher
          names={names.map((n) => n.name)}
          activeName={userName}
          activeAvatar={userAvatar}
          onPick={(name) => {
            setActiveName(name);
            closeMenu();
          }}
          autoFocusSearch={!phone}
          onEscape={closeMenu}
          // The search field stays put above a list that scrolls. On phones the list
          // leaves room in the 85dvh sheet for its title, the field and the two rows
          // below; on desktop it keeps at least two rows in a short window.
          maxListHeight={
            phone
              ? "min(45dvh, 360px, max(88px, calc(85dvh - 216px)))"
              : "max(88px, min(360px, calc(var(--qshare-app-height, 100dvh) - 220px)))"
          }
        />
      )}
      <MenuList disablePadding aria-label="Account menu" sx={{ borderTop: names.length ? 1 : 0, borderColor: "divider" }}>
        <MenuItem
          onClick={() => {
            closeMenu();
            setIsOpenBlockedNamesModal(true);
          }}
          sx={MENU_ROW_SX}
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
    </Box>
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
