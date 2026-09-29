import { useState } from "react";
import { Box, Chip, Dialog, IconButton, Typography, useMediaQuery } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import { QTRADE_PLUS_CHANGELOG, QTRADE_PLUS_VERSION, type Release } from "../../constants/changelog";

const Header = styled("div")(({ theme }) => ({
  alignItems: "center",
  backgroundColor: theme.palette.background.paper,
  borderBottom: `1px solid ${theme.palette.divider}`,
  display: "flex",
  flexShrink: 0,
  gap: theme.spacing(1.5),
  padding: theme.spacing(1.5, 1, 1.5, 2.5),
}));

const Feed = styled("div")(({ theme }) => ({
  display: "flex",
  flex: "1 1 auto",
  flexDirection: "column",
  gap: theme.spacing(2),
  minHeight: 0,
  overflowY: "auto",
  padding: theme.spacing(2),
}));

const ReleaseCard = styled("article", {
  shouldForwardProp: (prop) => prop !== "$latest",
})<{ $latest?: boolean }>(({ theme, $latest }) => ({
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${$latest ? alpha(theme.palette.primary.main, 0.45) : theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(2),
}));

const SectionHeading = styled("h4")(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.06em",
  margin: theme.spacing(2, 0, 0.75),
  textTransform: "uppercase",
}));

const Notes = styled("ul")(({ theme }) => ({
  margin: 0,
  paddingLeft: theme.spacing(2.5),
  "& li": { fontSize: 15, lineHeight: 1.5 },
  "& li + li": { marginTop: theme.spacing(0.75) },
}));

function ReleaseEntry({ release, latest }: { release: Release; latest: boolean }) {
  const [open, setOpen] = useState(latest);
  return (
    <ReleaseCard $latest={latest} aria-label={`Q-Trade+ ${release.version}`}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Typography component="h3" sx={{ fontSize: 17, fontWeight: 700, flex: 1 }}>
          {release.title}
        </Typography>
        <Chip
          size="small"
          color={latest ? "primary" : "default"}
          label={latest ? `Latest · ${release.version}` : release.version}
        />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {release.date}
      </Typography>
      <Typography sx={{ mt: 1 }}>{release.summary}</Typography>
      {open
        ? release.sections.map((section) => (
            <Box key={section.title}>
              <SectionHeading>{section.title}</SectionHeading>
              <Notes>
                {section.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </Notes>
            </Box>
          ))
        : null}
      {latest ? null : (
        <Typography
          component="button"
          type="button"
          onClick={() => setOpen((value) => !value)}
          sx={{
            background: "none",
            border: 0,
            color: "primary.main",
            cursor: "pointer",
            font: "inherit",
            fontWeight: 600,
            mt: 1,
            p: 0,
          }}
        >
          {open ? "Show less" : "Show all changes"}
        </Typography>
      )}
    </ReleaseCard>
  );
}

export function ChangelogDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const fullScreen = useMediaQuery("(max-width:600px)");
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      fullScreen={fullScreen}
      maxWidth="sm"
      aria-labelledby="qtrade-changelog-title"
      slotProps={{
        paper: {
          sx: {
            display: "flex",
            flexDirection: "column",
            maxHeight: fullScreen ? "100%" : "calc(100% - 32px)",
            overflow: "hidden",
          },
        },
      }}
    >
      <Header>
        <Box sx={{ flex: 1, minWidth: 0 }} id="qtrade-changelog-title">
          <Typography sx={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>
            What&apos;s new in Q-Trade+
          </Typography>
          <Typography variant="body2" color="text.secondary">
            You are on Q-Trade+ {QTRADE_PLUS_VERSION}
          </Typography>
        </Box>
        <IconButton aria-label="Close changelog" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Header>
      <Feed>
        {QTRADE_PLUS_CHANGELOG.map((release, index) => (
          <ReleaseEntry key={release.version} release={release} latest={index === 0} />
        ))}
      </Feed>
    </Dialog>
  );
}
