/**
 * The header's account menu: a popover on desktop, a bottom sheet on phones.
 * The name switcher (several names), My shops (the shops of every name the
 * account holds: the active name's first; one of another name's switches to
 * that name and opens its seller page), Open a new shop, Messages in Q-Mail (the
 * original's Q-Mail link), Blocked names and Settings.
 *
 * Loaded the first time the menu opens (Navbar), so the name switcher's
 * search field and the sheet stay out of the first download.
 */
import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { Box, ListItemIcon, ListItemText, MenuItem, MenuList, Popover } from "@mui/material";
import AddBusinessOutlinedIcon from "@mui/icons-material/AddBusinessOutlined";
import CheckIcon from "@mui/icons-material/Check";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import PersonOffOutlinedIcon from "@mui/icons-material/PersonOffOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import type { RootState } from "../../../state/store";
import { resetProducts, toggleCreateStoreModal, updateRecentlyVisitedStoreId } from "../../../state/features/globalSlice";
import { resetOrders } from "../../../state/features/orderSlice";
import { MAIL_APP_NAME } from "../../../constants/plus";
import { shortStoreIdOf } from "../../../qdn/identifiers";
import { PHONE_MEDIA } from "../../../hooks/usePhoneLayout";
import { useSwitchActiveName } from "../../../hooks/useUserAccount";
import { useShopsOfNames } from "../../../hooks/useShopsOfNames";
import type { Store } from "../../../state/features/storeSlice";
import { BottomSheet } from "../../common/mobile/BottomSheet";
import { NameSwitcher } from "../NameSwitcher";
import { navSection, sellerPath } from "../shellState";
import { MenuSectionTitle } from "./Navbar-styles";

/** The menu's first column (MenuItem gives ListItemIcon 36 px). */
const MENU_LEAD_SX = { width: 36, mr: 1, justifyContent: "center" } as const;

/**
 * Rows are 44 px tap targets wherever the phone layout applies. A plain
 * `minHeight` loses to MenuItem's own `min-height: auto` from 600 px up, a
 * media rule emitted after it; this one is emitted later still.
 */
const MENU_ROW_SX = { [`@media ${PHONE_MEDIA}`]: { minHeight: 44 } } as const;

export interface AccountMenuProps {
  /** Open as a bottom sheet (phones) or as a popover under `anchorEl`. */
  phone: boolean;
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onOpenBlockedNames: () => void;
}

export function AccountMenu({ phone, open, anchorEl, onClose, onOpenBlockedNames }: AccountMenuProps) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { pathname } = useLocation();
  const user = useSelector((state: RootState) => state.auth.user);
  const myStores = useSelector((state: RootState) => state.store.myStores);
  const hashMapStores = useSelector((state: RootState) => state.store.hashMapStores);
  const currentStoreId = useSelector((state: RootState) => state.global.currentStore?.id);
  const switchName = useSwitchActiveName();
  const section = navSection(pathname);

  const userName = user?.name || "";
  const names = (user?.names ?? []).filter((n) => n.name);
  // Every name's shops (one search when the menu opens): the active name's come from useOwnShops.
  const allShops = useShopsOfNames(names.map((n) => n.name));
  const otherShops: Store[] = (allShops ?? []).filter((shop) => shop.owner !== userName);
  const shops: Store[] = [...myStores, ...otherShops];

  const openShop = (shopId: string, owner?: string) => {
    onClose();
    // Another name's shop: that name becomes the active one, then its shop the current one.
    if (owner && owner !== userName) {
      switchName(owner);
      dispatch(updateRecentlyVisitedStoreId(shopId));
      navigate(sellerPath(shopId));
      return;
    }
    if (shopId !== currentStoreId) {
      // As the original's "My Stores" menu: the other shop's orders and drafts don't carry over.
      dispatch(resetOrders());
      dispatch(resetProducts());
      dispatch(updateRecentlyVisitedStoreId(shopId));
    }
    navigate(sellerPath(shopId));
  };

  const pickName = (name: string) => {
    onClose();
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

  // Popover and BottomSheet both unmount their content when closed; each
  // name's avatar loads once its row scrolls into view (NameAvatar).
  const items = (
    <Box sx={{ minWidth: 260, maxWidth: phone ? undefined : 340, pb: 0.5 }} onKeyDownCapture={onMenuArrows}>
      {names.length > 1 && (
        <>
          <MenuSectionTitle>Your names</MenuSectionTitle>
          <NameSwitcher
            names={names.map((n) => n.name)}
            activeName={userName}
            onPick={pickName}
            autoFocusSearch={!phone}
            onEscape={onClose}
            // The search field stays put above a list that scrolls; the shops and rows below keep room.
            maxListHeight={
              phone
                ? "min(35dvh, 300px, max(88px, calc(85dvh - 320px)))"
                : "max(88px, min(300px, calc(var(--qshare-app-height, 100dvh) - 320px)))"
            }
          />
        </>
      )}
      {shops.length > 0 && (
        <>
          <MenuSectionTitle>My shops</MenuSectionTitle>
          <MenuList aria-label="My shops" disablePadding sx={{ maxHeight: 240, overflowY: "auto" }}>
            {shops.map((shop) => {
              const title = shop.title || hashMapStores[shop.id]?.title || shortStoreIdOf(shop.id);
              const current = shop.id === currentStoreId && shop.owner === userName;
              const otherName = shop.owner !== userName ? shop.owner : null;
              return (
                <MenuItem key={`${shop.owner}\n${shop.id}`} onClick={() => openShop(shop.id, shop.owner)} sx={MENU_ROW_SX}>
                  <ListItemIcon sx={MENU_LEAD_SX}>
                    <StorefrontOutlinedIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={title}
                    secondary={current ? "Selling now" : otherName ? `As ${otherName}` : undefined}
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
            onClose();
            dispatch(toggleCreateStoreModal(true));
          }}
          sx={MENU_ROW_SX}
        >
          <ListItemIcon sx={MENU_LEAD_SX}>
            <AddBusinessOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Open a new shop" />
        </MenuItem>
        <MenuItem component="a" href={`qortal://APP/${MAIL_APP_NAME}`} onClick={onClose} sx={MENU_ROW_SX}>
          <ListItemIcon sx={MENU_LEAD_SX}>
            <EmailOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={`Messages in ${MAIL_APP_NAME}`} />
        </MenuItem>
        <MenuItem
          onClick={() => {
            onClose();
            onOpenBlockedNames();
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
            onClose();
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

  if (phone) {
    return (
      <BottomSheet open={open} onClose={onClose} title={userName || "Account"}>
        {items}
      </BottomSheet>
    );
  }
  return (
    <Popover
      id="user-popover"
      open={open && Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      slotProps={{ paper: { role: "dialog", "aria-label": `Account menu for ${userName}` } }}
    >
      {items}
    </Popover>
  );
}

export default AccountMenu;
