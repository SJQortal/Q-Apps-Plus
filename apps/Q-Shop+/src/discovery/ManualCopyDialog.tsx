import { Button, TextField, Typography } from "@mui/material";
import { ResponsiveDialog } from "../components/common/mobile/ResponsiveDialog";
import { usePhoneLayout } from "../hooks/usePhoneLayout";

/**
 * Shows a link to copy by hand, for when the app may not copy: the frame is
 * on the node's origin, and a node on the LAN is plain http, so neither the
 * clipboard API nor execCommand may work (utils/clipboard). The link is
 * selected on open. After Q-Share+'s CopyLinkButton.
 */
export function ManualCopyDialog({ open, onClose, link }: { open: boolean; onClose: () => void; link: string }) {
  const phone = usePhoneLayout();
  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title="Copy link"
      maxWidth="xs"
      actions={
        <Button variant="contained" onClick={onClose} sx={{ minHeight: 44 }}>
          Done
        </Button>
      }
    >
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {phone
          ? "Copying isn't allowed here. Press and hold the link, choose Select all, then Copy."
          : "Copying isn't allowed here. The link is selected: press Ctrl+C, or ⌘C on a Mac."}
      </Typography>
      <TextField
        value={link}
        label="Link"
        fullWidth
        multiline
        autoFocus
        onFocus={(event) => (event.target as HTMLTextAreaElement).select()}
        slotProps={{ htmlInput: { readOnly: true, spellCheck: false } }}
      />
    </ResponsiveDialog>
  );
}
