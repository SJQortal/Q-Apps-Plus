import { useId, type ReactNode } from "react";
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
}

/**
 * A sheet that slides up from the bottom and can be dragged down to close.
 * Use it on phones for filters, menus and pickers (DESIGN.md → Mobile).
 */
export function BottomSheet({ open, onClose, title, children, ariaLabel }: BottomSheetProps) {
  const titleId = useId();
  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      onOpen={() => {}}
      disableSwipeToOpen
      slotProps={{
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
      <Box sx={{ overflowY: "auto", overscrollBehavior: "contain", px: 2, pb: 2 }}>{children}</Box>
    </SwipeableDrawer>
  );
}
