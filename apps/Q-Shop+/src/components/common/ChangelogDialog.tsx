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

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ChangelogDialog({ open, onClose }: Props) {
  const fullScreen = useMediaQuery("(max-width:600px)");
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      fullScreen={fullScreen}
      maxWidth="sm"
      aria-labelledby="qshop-changelog-title"
    >
      <DialogTitle
        id="qshop-changelog-title"
        sx={{ display: "flex", alignItems: "center", gap: 1, pr: 1 }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography component="span" sx={{ fontWeight: 700, fontSize: 18, display: "block" }}>
            What&apos;s new in Q-Shop+
          </Typography>
          <Typography variant="body2" color="text.secondary">
            You are on Q-Shop+ {APP_VERSION}
          </Typography>
        </Box>
        <IconButton aria-label="Close changelog" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {CHANGELOG.map((release, index) => (
          <Box key={release.version} sx={{ mb: index < CHANGELOG.length - 1 ? 3 : 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Chip
                size="small"
                color={index === 0 ? "primary" : "default"}
                label={index === 0 ? `Latest · ${release.version}` : release.version}
              />
              <Typography variant="body2" color="text.secondary">
                {release.date}
              </Typography>
            </Box>
            <Typography sx={{ fontWeight: 700, mt: 1 }}>{release.title}</Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0.5, mb: 0 }}>
              {release.notes.map((note) => (
                <Typography component="li" variant="body2" key={note} sx={{ mb: 0.5 }}>
                  {note}
                </Typography>
              ))}
            </Box>
          </Box>
        ))}
      </DialogContent>
    </Dialog>
  );
}
