import * as React from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import localForage from "localforage";
import { useTheme } from "@mui/material";
const generalLocal = localForage.createInstance({
  name: "q-blog-general"
});

export default function ConsentModal() {
  const theme = useTheme();

  const [open, setOpen] = React.useState(false);

  const handleClose = () => {
    setOpen(false);
  };

  const getIsConsented = React.useCallback(async () => {
    try {
      const hasConsented = await generalLocal.getItem("general-consent");
      if (hasConsented) return;

      setOpen(true);
      generalLocal.setItem("general-consent", true);
    } catch (error) {}
  }, []);

  React.useEffect(() => {
    getIsConsented();
  }, []);
  return (
    <div>
      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">Welcome</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            The Qortal community, along with its development team and the
            creators of this application, cannot be held accountable for any
            content published or displayed. Furthermore, they bear no
            responsibility for any data loss that may occur as a result of using
            this application.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            sx={{
              backgroundColor: theme.palette.primary.light,
              color: theme.palette.text.primary,
              fontFamily: "Raleway"
            }}
            onClick={handleClose}
            autoFocus
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
