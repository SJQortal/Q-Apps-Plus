import { useState } from 'react';
import {
  Box,
  Dialog,
  IconButton,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, styled, type Theme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import torqMark from '../assets/images/torq-mark.png';
import {
  TORQ_CHANGELOG,
  TORQ_VERSION,
  releaseSections,
  type TorqRelease,
} from '../constants/changelog';

const AVATAR = 44;

/** Blue text that stays readable on a light background. */
function accentText(theme: Theme) {
  return theme.palette.mode === 'dark'
    ? theme.palette.primary.main
    : theme.palette.primary.dark;
}
const AVATAR_PHONE = 36;

const Header = styled('div')(({ theme }) => ({
  alignItems: 'center',
  backdropFilter: 'blur(12px)',
  backgroundColor: alpha(theme.palette.background.paper, 0.92),
  borderBottom: `1px solid ${theme.palette.divider}`,
  display: 'flex',
  flexShrink: 0,
  gap: theme.spacing(1.5),
  padding: theme.spacing(1.5, 1, 1.5, 2.5),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1.25, 0.5, 1.25, 1.5),
  },
}));

const Feed = styled('div')(({ theme }) => ({
  backgroundColor:
    theme.palette.mode === 'dark'
      ? alpha(theme.palette.common.white, 0.015)
      : alpha(theme.palette.common.black, 0.02),
  display: 'flex',
  flex: '1 1 auto',
  flexDirection: 'column',
  gap: theme.spacing(2),
  minHeight: 0,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  padding: theme.spacing(2, 2, 3),
  [theme.breakpoints.down('sm')]: {
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5, 1, 2.5),
  },
}));

/** One release, drawn like a Torq post. Releases link up like a thread. */
const ReleaseCard = styled('article', {
  shouldForwardProp: (prop) => prop !== '$latest' && prop !== '$linked',
})<{ $latest?: boolean; $linked?: boolean }>(({ theme, $latest, $linked }) => ({
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${
    $latest ? alpha(theme.palette.primary.main, 0.45) : theme.palette.divider
  }`,
  borderRadius: theme.spacing(2),
  boxShadow: $latest
    ? `0 6px 22px ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.18 : 0.12)}`
    : '0 1px 3px rgba(0, 0, 0, 0.06)',
  display: 'flex',
  flexShrink: 0,
  gap: theme.spacing(1.5),
  padding: theme.spacing(2.25),
  position: 'relative',
  // The thread line from this release's avatar down to the next one.
  ...($linked
    ? {
        '&::after': {
          backgroundColor: theme.palette.divider,
          bottom: `calc(-1 * ${theme.spacing(2)} - 1px)`,
          content: '""',
          left: `calc(${theme.spacing(2.25)} + ${AVATAR / 2}px - 1px)`,
          position: 'absolute',
          top: `calc(${theme.spacing(2.25)} + ${AVATAR}px + 6px)`,
          width: 2,
          borderRadius: 2,
        },
      }
    : {}),
  [theme.breakpoints.down('sm')]: {
    gap: theme.spacing(1.25),
    padding: theme.spacing(1.5),
    ...($linked
      ? {
          '&::after': {
            bottom: `calc(-1 * ${theme.spacing(1.5)} - 1px)`,
            left: `calc(${theme.spacing(1.5)} + ${AVATAR_PHONE / 2}px - 1px)`,
            top: `calc(${theme.spacing(1.5)} + ${AVATAR_PHONE}px + 6px)`,
          },
        }
      : {}),
  },
}));

const Avatar = styled('img')(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'dark' ? '#0d1117' : '#fff',
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: '50%',
  boxShadow:
    theme.palette.mode === 'dark'
      ? '0 2px 8px rgba(0, 0, 0, 0.3)'
      : '0 2px 8px rgba(0, 0, 0, 0.1)',
  display: 'block',
  flexShrink: 0,
  height: AVATAR,
  objectFit: 'contain',
  padding: 5,
  width: AVATAR,
  [theme.breakpoints.down('sm')]: {
    height: AVATAR_PHONE,
    padding: 4,
    width: AVATAR_PHONE,
  },
}));

const VersionPill = styled('span', {
  shouldForwardProp: (prop) => prop !== '$latest',
})<{ $latest?: boolean }>(({ theme, $latest }) => ({
  alignItems: 'center',
  backgroundColor: $latest
    ? theme.palette.primary.main
    : alpha(
        theme.palette.primary.main,
        theme.palette.mode === 'dark' ? 0.18 : 0.1
      ),
  borderRadius: 999,
  color: $latest ? theme.palette.primary.contrastText : accentText(theme),
  display: 'inline-flex',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.02em',
  lineHeight: 1,
  padding: '5px 9px',
  whiteSpace: 'nowrap',
}));

const SectionHeading = styled('h4')(({ theme }) => ({
  alignItems: 'center',
  color: accentText(theme),
  display: 'flex',
  fontSize: 12,
  fontWeight: 800,
  gap: theme.spacing(1),
  letterSpacing: '0.06em',
  margin: theme.spacing(2, 0, 0.75),
  textTransform: 'uppercase',
  '&::after': {
    backgroundColor: theme.palette.divider,
    content: '""',
    flex: 1,
    height: 1,
  },
}));

const Notes = styled('ul')(({ theme }) => ({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  '& li': {
    color: theme.palette.text.primary,
    fontSize: 15,
    lineHeight: 1.5,
    paddingLeft: theme.spacing(2.25),
    position: 'relative',
  },
  '& li::before': {
    backgroundColor: theme.palette.primary.main,
    borderRadius: '50%',
    content: '""',
    height: 6,
    left: 3,
    position: 'absolute',
    top: '0.62em',
    width: 6,
  },
  '& li + li': {
    marginTop: theme.spacing(0.9),
  },
}));

/** Matches the Show more link under a long post. */
const MoreButton = styled('button')(({ theme }) => ({
  background: 'none',
  border: 0,
  color: accentText(theme),
  cursor: 'pointer',
  font: 'inherit',
  fontSize: 14,
  fontWeight: 700,
  marginTop: theme.spacing(1.25),
  padding: 0,
  '&:hover': { textDecoration: 'underline' },
  '&:focus-visible': {
    borderRadius: 4,
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
}));

function changeCount(release: TorqRelease): number {
  return releaseSections(release).reduce(
    (sum, section) => sum + section.notes.length,
    0
  );
}

function ReleasePost({
  release,
  latest,
  linked,
}: {
  release: TorqRelease;
  latest: boolean;
  linked: boolean;
}) {
  const [open, setOpen] = useState(latest);
  const sections = releaseSections(release);
  const count = changeCount(release);
  const headingId = `torq-release-${release.version.replace(/\W/g, '-')}`;

  return (
    <ReleaseCard
      $latest={latest}
      $linked={linked}
      aria-labelledby={headingId}
      data-testid="changelog-release"
    >
      <Avatar src={torqMark} alt="" aria-hidden />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box
          sx={{
            alignItems: 'center',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0.5,
            minHeight: { xs: 36, sm: 22 },
          }}
        >
          <Typography component="span" sx={{ fontSize: 15, fontWeight: 800 }}>
            Torq
          </Typography>
          <VerifiedRoundedIcon
            aria-hidden
            sx={{ color: 'primary.main', fontSize: 16 }}
          />
          <Typography
            component="span"
            color="text.secondary"
            sx={{ fontSize: 14 }}
          >
            · {release.date}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <VersionPill $latest={latest}>
            {latest ? `Latest · ${release.version}` : release.version}
          </VersionPill>
        </Box>

        <Typography
          id={headingId}
          component="h3"
          sx={{ fontSize: 18, fontWeight: 800, lineHeight: 1.3, mt: 0.75 }}
        >
          {release.title}
        </Typography>
        <Typography
          sx={{
            color: 'text.secondary',
            fontSize: 15,
            lineHeight: 1.5,
            mt: 0.5,
          }}
        >
          {release.summary}
        </Typography>

        {open
          ? sections.map((section, index) => (
              <Box key={section.title || index}>
                {section.title ? (
                  <SectionHeading>{section.title}</SectionHeading>
                ) : (
                  <Box sx={{ height: 12 }} />
                )}
                <Notes>
                  {section.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </Notes>
              </Box>
            ))
          : null}

        {latest ? null : (
          <MoreButton
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open
              ? 'Show less'
              : `Show all ${count} ${count === 1 ? 'change' : 'changes'}`}
          </MoreButton>
        )}
      </Box>
    </ReleaseCard>
  );
}

export function ChangelogDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const fullScreen = useMediaQuery('(max-width:600px)');
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      fullScreen={fullScreen}
      maxWidth="sm"
      aria-labelledby="torq-changelog-title"
      slotProps={{
        paper: {
          sx: {
            borderRadius: fullScreen ? 0 : 3,
            display: 'flex',
            flexDirection: 'column',
            maxHeight: fullScreen ? '100%' : 'calc(100% - 32px)',
            overflow: 'hidden',
          },
        },
      }}
    >
      <Header>
        <Box sx={{ flex: 1, minWidth: 0 }} id="torq-changelog-title">
          <Typography sx={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>
            What&apos;s new in Torq
          </Typography>
          <Typography variant="body2" color="text.secondary">
            You are on Torq {TORQ_VERSION}
          </Typography>
        </Box>
        <IconButton aria-label="Close changelog" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Header>
      <Feed>
        {TORQ_CHANGELOG.map((release, index) => (
          <ReleasePost
            key={release.version}
            release={release}
            latest={index === 0}
            linked={index < TORQ_CHANGELOG.length - 1}
          />
        ))}
      </Feed>
    </Dialog>
  );
}
