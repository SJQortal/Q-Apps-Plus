/**
 * The sticky header (docs/DESIGN.md → Layout): the logo and the app's name
 * (home), Shops / Orders / Sell, the cart and Settings on desktop, and the
 * account menu or Sign in. On phones it slides away when you scroll down and
 * comes back when you scroll up; the navigation lives in BottomNav there.
 */
import React, { lazy, Suspense, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  IconButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  MenuList,
  Popover,
  Skeleton,
  Tooltip,
} from "@mui/material";
import AddBusinessOutlinedIcon from "@mui/icons-material/AddBusinessOutlined";
import CheckIcon from "@mui/icons-material/Check";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import PersonOffOutlinedIcon from "@mui/icons-material/PersonOffOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import type { RootState } from "../../../state/store";
import { resetProducts, toggleCreateStoreModal, updateRecentlyVisitedStoreId } from "../../../state/features/globalSlice";
import { resetOrders } from "../../../state/features/orderSlice";
import { APP_NAME, MAIL_APP_NAME } from "../../../constants/plus";
import { shortStoreIdOf } from "../../../qdn/identifiers";
import { PHONE_MEDIA, usePhoneLayout } from "../../../hooks/usePhoneLayout";
import { useSwitchActiveName } from "../../../hooks/useUserAccount";
import { BottomSheet } from "../../common/mobile/BottomSheet";
import { NameAvatar } from "../../common/NameAvatar";
import PageLoader from "../../common/PageLoader";
import { NameSwitcher } from "../NameSwitcher";
import { CartBadgeIcon } from "../BottomNav/BottomNav";
import {
  cartLabel,
  navSection,
  sellerPath,
  useCartItemCount,
  usePendingOrderCount,
  useSell,
  useShellActions,
} from "../shellState";
import {
  AppTitle,
  AvatarContainer,
  CustomAppBar,
  DesktopNav,
  HeaderActions,
  HeaderInner,
  LogoButton,
  MenuSectionTitle,
  NavLinkButton,
  NavbarName,
} from "./Navbar-styles";
import { LogoMark } from "./LogoMark";
import { useHideOnScroll, usePublishHeaderOffset } from "./useHideOnScroll";

// Opened from the account menu now and then: loaded when first opened.
const BlockedNamesModal = lazy(() =>
  import("../../common/BlockedNamesModal/BlockedNamesModal").then((m) => ({ default: m.BlockedNamesModal }))
);

/** The account menu's first column (MenuItem gives ListItemIcon 36 px). */
const MENU_LEAD_SX = { width: 36, mr: 1, justifyContent: "center" } as const;

/**
 * Account-menu rows are 44 px tap targets wherever the phone layout applies.
 * A plain `minHeight` loses to MenuItem's own `min-height: auto` from 600 px
 * up, a media rule emitted after it; this one is emitted later still.
 */
const MENU_ROW_SX = { [`@media ${PHONE_MEDIA}`]: { minHeight: 44 } } as const;

const ICON_BUTTON_SX = { minWidth: 44, minHeight: 44 } as const;

const NavBar: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { pathname } = useLocation();
  const phone = usePhoneLayout();
  const { hidden, reveal } = useHideOnScroll(phone);
  // The pages' sticky sub-headers stack under the header using this (Navbar-styles stickyBelowHeader).
  const headerRef = useRef<HTMLElement>(null);
  usePublishHeaderOffset(headerRef, hidden);

  const { signIn, authenticating } = useShellActions();
  const user = useSelector((state: RootState) => state.auth.user);
  const loading = useSelector((state: RootState) => state.global.isLoadingGlobal);
  const myStores = useSelector((state: RootState) => state.store.myStores);
  const hashMapStores = useSelector((state: RootState) => state.store.hashMapStores);
  const currentStoreId = useSelector((state: RootState) => state.global.currentStore?.id);
  const items = useCartItemCount();
  const pending = usePendingOrderCount();
  const sell = useSell();
  const switchName = useSwitchActiveName();
  const section = navSection(pathname);

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);

  const userName = user?.name || "";
  const names = (user?.names ?? []).filter((n) => n.name);
  const menuOpen = phone ? sheetOpen : Boolean(anchorEl);
  const closeMenu = () => {
    setAnchorEl(null);
    setSheetOpen(false);
  };
  const openMenu = (e: React.MouseEvent<HTMLElement>) => {
    if (phone) setSheetOpen(true);
    else setAnchorEl(e.currentTarget);
  };

  const openShop = (shopId: string) => {
    closeMenu();
    if (shopId !== currentStoreId) {
      // As the original's "My Stores" menu: the other shop's orders and drafts don't carry over.
      dispatch(resetOrders());
      dispatch(resetProducts());
      dispatch(updateRecentlyVisitedStoreId(shopId));
    }
    navigate(sellerPath(shopId));
  };

  const pickName = (name: string) => {
    closeMenu();
    switchName(name);
    // The seller pages belong to the previous name's shop.
    if (name !== userName && section === "sell") navigate("/");
  };

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
  // their content when closed); each name's avatar loads once its row scrolls
  // into view (NameAvatar). Many names get a search field (NameSwitcher).
  const menuItems = (
    <Box sx={{ minWidth: 260, maxWidth: phone ? undefined : 340, pb: 0.5 }} onKeyDownCapture={onMenuArrows}>
      {names.length > 1 && (
        <>
          <MenuSectionTitle>Your names</MenuSectionTitle>
          <NameSwitcher
            names={names.map((n) => n.name)}
            activeName={userName}
            onPick={pickName}
            autoFocusSearch={!phone}
            onEscape={closeMenu}
            // The search field stays put above a list that scrolls; the shops and rows below keep room.
            maxListHeight={
              phone
                ? "min(35dvh, 300px, max(88px, calc(85dvh - 320px)))"
                : "max(88px, min(300px, calc(var(--qshare-app-height, 100dvh) - 320px)))"
            }
          />
        </>
      )}
      {myStores.length > 0 && (
        <>
          <MenuSectionTitle>My shops</MenuSectionTitle>
          <MenuList aria-label="My shops" disablePadding sx={{ maxHeight: 240, overflowY: "auto" }}>
            {myStores.map((shop) => {
              const title = shop.title || hashMapStores[shop.id]?.title || shortStoreIdOf(shop.id);
              const current = shop.id === currentStoreId;
              return (
                <MenuItem key={shop.id} onClick={() => openShop(shop.id)} sx={MENU_ROW_SX}>
                  <ListItemIcon sx={MENU_LEAD_SX}>
                    <StorefrontOutlinedIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={title}
                    secondary={current ? "Selling now" : undefined}
                    slotProps={{ primary: { noWrap: true } }}
                  />
                  {current && <CheckIcon fontSize="small" sx={{ color: "primary.main", ml: 1, flexShrink: 0 }} />}
                </MenuItem>
              );
            })}
          </MenuList>
        </>
      )}
      <MenuList
        aria-label="Account"
        disablePadding
        sx={{ mt: 0.5, pt: 0.5, borderTop: names.length > 1 || myStores.length ? 1 : 0, borderColor: "divider" }}
      >
        <MenuItem
          onClick={() => {
            closeMenu();
            dispatch(toggleCreateStoreModal(true));
          }}
          sx={MENU_ROW_SX}
        >
          <ListItemIcon sx={MENU_LEAD_SX}>
            <AddBusinessOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Open a new shop" />
        </MenuItem>
        <MenuItem component="a" href={`qortal://APP/${MAIL_APP_NAME}`} onClick={closeMenu} sx={MENU_ROW_SX}>
          <ListItemIcon sx={MENU_LEAD_SX}>
            <EmailOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={`Messages in ${MAIL_APP_NAME}`} />
        </MenuItem>
        <MenuItem
          onClick={() => {
            closeMenu();
            setBlockedOpen(true);
          }}
          sx={MENU_ROW_SX}
        >
          <ListItemIcon sx={MENU_LEAD_SX}>
            <PersonOffOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Blocked names" />
        </MenuItem>
        <MenuItem
          selected={section === "settings"}
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

  const signedIn = Boolean(userName);
  const showSignIn = !user && !authenticating;

  return (
    <CustomAppBar ref={headerRef} position="sticky" elevation={0} collapsed={hidden} onFocus={reveal}>
      <HeaderInner>
        <LogoButton type="button" onClick={() => navigate("/")} aria-label={`${APP_NAME} home`}>
          <LogoMark size={phone ? 28 : 30} />
          <AppTitle>{APP_NAME}</AppTitle>
        </LogoButton>

        {!phone && (
          <DesktopNav aria-label="Main">
            <NavLinkButton
              type="button"
              active={section === "shops"}
              aria-current={section === "shops" ? "page" : undefined}
              onClick={() => navigate("/")}
            >
              <StorefrontOutlinedIcon aria-hidden />
              Shops
            </NavLinkButton>
            <NavLinkButton
              type="button"
              active={section === "orders"}
              aria-current={section === "orders" ? "page" : undefined}
              onClick={() => navigate("/my-orders")}
            >
              <ReceiptLongOutlinedIcon aria-hidden />
              Orders
            </NavLinkButton>
            <NavLinkButton
              type="button"
              active={section === "sell"}
              aria-current={section === "sell" ? "page" : undefined}
              onClick={sell}
            >
              <SellOutlinedIcon aria-hidden />
              Sell
            </NavLinkButton>
          </DesktopNav>
        )}

        <HeaderActions>
          {!phone && (
            <Tooltip title="Cart">
              <IconButton
                aria-label={cartLabel(items, pending)}
                aria-current={section === "cart" ? "page" : undefined}
                onClick={() => navigate("/cart")}
                sx={{ ...ICON_BUTTON_SX, color: section === "cart" ? "primary.main" : "text.primary" }}
              >
                <CartBadgeIcon items={items} pending={pending} />
              </IconButton>
            </Tooltip>
          )}
          {!phone && (
            <Tooltip title="Settings">
              <IconButton
                aria-label="Settings"
                aria-current={section === "settings" ? "page" : undefined}
                onClick={() => navigate("/settings")}
                sx={{ ...ICON_BUTTON_SX, color: section === "settings" ? "primary.main" : "text.primary" }}
              >
                <SettingsOutlinedIcon />
              </IconButton>
            </Tooltip>
          )}
          {authenticating && !user && (
            <Skeleton variant="circular" width={32} height={32} aria-hidden sx={{ mx: 0.75, flexShrink: 0 }} />
          )}
          {showSignIn && (
            <Button
              variant="contained"
              onClick={signIn}
              sx={{ minHeight: phone ? 44 : 40, flexShrink: 0, whiteSpace: "nowrap" }}
            >
              Sign in
            </Button>
          )}
          {signedIn && (
            <AvatarContainer
              type="button"
              aria-label={`Account menu for ${userName}`}
              aria-haspopup="true"
              aria-expanded={menuOpen}
              onClick={openMenu}
            >
              <NameAvatar name={userName} size={phone ? 32 : 28} eager />
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
              slotProps={{ paper: { role: "dialog", "aria-label": `Account menu for ${userName}` } }}
            >
              {menuItems}
            </Popover>
          )}
          {blockedOpen && (
            <Suspense fallback={null}>
              <BlockedNamesModal open={blockedOpen} onClose={() => setBlockedOpen(false)} />
            </Suspense>
          )}
        </HeaderActions>
      </HeaderInner>
      {loading && <PageLoader />}
    </CustomAppBar>
  );
};

export default NavBar;
