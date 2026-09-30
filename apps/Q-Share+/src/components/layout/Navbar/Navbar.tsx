import React, { useRef, useState } from "react";
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
import { useLocation, useNavigate } from "react-router-dom";
import { BlockedNamesModal } from "../../common/BlockedNamesModal/BlockedNamesModal";
import { BottomSheet } from "../../common/mobile/BottomSheet";
import { DownloadTaskManager } from "../../common/DownloadTaskManager";
import { PublishFile } from "../../PublishFile/PublishFile.tsx";
import QShareLogoSrc from "../../../assets/img/q-share-icon.webp";
import { usePhoneLayout } from "../../../hooks/usePhoneLayout";
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
            sx={{ minHeight: 44 }}
          >
            <ListItemIcon sx={{ minWidth: 32, color: "primary.main" }}>{active ? <CheckIcon fontSize="small" /> : null}</ListItemIcon>
            <ListItemText primary={n.name} slotProps={{ primary: { noWrap: true } }} />
          </MenuItem>
        );
      })}
      <MenuItem
        onClick={() => {
          closeMenu();
          setIsOpenBlockedNamesModal(true);
        }}
        sx={{ minHeight: 44, borderTop: names.length ? 1 : 0, borderColor: "divider" }}
      >
        <ListItemIcon sx={{ minWidth: 32 }}>
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
        sx={{ minHeight: 44 }}
      >
        <ListItemIcon sx={{ minWidth: 32 }}>
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
              <Avatar src={userAvatar || avatarUrl(userName)} alt="" sx={{ width: 28, height: 28 }} />
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
