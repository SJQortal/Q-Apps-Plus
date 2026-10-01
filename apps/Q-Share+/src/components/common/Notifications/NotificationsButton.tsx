import { useState, type MouseEvent } from "react";
import { Badge, IconButton, Popover, Tooltip, Typography, type SxProps, type Theme } from "@mui/material";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import { useNavigate } from "react-router-dom";
import { BottomSheet } from "../mobile/BottomSheet";
import { usePhoneLayout } from "../../../hooks/usePhoneLayout";
import { requestNotificationCheck, useNotificationAccount } from "../../../hooks/useNotificationChecks";
import { useAppSettings } from "../../../utils/settings";
import { markAllRead, useNotificationState, type AppNotification } from "../../../utils/notifications/store";
import { NotificationList, notificationPath } from "./NotificationList";

/**
 * The header's bell: the unread count, and the list in a popover (desktop) or
 * a bottom sheet (phones). Opening it asks for a fresh check; closing it marks
 * everything read, since it has just been seen. Signed-in accounts only.
 */
export function NotificationsButton({ sx }: { sx?: SxProps<Theme> }) {
  const phone = usePhoneLayout();
  const navigate = useNavigate();
  const account = useNotificationAccount();
  const settings = useAppSettings();
  const state = useNotificationState(account?.address);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  if (!account) return null;

  const unread = state.items.filter((item) => !item.read).length;
  const off = !settings.notifyComments && !settings.notifyCollections;
  const open = phone ? sheetOpen : Boolean(anchor);

  const close = () => {
    setAnchor(null);
    setSheetOpen(false);
    markAllRead(account.address);
  };
  const openList = (event: MouseEvent<HTMLElement>) => {
    requestNotificationCheck();
    if (phone) setSheetOpen(true);
    else setAnchor(event.currentTarget);
  };
  const go = (path: string) => {
    close();
    navigate(path);
  };

  const list = (
    <NotificationList
      items={state.items}
      checking={state.lastCheck === 0}
      off={off}
      onOpen={(item: AppNotification) => go(notificationPath(item))}
      onSettings={() => go("/settings#notifications")}
    />
  );

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          aria-label={unread ? `Notifications, ${unread} new` : "Notifications"}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={openList}
          sx={sx}
        >
          <Badge badgeContent={unread} max={9} color="error">
            <NotificationsNoneOutlinedIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      {phone ? (
        <BottomSheet open={sheetOpen} onClose={close} title="Notifications">
          {list}
        </BottomSheet>
      ) : (
        <Popover
          open={Boolean(anchor)}
          anchorEl={anchor}
          onClose={close}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          slotProps={{
            paper: {
              role: "dialog",
              "aria-labelledby": "notifications-title",
              sx: {
                width: 380,
                maxWidth: "calc(100vw - 32px)",
                maxHeight: "min(560px, calc(var(--qshare-app-height, 100dvh) - 96px))",
              },
            },
          }}
        >
          <Typography id="notifications-title" component="h2" sx={{ px: 2, pt: 1.5, pb: 1, fontWeight: 700 }}>
            Notifications
          </Typography>
          {list}
        </Popover>
      )}
    </>
  );
}
