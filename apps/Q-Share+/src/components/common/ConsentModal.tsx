import { useEffect, useState } from "react";
import { Button, Typography } from "@mui/material";
import localForage from "localforage";
import { ResponsiveDialog } from "./mobile/ResponsiveDialog";

const generalLocal = localForage.createInstance({
  name: "q-share-general",
});

/** Same key as the original app, so a user who accepted there is not asked again. */
const CONSENT_KEY = "general-consent";

/**
 * A one-time disclaimer. It is only recorded as accepted when the button is
 * pressed; closing the dialog another way shows it again next time.
 */
export default function ConsentModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    generalLocal
      .getItem(CONSENT_KEY)
      .then((hasConsented) => {
        if (!cancelled && !hasConsented) setOpen(true);
      })
      .catch(() => {
        // Storage unavailable: skip the dialog rather than block the app.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const accept = () => {
    setOpen(false);
    generalLocal.setItem(CONSENT_KEY, true).catch(() => {
      // The choice still applies for this visit.
    });
  };

  return (
    <ResponsiveDialog
      open={open}
      onClose={() => setOpen(false)}
      title="Welcome to Q-Share+"
      maxWidth="sm"
      dismissible={false}
      actions={
        <Button variant="contained" onClick={accept} autoFocus sx={{ minHeight: 44 }}>
          I understand
        </Button>
      }
    >
      <Typography sx={{ fontSize: 15, lineHeight: 1.6 }}>
        Q-Share+ is an early version and may still have bugs. The Qortal community, its development team and
        the creators of this application cannot be held accountable for any content published or displayed, for
        any loss of coin caused by bad actors or bugs in the application, or for any data loss that may occur
        from using it. They bear no responsibility for content uploaded by users.
      </Typography>
    </ResponsiveDialog>
  );
}
