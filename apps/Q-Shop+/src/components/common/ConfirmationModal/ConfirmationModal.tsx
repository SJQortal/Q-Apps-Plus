/**
 * Asks before something that can't be taken back (DESIGN.md → Dialogs): what
 * will happen, Cancel, and a button that says what it does. Full screen on
 * phones, like every dialog.
 */
import { Button, Typography } from "@mui/material";
import { ResponsiveDialog } from "../mobile";

export interface ModalProps {
  open: boolean;
  title: string;
  message: string;
  handleConfirm: () => void;
  handleCancel: () => void;
  /** The confirm button's text (default "Continue"). */
  confirmLabel?: string;
  /** Paint the confirm button as destructive. */
  destructive?: boolean;
}

const ConfirmationModal = ({ open, title, message, handleConfirm, handleCancel, confirmLabel, destructive }: ModalProps) => (
  <ResponsiveDialog
    open={open}
    onClose={handleCancel}
    title={title}
    maxWidth="xs"
    actions={
      <>
        <Button color="inherit" onClick={handleCancel}>
          Cancel
        </Button>
        <Button variant="contained" color={destructive ? "error" : "primary"} onClick={handleConfirm}>
          {confirmLabel ?? "Continue"}
        </Button>
      </>
    }
  >
    <Typography>{message}</Typography>
  </ResponsiveDialog>
);

export default ConfirmationModal;
