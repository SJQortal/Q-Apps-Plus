import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { CHANGELOG } from "../../constants/changelog";

interface Props {
  open: boolean;
  onClose: () => void;
}

export const ChangelogDialog = ({ open, onClose }: Props) => (
  <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="changelog-title">
    <DialogTitle
      id="changelog-title"
      sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 1 }}
    >
      What's new
      <IconButton aria-label="Close" onClick={onClose} size="small">
        <CloseIcon fontSize="small" />
      </IconButton>
    </DialogTitle>
    <DialogContent dividers>
      {CHANGELOG.map(entry => (
        <div key={entry.version}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {entry.version}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {entry.date}
          </Typography>
          <List dense disablePadding sx={{ mb: 2, listStyle: "disc", pl: 2.5 }}>
            {entry.notes.map(note => (
              <ListItem key={note} disableGutters sx={{ display: "list-item", py: 0.25 }}>
                <ListItemText primary={note} slotProps={{ primary: { variant: "body2" } }} />
              </ListItem>
            ))}
          </List>
        </div>
      ))}
    </DialogContent>
  </Dialog>
);
