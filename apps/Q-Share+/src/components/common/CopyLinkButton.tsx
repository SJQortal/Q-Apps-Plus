import { useState } from "react";
import { Button, IconButton, TextField, Tooltip, Typography, type SxProps, type Theme } from "@mui/material";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import { useDispatch } from "react-redux";
import { setNotification } from "../../state/features/notificationsSlice.ts";
import { usePhoneLayout } from "../../hooks/usePhoneLayout";
import { copyText } from "../../utils/clipboard";
import { ResponsiveDialog } from "./mobile/ResponsiveDialog";

export interface CopyLinkButtonProps {
  link: string;
  /** Tooltip and accessible name of the icon button. */
  tooltipTitle: string;
  /** When set, renders a labelled button instead of an icon button. */
  label?: string;
  sx?: SxProps<Theme>;
}

export interface ManualCopyDialogProps {
  open: boolean;
  onClose: () => void;
  link: string;
}

/**
 * Shows a link to copy by hand, for when the app may not copy: the frame is
 * on the node's origin, and a node on the LAN is plain http, so neither the
 * clipboard API nor execCommand may work. The link is selected on open.
 */
export function ManualCopyDialog({ open, onClose, link }: ManualCopyDialogProps) {
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

/** Copies a qortal:// link and says so; where copying is blocked, shows the link to copy by hand. */
export const CopyLinkButton = ({ link, tooltipTitle, label, sx }: CopyLinkButtonProps) => {
  const dispatch = useDispatch();
  const phone = usePhoneLayout();
  const [manual, setManual] = useState(false);

  // copyText runs first thing in the click, so its execCommand fallback keeps the user gesture.
  const copy = async () => {
    if (await copyText(link)) dispatch(setNotification({ msg: "Link copied", alertType: "success" }));
    else setManual(true);
  };

  const dialog = <ManualCopyDialog open={manual} onClose={() => setManual(false)} link={link} />;

  if (label) {
    return (
      <>
        <Button
          variant="outlined"
          startIcon={<LinkOutlinedIcon />}
          onClick={copy}
          sx={[{ minHeight: phone ? 48 : 40 }, ...(Array.isArray(sx) ? sx : [sx])]}
        >
          {label}
        </Button>
        {dialog}
      </>
    );
  }

  return (
    <>
      <Tooltip title={tooltipTitle}>
        <IconButton
          aria-label={tooltipTitle}
          onClick={copy}
          sx={[{ color: "text.primary", minWidth: phone ? 44 : undefined, minHeight: phone ? 44 : undefined }, ...(Array.isArray(sx) ? sx : [sx])]}
        >
          <LinkOutlinedIcon />
        </IconButton>
      </Tooltip>
      {dialog}
    </>
  );
};
