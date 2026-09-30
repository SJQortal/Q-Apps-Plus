import { Dialog, DialogContent, DialogTitle, IconButton, useMediaQuery, useTheme } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { ChangelogPage } from '../Mail/ChangelogPage';

interface ChangelogDialogProps {
  open: boolean;
  onClose: () => void;
}

/** The changelog as a dialog (full-screen on phones), reached from Settings → About. */
export function ChangelogDialog({ open, onClose }: ChangelogDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="md"
      aria-labelledby="qmail-changelog-title"
    >
      <DialogTitle
        id="qmail-changelog-title"
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}
      >
        What's new
        <IconButton onClick={onClose} aria-label="Close changelog" edge="end">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: { xs: 1, sm: 2 } }}>
        <ChangelogPage />
      </DialogContent>
    </Dialog>
  );
}
