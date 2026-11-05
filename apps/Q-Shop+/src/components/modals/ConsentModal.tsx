import { useEffect, useState } from "react";
import { Button, Typography } from "@mui/material";
import localForage from "localforage";
import { ResponsiveDialog } from "../common/mobile/ResponsiveDialog";
import { APP_NAME } from "../../constants/plus";

/** The original's storage, so someone who accepted in Q-Shop (or Q-Blog) is not asked again. */
const generalLocal = localForage.createInstance({
  name: "q-blog-general",
});
export const CONSENT_KEY = "general-consent";

/**
 * The original's one-time welcome notice, full-screen on phones. It is
 * recorded as read only when its button is pressed (the original recorded it
 * as soon as it showed).
 */
export default function ConsentModal({ onSettled }: { /** The notice is out of the way (accepted now, or before): the walkthrough may open. */ onSettled?: () => void } = {}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    generalLocal
      .getItem(CONSENT_KEY)
      .then((hasConsented) => {
        if (cancelled) return;
        if (!hasConsented) setOpen(true);
        else onSettled?.();
      })
      .catch(() => {
        // Storage unavailable: skip the notice rather than block the app.
        if (!cancelled) onSettled?.();
      });
    return () => {
      cancelled = true;
    };
  }, [onSettled]);

  const accept = () => {
    setOpen(false);
    onSettled?.();
    generalLocal.setItem(CONSENT_KEY, true).catch(() => {
      // The choice still applies for this visit.
    });
  };

  return (
    <ResponsiveDialog
      open={open}
      onClose={accept}
      title={`Welcome to ${APP_NAME}`}
      maxWidth="sm"
      dismissible={false}
      actions={
        <Button variant="contained" onClick={accept} autoFocus sx={{ minHeight: 44 }}>
          I understand
        </Button>
      }
    >
      <Typography variant="body2" sx={{ fontSize: 15, lineHeight: 1.6 }}>
        The Qortal community, along with its development team and the creators of this application, cannot be held
        accountable for any content published or displayed. Furthermore, they bear no responsibility for any data loss
        that may occur as a result of using this application.
      </Typography>
    </ResponsiveDialog>
  );
}
