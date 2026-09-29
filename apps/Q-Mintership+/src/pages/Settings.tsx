import { useState } from 'react';
import { styled } from '@mui/material/styles';
import {
  Avatar,
  Box,
  Chip,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  Snackbar,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { useAtom } from 'jotai';
import { ThemePicker } from '../hub-theme';
import { PageHeader } from '../components/layout/PageHeader';
import { PageBody } from '../components/layout/PageBody';
import { ChangelogDialog } from '../components/Settings/ChangelogDialog';
import { UserStatusBanner } from '../components/common/UserStatusBanner';
import { useUser } from '../state/user';
import {
  boardViewAtom,
  compactCardsAtom,
  defaultRoomAtom,
  showNewMarkersAtom,
  type BoardView,
  type ForumRoom,
} from '../state/settings';
import { avatarUrl } from '../qortal';
import { APP_VERSION, ORIGINAL_APP_LINK, SOURCE_REPO, UPSTREAM_REPO, UPSTREAM_VERSION } from '../constants/app';

const Section = styled('section')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  padding: theme.spacing(0, 0.5),
}));

const Card = styled('div')(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  overflow: 'hidden',
}));

const Row = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  minHeight: 56,
  padding: theme.spacing(1.25, 2),
  '& + &': { borderTop: `1px solid ${theme.palette.divider}` },
}));

const LinkRow = styled('button')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  width: '100%',
  minHeight: 56,
  padding: theme.spacing(1.25, 2),
  border: 0,
  background: 'none',
  color: 'inherit',
  cursor: 'pointer',
  font: 'inherit',
  textAlign: 'left',
  transition: 'background-color 160ms ease',
  '&:hover': { backgroundColor: theme.palette.action.hover },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: -2,
  },
  '& + &': { borderTop: `1px solid ${theme.palette.divider}` },
}));

const Copy = styled('div')({ flex: 1, minWidth: 0 });

function shortAddress(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 7)}…${address.slice(-6)}`;
}

export function Settings() {
  const user = useUser();
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [boardView, setBoardView] = useAtom(boardViewAtom);
  const [defaultRoom, setDefaultRoom] = useAtom(defaultRoomAtom);
  const [showNewMarkers, setShowNewMarkers] = useAtom(showNewMarkersAtom);
  const [compactCards, setCompactCards] = useAtom(compactCardsAtom);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(user.address);
      setCopied(true);
    } catch {
      // Clipboard can be unavailable inside some webviews; the address is still shown.
    }
  };

  const roles = [
    user.isMinterAdmin ? 'Minter Admin' : '',
    user.isForumAdmin ? 'Forum admin' : '',
  ].filter(Boolean);

  return (
    <>
      <PageHeader title="Settings" />
      <PageBody $maxWidth={720}>
        <Section>
          <SectionTitle>Account</SectionTitle>
          {user.status === 'ready' ? (
            <Card>
              <Row>
                <Avatar
                  sx={{ width: 44, height: 44 }}
                  src={user.name ? avatarUrl(user.name) : undefined}
                  alt={user.name || ''}
                >
                  {(user.name || user.address).charAt(0)}
                </Avatar>
                <Copy>
                  <Typography sx={{ fontWeight: 700 }} noWrap>
                    {user.name || 'No registered name'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {user.names.length > 1
                      ? `${user.names.length} names · the first one publishes`
                      : user.name
                        ? 'Publishes under this name'
                        : 'Register a name in Hub to post and nominate'}
                  </Typography>
                </Copy>
                {roles.map((role) => (
                  <Chip key={role} size="small" color="primary" variant="outlined" label={role} />
                ))}
              </Row>
              <Row>
                <Copy>
                  <Typography variant="body2" color="text.secondary">
                    Address
                  </Typography>
                  <Typography sx={{ fontFamily: 'ui-monospace, monospace', fontSize: 14 }} noWrap>
                    {shortAddress(user.address)}
                  </Typography>
                </Copy>
                <Tooltip title="Copy address">
                  <IconButton aria-label="Copy address" onClick={copyAddress}>
                    <ContentCopyOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Row>
            </Card>
          ) : (
            <UserStatusBanner />
          )}
        </Section>

        <Section>
          <SectionTitle>Appearance</SectionTitle>
          <ThemePicker />
          <Card>
            <Row>
              <Copy>
                <Typography sx={{ fontWeight: 600 }}>Compact cards</Typography>
                <Typography variant="body2" color="text.secondary">
                  Tighter spacing on the boards
                </Typography>
              </Copy>
              <FormControlLabel
                sx={{ m: 0 }}
                label=""
                control={
                  <Switch
                    checked={compactCards}
                    onChange={(_, checked) => setCompactCards(checked)}
                    slotProps={{ input: { 'aria-label': 'Compact cards' } }}
                  />
                }
              />
            </Row>
          </Card>
        </Section>

        <Section>
          <SectionTitle>Boards</SectionTitle>
          <Card>
            <Row>
              <Copy>
                <Typography sx={{ fontWeight: 600 }}>Minter Board view</Typography>
                <Typography variant="body2" color="text.secondary">
                  Cards show everything; the list shows one line per nomination
                </Typography>
              </Copy>
              <Select
                size="small"
                value={boardView}
                onChange={(event) => setBoardView(event.target.value as BoardView)}
                inputProps={{ 'aria-label': 'Minter Board view' }}
              >
                <MenuItem value="cards">Cards</MenuItem>
                <MenuItem value="list">List</MenuItem>
              </Select>
            </Row>
          </Card>
        </Section>

        <Section>
          <SectionTitle>Forum</SectionTitle>
          <Card>
            <Row>
              <Copy>
                <Typography sx={{ fontWeight: 600 }}>Open first</Typography>
                <Typography variant="body2" color="text.secondary">
                  The room the forum opens on
                </Typography>
              </Copy>
              <Select
                size="small"
                value={defaultRoom}
                onChange={(event) => setDefaultRoom(event.target.value as ForumRoom)}
                inputProps={{ 'aria-label': 'Forum room to open first' }}
              >
                <MenuItem value="general">General</MenuItem>
                <MenuItem value="minters">Minters</MenuItem>
                {user.isAdmin ? <MenuItem value="admins">Admins</MenuItem> : null}
              </Select>
            </Row>
            <Row>
              <Copy>
                <Typography sx={{ fontWeight: 600 }}>Mark new messages</Typography>
                <Typography variant="body2" color="text.secondary">
                  Show NEW on messages posted since your last visit
                </Typography>
              </Copy>
              <FormControlLabel
                sx={{ m: 0 }}
                label=""
                control={
                  <Switch
                    checked={showNewMarkers}
                    onChange={(_, checked) => setShowNewMarkers(checked)}
                    slotProps={{ input: { 'aria-label': 'Mark new messages' } }}
                  />
                }
              />
            </Row>
          </Card>
        </Section>

        <Section>
          <SectionTitle>About</SectionTitle>
          <Card>
            <LinkRow type="button" onClick={() => setChangelogOpen(true)}>
              <Copy>
                <Typography sx={{ fontWeight: 700 }}>Q-Mintership+ {APP_VERSION}</Typography>
                <Typography variant="body2" color="text.secondary">
                  What&apos;s new · ported from Q-Mintership {UPSTREAM_VERSION}
                </Typography>
              </Copy>
              <ArrowForwardIosIcon sx={{ fontSize: 16, opacity: 0.6 }} />
            </LinkRow>
            <LinkRow type="button" onClick={() => window.open(ORIGINAL_APP_LINK, '_blank', 'noopener')}>
              <Copy>
                <Typography sx={{ fontWeight: 700 }}>The original Q-Mintership</Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {ORIGINAL_APP_LINK}
                </Typography>
              </Copy>
              <OpenInNewOutlinedIcon sx={{ fontSize: 18, opacity: 0.6 }} />
            </LinkRow>
            <LinkRow type="button" onClick={() => window.open(UPSTREAM_REPO, '_blank', 'noopener')}>
              <Copy>
                <Typography sx={{ fontWeight: 700 }}>Upstream source</Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {UPSTREAM_REPO}
                </Typography>
              </Copy>
              <OpenInNewOutlinedIcon sx={{ fontSize: 18, opacity: 0.6 }} />
            </LinkRow>
            <LinkRow type="button" onClick={() => window.open(SOURCE_REPO, '_blank', 'noopener')}>
              <Copy>
                <Typography sx={{ fontWeight: 700 }}>Q-Apps+ source</Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {SOURCE_REPO}
                </Typography>
              </Copy>
              <OpenInNewOutlinedIcon sx={{ fontSize: 18, opacity: 0.6 }} />
            </LinkRow>
          </Card>
          <Box sx={{ px: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Q-Mintership+ reads and writes the same QDN boards, forum rooms and polls as the
              original app, so both show the same data.
            </Typography>
          </Box>
        </Section>
      </PageBody>
      <ChangelogDialog open={changelogOpen} onClose={() => setChangelogOpen(false)} />
      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message="Address copied"
      />
    </>
  );
}

export default Settings;
