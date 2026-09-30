import { useId, type ReactNode } from "react";
import { Box, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
import { usePhoneLayout } from "../../../hooks/usePhoneLayout";
import { useVisualViewport } from "../../../hooks/useVisualViewport";

export interface ResponsiveDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Buttons for the bottom bar; on phones it stays above the keyboard. */
  actions?: ReactNode;
  maxWidth?: "xs" | "sm" | "md" | "lg";
  /** Keep the dialog's children mounted while closed (e.g. to keep form state). */
  keepMounted?: boolean;
  /** Let clicks outside / Escape close it (default true). */
  dismissible?: boolean;
}

/**
 * A dialog that is full-screen on phones and narrow Hub panes, with a back
 * button, scrolling content and an action bar sized to the visual viewport
 * so it never hides behind the on-screen keyboard. On wider screens it is a
 * normal centred MUI Dialog (DESIGN.md → Mobile → Dialogs).
 */
export function ResponsiveDialog({
  open,
  onClose,
  title,
  children,
  actions,
  maxWidth = "sm",
  keepMounted,
  dismissible = true,
}: ResponsiveDialogProps) {
  const phone = usePhoneLayout();
  // Listeners only while a phone dialog is open: closed dialogs cost nothing.
  const viewport = useVisualViewport(open && phone);
  const titleId = useId();
  const handleClose = dismissible ? onClose : undefined;

  if (phone) {
    return (
      <Dialog
        open={open}
        onClose={handleClose}
        fullScreen
        keepMounted={keepMounted}
        aria-labelledby={titleId}
        slotProps={{
          container: { sx: { alignItems: "flex-start" } },
          paper: {
            sx: {
              position: "fixed",
              top: viewport.offsetTop,
              left: 0,
              right: 0,
              height: viewport.height ? `${viewport.height}px` : "100%",
              maxHeight: "none",
              margin: 0,
              borderRadius: 0,
              display: "flex",
              flexDirection: "column",
              backgroundImage: "none",
            },
          },
        }}
      >
        <Box
          component="header"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            flexShrink: 0,
            px: 0.5,
            pt: "calc(4px + env(safe-area-inset-top, 0px))",
            pb: 0.5,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <IconButton aria-label="Back" onClick={onClose} sx={{ minWidth: 44, minHeight: 44 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography id={titleId} component="h2" noWrap sx={{ flex: 1, fontSize: 18, fontWeight: 700 }}>
            {title}
          </Typography>
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", p: 2 }}>{children}</Box>
        {actions ? (
          <Box
            sx={{
              flexShrink: 0,
              display: "flex",
              gap: 1,
              justifyContent: "flex-end",
              alignItems: "center",
              p: 1.5,
              pb: "calc(12px + env(safe-area-inset-bottom, 0px))",
              borderTop: 1,
              borderColor: "divider",
              bgcolor: "background.paper",
              "& .MuiButton-root": { minHeight: 44 },
            }}
          >
            {actions}
          </Box>
        ) : null}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth={maxWidth} keepMounted={keepMounted} aria-labelledby={titleId}>
      <DialogTitle id={titleId} sx={{ display: "flex", alignItems: "center", gap: 1, pr: 1 }}>
        <Box component="span" sx={{ flex: 1, minWidth: 0, fontWeight: 700 }}>
          {title}
        </Box>
        <IconButton aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>{children}</DialogContent>
      {actions ? <DialogActions sx={{ p: 2 }}>{actions}</DialogActions> : null}
    </Dialog>
  );
}
