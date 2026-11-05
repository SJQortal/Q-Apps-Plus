import { useId, useState, type ReactNode } from "react";
import { Box, SwipeableDrawer, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";

const Puller = styled("div")(({ theme }) => ({
  width: 36,
  height: 5,
  borderRadius: 3,
  backgroundColor: theme.palette.divider,
  margin: "8px auto 4px",
}));

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Accessible name when there is no visible title. */
  ariaLabel?: string;
  /**
   * Keep the sheet and its children mounted while closed, so state held inside
   * them survives (Home's filters: CategoryList keeps its own selection, which
   * later pages read through a ref). Only for one-per-page sheets.
   */
  keepMounted?: boolean;
  /**
   * Buttons that end the sheet (Done, Show 12 products): under the content,
   * outside its scroll, so a sheet taller than a small phone (360×740) keeps
   * them in view instead of below the content's end.
   */
  actions?: ReactNode;
}

/**
 * A sheet that slides up from the bottom and can be dragged down to close.
 * Use it on phones for filters, menus and pickers (DESIGN.md → Mobile).
 *
 * SwipeableDrawer always keeps its drawer mounted and listens for touches on
 * the whole document, so a closed sheet still costs DOM nodes and listeners.
 * With one per share row that added up (in Hub, 458 of 2,020 nodes on Home),
 * so the drawer is mounted only while the sheet is open or sliding closed,
 * unless `keepMounted` asks for the old behaviour.
 */
export function BottomSheet({ open, onClose, title, children, ariaLabel, keepMounted = false, actions }: BottomSheetProps) {
  const titleId = useId();
  // True from the start of the open slide until the close slide has finished.
  const [shown, setShown] = useState(false);
  if (!open && !shown && !keepMounted) return null;

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      onOpen={() => {}}
      disableSwipeToOpen
      ModalProps={{ onTransitionEnter: () => setShown(true), onTransitionExited: () => setShown(false) }}
      slotProps={{
        // Drawer skips the slide-in when it mounts already open; this one always mounts on open.
        transition: { appear: true },
        paper: {
          // The paper is the dialog: named here so axe and screen readers agree.
          role: "dialog",
          "aria-modal": true,
          "aria-labelledby": title ? titleId : undefined,
          "aria-label": title ? undefined : ariaLabel,
          sx: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: "85dvh",
            display: "flex",
            flexDirection: "column",
            backgroundImage: "none",
            bgcolor: "background.paper",
            pb: "env(safe-area-inset-bottom, 0px)",
          },
        },
      }}
    >
      <Puller aria-hidden />
      {title ? (
        <Typography id={titleId} component="h2" sx={{ px: 2, pt: 0.5, pb: 1, fontWeight: 700, fontSize: 17 }}>
          {title}
        </Typography>
      ) : null}
      {/* Positioned, so screen-reader text (position: absolute) scrolls with the content instead of stretching the sheet. */}
      <Box sx={{ position: "relative", overflowY: "auto", overscrollBehavior: "contain", px: 2, pb: 2 }}>{children}</Box>
      {actions ? (
        <Box sx={{ display: "flex", gap: 1, px: 2, pt: 1.5, pb: 2, borderTop: 1, borderColor: "divider", flexShrink: 0 }}>{actions}</Box>
      ) : null}
    </SwipeableDrawer>
  );
}
