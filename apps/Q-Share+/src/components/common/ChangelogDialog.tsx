import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  useMediaQuery,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { APP_VERSION, CHANGELOG } from "../../constants/changelog";

interface ChangelogDialogProps {
  open: boolean;
  onClose: () => void;
}

export const ChangelogDialog = ({ open, onClose }: ChangelogDialogProps) => {
  const fullScreen = useMediaQuery("(max-width:600px)");
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      fullScreen={fullScreen}
      maxWidth="sm"
      aria-labelledby="qshare-changelog-title"
    >
      <DialogTitle
        id="qshare-changelog-title"
        sx={{ display: "flex", alignItems: "center", gap: 1, pr: 1 }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="span" sx={{ fontWeight: 700, fontSize: 18, display: "block" }}>
            What's new in Q-Share+
          </Typography>
          <Typography variant="body2" color="text.secondary">
            You are on {APP_VERSION}
          </Typography>
        </Box>
        <IconButton aria-label="Close changelog" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {CHANGELOG.map((release, index) => (
          <Box
            key={release.version}
            component="article"
            sx={{
              border: 1,
              borderColor: index === 0 ? "primary.main" : "divider",
              borderRadius: 2,
              p: 2,
              bgcolor: "background.paper",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography sx={{ fontWeight: 700 }}>{release.title}</Typography>
              <Box sx={{ flex: 1 }} />
              <Chip
                size="small"
                color={index === 0 ? "primary" : "default"}
                label={index === 0 ? `Latest · ${release.version}` : release.version}
              />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {release.date}
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5, "& li + li": { mt: 0.5 } }}>
              {release.notes.map((note) => (
                <li key={note}>
                  <Typography variant="body2">{note}</Typography>
                </li>
              ))}
            </Box>
          </Box>
        ))}
      </DialogContent>
    </Dialog>
  );
};
