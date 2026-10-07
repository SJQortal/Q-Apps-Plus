import { useEffect, useState } from "react";
import { Box, Button, ButtonBase, CircularProgress, Typography } from "@mui/material";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import { useInView } from "react-intersection-observer";
import { NameAvatar } from "../NameAvatar";
import { PHONE_MEDIA } from "../../../hooks/usePhoneLayout";
import { fetchQdnText } from "../../../utils/qdnSearch";
import { fromNow } from "../../../utils/time";
import type { AppNotification } from "../../../utils/notifications/store";

const Strong = ({ children }: { children: string }) => (
  <Box component="span" sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>
    {children}
  </Box>
);

/** The sentence for a notification; the names and titles are its strong parts. */
export function NotificationText({ item }: { item: AppNotification }) {
  const shareTitle = item.share?.title;
  if (item.kind === "collection") {
    return (
      <>
        <Strong>{item.actor}</Strong> added {shareTitle ? <Strong>{shareTitle}</Strong> : "your share"} to{" "}
        {item.collection?.title ? <Strong>{item.collection.title}</Strong> : "a collection"}
      </>
    );
  }
  if (item.kind === "reply") {
    return (
      <>
        <Strong>{item.actor}</Strong> replied to your comment
        {shareTitle ? (
          <>
            {" "}
            on <Strong>{shareTitle}</Strong>
          </>
        ) : null}
      </>
    );
  }
  return (
    <>
      <Strong>{item.actor}</Strong> commented on {shareTitle ? <Strong>{shareTitle}</Strong> : "your share"}
    </>
  );
}

/** The opening words of the comment, read from the node once the row is on screen. */
function CommentSnippet({ name, identifier }: { name: string; identifier: string }) {
  const { ref, inView } = useInView({ triggerOnce: true });
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!inView) return;
    let active = true;
    fetchQdnText("BLOG_COMMENT", name, identifier)
      .then((body) => active && setText(body.trim()))
      .catch(() => active && setText(null));
    return () => {
      active = false;
    };
  }, [inView, name, identifier]);
  return (
    <Typography
      ref={ref}
      variant="body2"
      component="span"
      color="text.secondary"
      sx={{
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
        overflowWrap: "anywhere",
      }}
    >
      {text ? `“${text}”` : null}
    </Typography>
  );
}

interface NotificationListProps {
  items: AppNotification[];
  /** No check has finished yet. */
  checking: boolean;
  /** The last check failed (the node didn't answer). */
  failed: boolean;
  onRetry: () => void;
  /** Both kinds are switched off in Settings. */
  off: boolean;
  onOpen: (item: AppNotification) => void;
  onSettings: () => void;
}

/**
 * The notification list, shared by the header's popover and the phone sheet.
 * Unread items carry a dot and a tint until the list closes.
 */
export function NotificationList({ items, checking, failed, onRetry, off, onOpen, onSettings }: NotificationListProps) {
  const settingsLink = (
    <Button onClick={onSettings} sx={{ alignSelf: "center", minHeight: 44 }}>
      Notification settings
    </Button>
  );
  const failure =
    failed && !off ? (
      <Box
        role="status"
        sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, px: 2, py: 1 }}
      >
        <Typography variant="body2" color="text.secondary">
          Couldn't check for new ones: your node didn't answer.
        </Typography>
        <Button onClick={onRetry} sx={{ minHeight: 44, flexShrink: 0 }}>
          Try again
        </Button>
      </Box>
    ) : null;

  if (!items.length && failure) return failure;

  if (!items.length) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1,
          px: 3,
          py: 4,
          textAlign: "center",
        }}
      >
        {checking && !off ? (
          <>
            <CircularProgress size={24} aria-hidden />
            <Typography role="status" color="text.secondary">
              Checking for notifications…
            </Typography>
          </>
        ) : (
          <>
            <NotificationsNoneOutlinedIcon sx={{ fontSize: 40, color: "text.secondary" }} aria-hidden />
            <Typography sx={{ fontWeight: 700 }}>{off ? "Notifications are off" : "Nothing yet"}</Typography>
            <Typography variant="body2" color="text.secondary">
              {off
                ? "Turn them on in Settings to hear about comments on your shares and your shares in collections."
                : "Comments on your shares, replies to your comments and your shares added to collections show up here."}
            </Typography>
            {settingsLink}
          </>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      {failure}
      <Box component="ul" aria-label="Notifications" sx={{ listStyle: "none", m: 0, p: 0 }}>
        {items.map((item) => (
          <Box component="li" key={item.id} sx={{ borderBottom: 1, borderColor: "divider" }}>
            <ButtonBase
              onClick={() => onOpen(item)}
              sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 1.5,
                width: "100%",
                px: 2,
                py: 1.5,
                textAlign: "left",
                bgcolor: item.read ? "transparent" : "action.selected",
                "&:hover, &.Mui-focusVisible": { bgcolor: "action.hover" },
                [`@media ${PHONE_MEDIA}`]: { minHeight: 56 },
              }}
            >
              <NameAvatar name={item.actor} size={36} />
              {/* Spans only: the row is a button. */}
              <Box component="span" sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 0.25 }}>
                <Typography variant="body2" component="span" sx={{ display: "block", overflowWrap: "anywhere" }}>
                  <NotificationText item={item} />
                  {item.read ? null : (
                    <Box component="span" sx={visuallyHidden}>
                      , new
                    </Box>
                  )}
                </Typography>
                {item.kind !== "collection" && item.comment ? (
                  <CommentSnippet name={item.comment.name} identifier={item.comment.identifier} />
                ) : null}
                <Typography variant="caption" color="text.secondary">
                  {fromNow(item.time)}
                </Typography>
              </Box>
              {item.read ? null : (
                <Box
                  component="span"
                  aria-hidden
                  sx={{ width: 10, height: 10, mt: 0.75, borderRadius: "50%", bgcolor: "primary.main", flexShrink: 0 }}
                />
              )}
            </ButtonBase>
          </Box>
        ))}
      </Box>
      <Box sx={{ display: "flex", justifyContent: "center", py: 0.5 }}>{settingsLink}</Box>
    </Box>
  );
}

const visuallyHidden = {
  position: "absolute",
  width: "1px",
  height: "1px",
  p: 0,
  m: "-1px",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;
