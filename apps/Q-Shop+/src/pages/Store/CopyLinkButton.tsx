/**
 * Copies a `qortal://APP/Q-Shop+/…` link and says so. Where the frame may not
 * copy (a node on the LAN serves the app over plain http, so neither the
 * clipboard API nor execCommand works), the link is shown to copy by hand.
 * After Q-Share+'s CopyLinkButton.
 */
import { useState } from "react";
import { Button, IconButton, TextField, Tooltip, Typography, type ButtonProps } from "@mui/material";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import { useDispatch } from "react-redux";
import { setNotification } from "../../state/features/notificationsSlice";
import { usePhoneLayout } from "../../hooks/usePhoneLayout";
import { copyText } from "../../utils/clipboard";
import { ResponsiveDialog } from "../../components/common/mobile";

export function ManualCopyDialog({ open, onClose, link }: { open: boolean; onClose: () => void; link: string }) {
  const phone = usePhoneLayout();
  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title="Copy link"
      maxWidth="xs"
      actions={
        <Button variant="contained" onClick={onClose}>
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

/** Copy `link` from a click handler; falls back to the manual dialog. */
export function useCopyLink() {
  const dispatch = useDispatch();
  const [manualLink, setManualLink] = useState<string | null>(null);
  // copyText runs first thing in the click, so its execCommand fallback keeps the user gesture.
  const copy = async (link: string) => {
    if (await copyText(link)) dispatch(setNotification({ msg: "Link copied", alertType: "success" }));
    else setManualLink(link);
  };
  const dialog = <ManualCopyDialog open={manualLink !== null} onClose={() => setManualLink(null)} link={manualLink ?? ""} />;
  return { copy, dialog };
}

export function CopyLinkButton({
  link,
  label,
  ariaLabel = "Copy link",
  variant = "outlined",
}: {
  link: string;
  /** A labelled button; without it, an icon button. */
  label?: string;
  ariaLabel?: string;
  variant?: ButtonProps["variant"];
}) {
  const { copy, dialog } = useCopyLink();
  if (label) {
    return (
      <>
        <Button variant={variant} color="inherit" startIcon={<LinkOutlinedIcon />} onClick={() => copy(link)} sx={{ minHeight: 44 }}>
          {label}
        </Button>
        {dialog}
      </>
    );
  }
  return (
    <>
      <Tooltip title={ariaLabel}>
        <IconButton aria-label={ariaLabel} onClick={() => copy(link)} sx={{ width: 44, height: 44 }}>
          <LinkOutlinedIcon />
        </IconButton>
      </Tooltip>
      {dialog}
    </>
  );
}
