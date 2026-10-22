/**
 * Right-click (or long-press, where the browser sends `contextmenu`) on a
 * shop or product card: Copy link. A desktop extra; pages also have a
 * visible Share button, so nothing depends on it.
 */
import { useState, type MouseEvent, type ReactNode } from "react";
import { Menu, MenuItem } from "@mui/material";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import { useDispatch } from "react-redux";
import { setNotification } from "../../../state/features/notificationsSlice";
import { copyText } from "../../../utils/clipboard";

export default function ContextMenuResource({
  children,
  link,
}: {
  children: ReactNode;
  /** The `qortal://APP/…` link to copy. */
  link: string;
  /** Unused; kept so older callers still type-check. */
  name?: string;
  service?: string;
  identifier?: string;
}) {
  const dispatch = useDispatch();
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const open = (event: MouseEvent) => {
    event.preventDefault();
    // A second right-click while open closes it (as the native menu does).
    setPosition((current) => (current ? null : { top: event.clientY - 6, left: event.clientX + 2 }));
  };

  const copy = async () => {
    setPosition(null);
    const ok = await copyText(link);
    dispatch(
      setNotification(
        ok ? { msg: "Link copied", alertType: "success" } : { msg: "Copying isn't allowed here. Use the Share button instead.", alertType: "error" }
      )
    );
  };

  return (
    <div onContextMenu={open} style={{ width: "100%", height: "100%" }}>
      {children}
      {position && (
        <Menu open onClose={() => setPosition(null)} anchorReference="anchorPosition" anchorPosition={position}>
          <MenuItem onClick={copy} sx={{ gap: 1, minHeight: 44 }}>
            <LinkOutlinedIcon fontSize="small" />
            Copy link
          </MenuItem>
        </Menu>
      )}
    </div>
  );
}
