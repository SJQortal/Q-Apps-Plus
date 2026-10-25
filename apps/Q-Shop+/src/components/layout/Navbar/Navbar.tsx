/**
 * The sticky header (docs/DESIGN.md → Layout): the logo and the app's name
 * (home), Shops / Products / Orders / Manage Shop (Simon, 2026-10-22: was "Sell"; Create Shop until the account has one) and the cart on desktop, Settings,
 * and the account menu or Sign in; beside Manage Shop, a seller pricing in a currency gets their QORT rate. On phones it slides away when you scroll
 * down and comes back when you scroll up; the navigation lives in BottomNav
 * there, and Settings stays up here (the bar takes five items).
 */
import React, { lazy, Suspense, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, IconButton, Skeleton, Tooltip } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import AddBusinessOutlinedIcon from "@mui/icons-material/AddBusinessOutlined";
import LocalMallOutlinedIcon from "@mui/icons-material/LocalMallOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import { useShowNames } from "../../../utils/namesSetting";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import FavoriteIcon from "@mui/icons-material/Favorite";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import type { RootState } from "../../../state/store";
import { APP_NAME } from "../../../constants/plus";
import { usePhoneLayout } from "../../../hooks/usePhoneLayout";
import { NameAvatar } from "../../common/NameAvatar";
import PageLoader from "../../common/PageLoader";
import { CartBadgeIcon } from "../BottomNav/BottomNav";
import { cartLabel, navSection, useCartItemCount, usePendingOrderCount, useSell, useSellLabel, useShellActions } from "../shellState";
import {
  AppTitle,
  AvatarContainer,
  CustomAppBar,
  DesktopNav,
  HeaderActions,
  HeaderInner,
  LogoButton,
  NavLinkButton,
  NavbarName,
} from "./Navbar-styles";
import { LogoMark } from "./LogoMark";
import { QuickRateButton } from "./QuickRateButton";
import { useHideOnScroll, usePublishHeaderOffset } from "./useHideOnScroll";

// Both open now and then: loaded the first time they open, so the name
// switcher, the sheet and the block list stay out of the first download.
const AccountMenu = lazy(() => import("./AccountMenu"));
const BlockedNamesModal = lazy(() =>
  import("../../common/BlockedNamesModal/BlockedNamesModal").then((m) => ({ default: m.BlockedNamesModal }))
);

const ICON_BUTTON_SX = { minWidth: 44, minHeight: 44 } as const;

const NavBar: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const phone = usePhoneLayout();
  const { hidden, reveal } = useHideOnScroll(phone);
  // The pages' sticky sub-headers stack under the header using this (Navbar-styles stickyBelowHeader).
  const headerRef = useRef<HTMLElement>(null);
  usePublishHeaderOffset(headerRef, hidden);

  const { signIn, authenticating } = useShellActions();
  const user = useSelector((state: RootState) => state.auth.user);
  const loading = useSelector((state: RootState) => state.global.isLoadingGlobal);
  const items = useCartItemCount();
  const pending = usePendingOrderCount();
  const sell = useSell();
  const sellLabel = useSellLabel();
  const section = navSection(pathname);
  // Names for sale (names/NamesPage.tsx), unless Settings hides them.
  const showNames = useShowNames();

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Mounted from the first open on, so the menu's closing slide can play.
  const [menuLoaded, setMenuLoaded] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);

  const userName = user?.name || "";
  const menuOpen = phone ? sheetOpen : Boolean(anchorEl);
  const closeMenu = () => {
    setAnchorEl(null);
    setSheetOpen(false);
  };
  const openMenu = (e: React.MouseEvent<HTMLElement>) => {
    setMenuLoaded(true);
    if (phone) setSheetOpen(true);
    else setAnchorEl(e.currentTarget);
  };

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
              active={section === "products"}
              aria-current={section === "products" ? "page" : undefined}
              onClick={() => navigate("/products")}
            >
              <LocalMallOutlinedIcon aria-hidden />
              Products
            </NavLinkButton>
            {showNames && (
              <NavLinkButton
                type="button"
                active={section === "names"}
                aria-current={section === "names" ? "page" : undefined}
                onClick={() => navigate("/names")}
              >
                <BadgeOutlinedIcon aria-hidden />
                Names
              </NavLinkButton>
            )}
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
              {sellLabel === "Create Shop" ? <AddBusinessOutlinedIcon aria-hidden /> : <SellOutlinedIcon aria-hidden />}
              {sellLabel}
            </NavLinkButton>
          </DesktopNav>
        )}
        {!phone && <QuickRateButton phone={false} />}

        <HeaderActions>
          {phone && <QuickRateButton phone />}
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
          {signedIn && (
            // The name's favourite shops and products (pages/Favorites), right of the name (Simon, 2026-10-23).
            <Tooltip title="Favourites">
              <IconButton
                aria-label="Favourites"
                aria-current={section === "favorites" ? "page" : undefined}
                onClick={() => navigate("/favorites")}
                sx={{ ...ICON_BUTTON_SX, color: section === "favorites" ? "error.main" : "text.primary" }}
              >
                {section === "favorites" ? <FavoriteIcon /> : <FavoriteBorderIcon />}
              </IconButton>
            </Tooltip>
          )}

          {menuLoaded && signedIn && (
            <Suspense fallback={null}>
              <AccountMenu
                phone={phone}
                open={menuOpen}
                anchorEl={anchorEl}
                onClose={closeMenu}
                onOpenBlockedNames={() => setBlockedOpen(true)}
              />
            </Suspense>
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
