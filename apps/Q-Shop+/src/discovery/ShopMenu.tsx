/**
 * The one menu behind every shop card's "More" button: Open shop, Copy
 * link (the original's right-click "Copy Link", which now copies a
 * `qortal://APP/Q-Shop+/…` link with the owner encoded; docs/apps/Q-Shop+.md
 * → Bugs 9), and for another name's shop Add to favourites (favorites/) and
 * Hide shop (discovery/hiddenShops.ts). A menu on desktop, a bottom sheet on
 * phones; one for the whole grid, mounted only while open.
 */
import { useState } from "react";
import { List, ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../state/store";
import { useFavorites } from "../favorites/useFavorites";
import { favoriteShop } from "../favorites/model";
import { hideShop } from "./hiddenShops";
import { BottomSheet } from "../components/common/mobile/BottomSheet";
import { usePhoneLayout } from "../hooks/usePhoneLayout";
import { storeLink } from "../qdn/links";
import { setNotification } from "../state/features/notificationsSlice";
import { copyText } from "../utils/clipboard";
import { ManualCopyDialog } from "./ManualCopyDialog";
import type { ShopEntry } from "./shopIndex";
import { dropdownPaperSx } from "../components/common/menuStyle";

export interface ShopMenuTarget {
  shop: ShopEntry;
  anchor: HTMLElement;
}

export function ShopMenu({
  target,
  onClose,
  onOpenShop,
}: {
  target: ShopMenuTarget | null;
  onClose: () => void;
  onOpenShop: (shop: ShopEntry) => void;
}) {
  const phone = usePhoneLayout();
  const dispatch = useDispatch();
  const [manualLink, setManualLink] = useState<string | null>(null);
  // The sheet slides closed after `target` is cleared: keep showing the shop it was for.
  const [shown, setShown] = useState<ShopMenuTarget | null>(target);
  if (target && target !== shown) setShown(target);
  const shop = (target ?? shown)?.shop ?? null;

  // copyText runs first thing in the click, so its execCommand fallback keeps the user gesture.
  const copy = async () => {
    if (!shop) return;
    const link = storeLink(shop.owner, shop.id);
    const copied = await copyText(link);
    onClose();
    if (copied) dispatch(setNotification({ msg: "Link copied", alertType: "success" }));
    else setManualLink(link);
  };

  const open = () => {
    if (!shop) return;
    onClose();
    onOpenShop(shop);
  };

  const dialog = <ManualCopyDialog open={manualLink !== null} onClose={() => setManualLink(null)} link={manualLink ?? ""} />;

  // Favourites and hiding are for other names' shops.
  const userName = useSelector((state: RootState) => state.auth.user?.name);
  const favorites = useFavorites(Boolean(target));
  const fav = shop && shop.owner !== userName ? favoriteShop(shop.owner, shop.id) : null;
  const favorite = !!fav && favorites.isFavorite(fav.identifier);
  const toggleFavorite = () => {
    onClose();
    if (fav) void favorites.toggle(fav);
  };
  const hide = () => {
    if (!shop) return;
    onClose();
    hideShop({ owner: shop.owner, shortStoreId: shop.shortStoreId, title: shop.title });
    dispatch(setNotification({ msg: `${shop.title || "The shop"} is hidden. Settings shows it again.`, alertType: "info" }));
  };
  const favoriteText = favorite ? "Remove from favourites" : "Add to favourites";

  if (phone) {
    return (
      <>
        <BottomSheet open={Boolean(target)} onClose={onClose} title={shop?.title ?? "Shop"}>
          {/* A div, not a ul: the rows are buttons, not list items. */}
          <List disablePadding component="div">
            <ListItemButton onClick={open} sx={{ minHeight: 48, borderRadius: 1 }}>
              <ListItemIcon>
                <StorefrontOutlinedIcon />
              </ListItemIcon>
              <ListItemText primary="Open shop" />
            </ListItemButton>
            <ListItemButton onClick={copy} sx={{ minHeight: 48, borderRadius: 1 }}>
              <ListItemIcon>
                <LinkOutlinedIcon />
              </ListItemIcon>
              <ListItemText primary="Copy link" />
            </ListItemButton>
            {fav && (
              <>
                <ListItemButton onClick={toggleFavorite} sx={{ minHeight: 48, borderRadius: 1 }}>
                  <ListItemIcon>{favorite ? <FavoriteIcon sx={{ color: "error.main" }} /> : <FavoriteBorderIcon />}</ListItemIcon>
                  <ListItemText primary={favoriteText} />
                </ListItemButton>
                <ListItemButton onClick={hide} sx={{ minHeight: 48, borderRadius: 1 }}>
                  <ListItemIcon>
                    <VisibilityOffOutlinedIcon />
                  </ListItemIcon>
                  <ListItemText primary="Hide shop" secondary="On this device; Settings shows it again" />
                </ListItemButton>
              </>
            )}
          </List>
        </BottomSheet>
        {dialog}
      </>
    );
  }

  // Closed menus render nothing (no keepMounted); `shown` keeps it anchored while it fades out.
  const anchor = (target ?? shown)?.anchor ?? null;
  return (
    <>
      {anchor && (
        <Menu
          open={Boolean(target)}
          anchorEl={anchor}
          onClose={onClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          // The panel is a labelled dialog, as the account menu's: a landmark for its items (axe "region").
          slotProps={{ list: { "aria-label": `${shop?.title ?? "Shop"}: more` }, paper: { sx: dropdownPaperSx, role: "dialog", "aria-label": `${shop?.title ?? "Shop"}: more` } as never }}
        >
          <MenuItem onClick={open}>
            <ListItemIcon>
              <StorefrontOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Open shop" />
          </MenuItem>
          <MenuItem onClick={copy}>
            <ListItemIcon>
              <LinkOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Copy link" />
          </MenuItem>
          {fav && (
            <MenuItem onClick={toggleFavorite}>
              <ListItemIcon>{favorite ? <FavoriteIcon fontSize="small" sx={{ color: "error.main" }} /> : <FavoriteBorderIcon fontSize="small" />}</ListItemIcon>
              <ListItemText primary={favoriteText} />
            </MenuItem>
          )}
          {fav && (
            <MenuItem onClick={hide}>
              <ListItemIcon>
                <VisibilityOffOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Hide shop" />
            </MenuItem>
          )}
        </Menu>
      )}
      {dialog}
    </>
  );
}
