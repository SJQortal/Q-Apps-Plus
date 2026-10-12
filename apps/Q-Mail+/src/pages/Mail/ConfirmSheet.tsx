/**
 * A confirmation that is a bottom sheet on phones and a small dialog
 * elsewhere (docs/DESIGN.md → Mobile → Dialogs). `useConfirmSheet` mirrors
 * the old useConfirmationModal API: `confirm()` resolves true or false.
 */
import { useCallback, useRef, useState, type ReactNode } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";
import { useLayoutMode } from "../../layout/useLayoutMode";

export interface ConfirmSheetProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmSheet({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  const isPhone = useLayoutMode() === "phone";
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="confirm-sheet-title"
      aria-describedby="confirm-sheet-message"
      fullWidth
      maxWidth="xs"
      sx={
        isPhone
          ? {
              "& .MuiDialog-container": { alignItems: "flex-end" },
              "& .MuiDialog-paper": {
                m: 0,
                width: "100%",
                maxWidth: "100%",
                borderRadius: "16px 16px 0 0",
                pb: "env(safe-area-inset-bottom, 0px)",
              },
            }
          : undefined
      }
    >
      {isPhone && (
        <Box
          aria-hidden
          sx={theme => ({
            width: 36,
            height: 4,
            borderRadius: 2,
            mx: "auto",
            mt: 1.5,
            backgroundColor: theme.palette.divider,
          })}
        />
      )}
      <DialogTitle id="confirm-sheet-title" sx={{ fontSize: "1.125rem", fontWeight: 700 }}>
        {title}
      </DialogTitle>
      <DialogContent>
        {typeof message === "string" ? (
          <Typography id="confirm-sheet-message" sx={{ fontSize: "0.9375rem" }} color="text.secondary">
            {message}
          </Typography>
        ) : (
          <Box id="confirm-sheet-message">{message}</Box>
        )}
      </DialogContent>
      <DialogActions
        sx={{
          px: 3,
          pb: 2,
          gap: 1,
          flexDirection: isPhone ? "column-reverse" : "row",
          "& > :not(:first-of-type)": { ml: 0 },
        }}
      >
        <Button
          onClick={onCancel}
          variant="outlined"
          fullWidth={isPhone}
          sx={{ minHeight: 44, textTransform: "none" }}
        >
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color={destructive ? "error" : "primary"}
          fullWidth={isPhone}
          autoFocus
          sx={{ minHeight: 44, textTransform: "none" }}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface UseConfirmSheetOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

/** `confirm()` opens the sheet and resolves with the user's answer. */
export function useConfirmSheet(options: UseConfirmSheetOptions) {
  const [open, setOpen] = useState(false);
  const resolver = useRef<((value: boolean) => void) | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const answer = useCallback((value: boolean) => {
    setOpen(false);
    resolver.current?.(value);
    resolver.current = null;
  }, []);

  const confirm = useCallback(() => {
    setOpen(true);
    return new Promise<boolean>(resolve => {
      resolver.current = resolve;
    });
  }, []);

  const Sheet = useCallback(() => {
    const current = optionsRef.current;
    return (
      <ConfirmSheet
        open={open}
        title={current.title}
        message={current.message}
        confirmLabel={current.confirmLabel}
        cancelLabel={current.cancelLabel}
        destructive={current.destructive}
        onConfirm={() => answer(true)}
        onCancel={() => answer(false)}
      />
    );
  }, [answer, open]);

  return { Sheet, confirm };
}
