import { Button, IconButton, Tooltip, type SxProps, type Theme } from "@mui/material";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import { useDispatch } from "react-redux";
import { setNotification } from "../../state/features/notificationsSlice.ts";
import { usePhoneLayout } from "../../hooks/usePhoneLayout";

export interface CopyLinkButtonProps {
  link: string;
  /** Tooltip and accessible name of the icon button. */
  tooltipTitle: string;
  /** When set, renders a labelled button instead of an icon button. */
  label?: string;
  sx?: SxProps<Theme>;
}

/** Copies a qortal:// link to the clipboard and says whether it worked. */
export const CopyLinkButton = ({ link, tooltipTitle, label, sx }: CopyLinkButtonProps) => {
  const dispatch = useDispatch();
  const phone = usePhoneLayout();

  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(link);
      dispatch(setNotification({ msg: "Link copied", alertType: "success" }));
    } catch {
      dispatch(setNotification({ msg: "Could not copy the link", alertType: "error" }));
    }
  };

  if (label) {
    return (
      <Button
        variant="outlined"
        startIcon={<LinkOutlinedIcon />}
        onClick={copy}
        sx={[{ minHeight: phone ? 48 : 40 }, ...(Array.isArray(sx) ? sx : [sx])]}
      >
        {label}
      </Button>
    );
  }

  return (
    <Tooltip title={tooltipTitle}>
      <IconButton
        aria-label={tooltipTitle}
        onClick={copy}
        sx={[{ color: "text.primary", minWidth: phone ? 44 : undefined, minHeight: phone ? 44 : undefined }, ...(Array.isArray(sx) ? sx : [sx])]}
      >
        <LinkOutlinedIcon />
      </IconButton>
    </Tooltip>
  );
};
