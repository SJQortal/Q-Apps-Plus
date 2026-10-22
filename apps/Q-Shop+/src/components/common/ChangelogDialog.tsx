import { Box, Button, Chip, Typography } from "@mui/material";
import { ResponsiveDialog } from "./mobile/ResponsiveDialog";
import { APP_VERSION, CHANGELOG } from "../../constants/changelog";
import { APP_NAME } from "../../constants/plus";

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Settings → About → What's new: every release, newest first. Full-screen on phones. */
export function ChangelogDialog({ open, onClose }: Props) {
  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title={`What's new in ${APP_NAME}`}
      maxWidth="sm"
      actions={
        <Button variant="contained" onClick={onClose} sx={{ minHeight: 44 }}>
          Done
        </Button>
      }
    >
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        You are on {APP_NAME} {APP_VERSION}.
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {CHANGELOG.map((release, index) => (
          <Box
            key={release.version}
            component="article"
            aria-labelledby={`release-${release.version}`}
            sx={{
              border: 1,
              borderColor: index === 0 ? "primary.main" : "divider",
              borderRadius: 2,
              p: 2,
              bgcolor: "background.paper",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography id={`release-${release.version}`} component="h3" sx={{ fontWeight: 700, fontSize: 16, flex: 1 }}>
                {release.title}
              </Typography>
              <Chip
                size="small"
                color={index === 0 ? "primary" : "default"}
                label={index === 0 ? `Latest · ${release.version}` : release.version}
              />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {release.date}
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5, "& li + li": { mt: 0.75 } }}>
              {release.notes.map((note) => (
                <li key={note}>
                  <Typography variant="body2" sx={{ fontSize: 14, lineHeight: 1.5 }}>
                    {note}
                  </Typography>
                </li>
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </ResponsiveDialog>
  );
}
