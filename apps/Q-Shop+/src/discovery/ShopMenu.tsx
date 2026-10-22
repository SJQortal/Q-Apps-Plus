/**
 * The one menu behind every shop card's "More" button: Open shop and Copy
 * link (the original's right-click "Copy Link", which now copies a
 * `qortal://APP/Q-Shop+/…` link with the owner encoded; docs/apps/Q-Shop+.md
 * → Bugs 9). A menu on desktop, a bottom sheet on phones; one for the whole
 * grid, mounted only while open.
 */
import { useState } from "react";
import { List, ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import { useDispatch } from "react-redux";
import { BottomSheet } from "../components/common/mobile/BottomSheet";
import { usePhoneLayout } from "../hooks/usePhoneLayout";
import { storeLink } from "../qdn/links";
import { setNotification } from "../state/features/notificationsSlice";
import { copyText } from "../utils/clipboard";
import { ManualCopyDialog } from "./ManualCopyDialog";
import type { ShopEntry } from "./shopIndex";

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
          slotProps={{ list: { "aria-label": `${shop?.title ?? "Shop"}: more` } }}
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
        </Menu>
      )}
      {dialog}
    </>
  );
}
