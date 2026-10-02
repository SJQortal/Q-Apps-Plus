/**
 * Settings: a full page (docs/DESIGN.md → Settings page), reached from the
 * navigation. Sections: Account, Appearance, Mail, Sync, About.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, type Location } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  IconButton,
  Link,
  Rating,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import PersonOffOutlinedIcon from '@mui/icons-material/PersonOffOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import RestoreOutlinedIcon from '@mui/icons-material/RestoreOutlined';
import useConfirmationModal from '../../hooks/useConfirmModal';
import { ThemePicker, headerFill, themeOptions, useHubTheme } from '../../hub-theme';
import { useAppShell } from '../../app-shell/AppShellContext';
import { BlockedNamesModal } from '../../components/common/BlockedNamesModal/BlockedNamesModal';
import {
  readAutoApplyQdnState,
  writeAutoApplyQdnState,
} from '../../utils/qdnStatePreference';
import packageJson from '../../../package.json';
import { ChangelogDialog } from './ChangelogDialog';
import { SETTINGS_PATH } from './settingsPath';

export { SETTINGS_PATH };
export const APP_VERSION: string = packageJson.version;
const UPSTREAM_URL = 'https://github.com/Qortal/q-mail';
const SOURCE_URL = 'https://github.com/SJQortal/Q-Apps-Plus';

const Page = styled('main')(({ theme }) => ({
  minHeight: '100%',
  width: '100%',
  color: theme.palette.text.primary,
  // 44 px targets in every theme (Hub 2.0's MUI defaults are 37 px).
  '& .MuiButton-root': { minHeight: 44 },
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  paddingBottom: `calc(${theme.spacing(6)} + env(safe-area-inset-bottom, 0px))`,
}));

const Header = styled('header')(({ theme }) => ({
  position: 'sticky',
  top: 0,
  zIndex: 2,
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1, 1.5),
  backgroundColor: headerFill(theme),
  backdropFilter: 'blur(12px)',
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const Column = styled('div')(({ theme }) => ({
  width: '100%',
  maxWidth: 720,
  padding: theme.spacing(2),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
}));

const SectionTitle = styled('h2')(({ theme }) => ({
  margin: 0,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontSize: '0.875rem',
  fontWeight: 700,
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(1),
}));

const Card = styled('div')(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(2),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.5),
}));

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <SectionTitle>{title}</SectionTitle>
      <Card>{children}</Card>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, minHeight: 44 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 500 }}>{label}</Typography>
        {hint && (
          <Typography variant="body2" color="text.secondary">
            {hint}
          </Typography>
        )}
      </Box>
      {children}
    </Box>
  );
}

type TextSize = 'small' | 'medium' | 'large';

export function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userAvatar, setActiveName, authenticate, controller, state, mailSync } = useAppShell();
  const { setUiTheme, config: themeKitConfig } = useHubTheme();
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const identityKey = user?.address || user?.name || '';
  const [autoApplyQdnState, setAutoApplyQdnState] = useState(() => readAutoApplyQdnState(identityKey));

  useEffect(() => {
    setAutoApplyQdnState(readAutoApplyQdnState(identityKey));
  }, [identityKey]);

  const { Modal: PublishStateModal, showModal: showPublishStateModal } = useConfirmationModal({
    title: 'Publish mail state?',
    message: `This publishes your read state, subjects, archived list, theme, text size and watched aliases as an encrypted document (qmail_state_v1) under ${
      user?.name || 'your name'
    }, so other devices can load it. It costs one QDN publish.`,
    confirmLabel: 'Publish',
  });
  const [isPublishingFromSettings, setIsPublishingFromSettings] = useState(false);
  const publishMailStateNow = async () => {
    if (!mailSync) return;
    const confirmed = await showPublishStateModal();
    if (!confirmed) return;
    setIsPublishingFromSettings(true);
    try {
      await mailSync.publishMailState();
    } finally {
      setIsPublishingFromSettings(false);
    }
  };
  const isPublishingState = Boolean(mailSync?.isPublishing) || isPublishingFromSettings;

  // Appearance from the published document: shown, and applied only on click.
  const publishedAppearance = mailSync?.publishedAppearance ?? null;
  const publishedThemeName = publishedAppearance?.uiTheme
    ? themeOptions(themeKitConfig.hub20).find((option) => option.id === publishedAppearance.uiTheme)?.name
    : undefined;
  const publishedAppearanceSummary = [
    publishedThemeName ? `Theme: ${publishedThemeName}` : null,
    publishedAppearance?.textSize ? `Text size: ${publishedAppearance.textSize}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const restoreAppearance = () => {
    if (!publishedAppearance) return;
    if (publishedAppearance.uiTheme) setUiTheme(publishedAppearance.uiTheme);
    if (publishedAppearance.textSize) controller.setTextSize(publishedAppearance.textSize);
  };

  const goBack = () => {
    const background = (location.state as { backgroundLocation?: Location } | null)?.backgroundLocation;
    navigate(background ?? '/');
  };

  const names = user?.names ?? [];
  const activeName = user?.name ?? '';
  const isAuthenticated = Boolean(user?.address || user?.name);

  return (
    <Page>
      <Header>
        <IconButton onClick={goBack} aria-label="Back to mail" size="large">
          <ArrowBackIcon />
        </IconButton>
        <Typography component="h1" variant="h6" sx={{ fontWeight: 700 }}>
          Settings
        </Typography>
      </Header>

      <Column>
        <Section title="Account">
          {isAuthenticated ? (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar src={userAvatar || undefined} alt="" sx={{ width: 44, height: 44 }}>
                  {activeName?.[0]?.toUpperCase() || '?'}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }} noWrap>
                    {activeName || 'No name registered'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {user?.address}
                  </Typography>
                </Box>
              </Box>
              {names.length > 1 && (
                <>
                  <Typography variant="body2" color="text.secondary">
                    Active mailbox
                  </Typography>
                  <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }} role="radiogroup" aria-label="Active name">
                    {names.map((entry) => {
                      const selected = entry.name === activeName;
                      return (
                        <Chip
                          key={entry.name}
                          label={entry.name}
                          icon={selected ? <CheckIcon /> : undefined}
                          color={selected ? 'primary' : 'default'}
                          variant={selected ? 'filled' : 'outlined'}
                          onClick={() => setActiveName(entry.name)}
                          role="radio"
                          aria-checked={selected}
                          sx={{ minHeight: 36 }}
                        />
                      );
                    })}
                  </Stack>
                </>
              )}
            </>
          ) : (
            <Row label="Not signed in" hint="Authenticate to read and send mail.">
              <Button variant="contained" onClick={() => void authenticate()}>
                Authenticate
              </Button>
            </Row>
          )}
        </Section>

        <Section title="Appearance">
          <Typography variant="body2" color="text.secondary">
            Theme
          </Typography>
          <ThemePicker />
          <Divider />
          <Row label="Text size">
            <ToggleButtonGroup
              exclusive
              size="small"
              value={state.settings.textSize}
              onChange={(_, value: TextSize | null) => {
                if (value) controller.setTextSize(value);
              }}
              aria-label="Text size"
              sx={{ '& .MuiToggleButton-root': { minHeight: 44, fontSize: '0.875rem' } }}
            >
              <ToggleButton value="small">Small</ToggleButton>
              <ToggleButton value="medium">Medium</ToggleButton>
              <ToggleButton value="large">Large</ToggleButton>
            </ToggleButtonGroup>
          </Row>
        </Section>

        <Section title="Mail">
          <FormControlLabel
            sx={{ m: 0, justifyContent: 'space-between', minHeight: 44 }}
            labelPlacement="start"
            label="Authenticate on startup"
            control={
              <Switch
                checked={state.settings.authOnStartup}
                onChange={(event) => controller.setAuthOnStartup(event.target.checked)}
              />
            }
          />
          <Row label="Blocked names" hint="Mail from blocked names is hidden.">
            <Button
              variant="outlined"
              startIcon={<PersonOffOutlinedIcon />}
              onClick={() => setBlockedOpen(true)}
              disabled={!isAuthenticated}
            >
              Manage
            </Button>
          </Row>
        </Section>

        <Section title="Sync">
          <Row
            label="Publish mail state now"
            hint={
              !isAuthenticated
                ? 'Sign in to publish.'
                : !mailSync
                ? 'Open your mailbox first.'
                : mailSync.hasPendingChanges
                ? 'Unpublished changes. Costs one QDN publish.'
                : 'Up to date. Publishing again costs one QDN publish.'
            }
          >
            <Button
              variant="outlined"
              startIcon={<CloudUploadOutlinedIcon />}
              onClick={() => void publishMailStateNow()}
              disabled={!isAuthenticated || !mailSync || isPublishingState}
              sx={{ minHeight: 44 }}
            >
              {isPublishingState ? 'Publishing…' : 'Publish'}
            </Button>
          </Row>
          <Divider />
          <Row
            label="Restore appearance from the published state"
            hint={
              !isAuthenticated
                ? 'Sign in to load the published state.'
                : !mailSync
                ? 'Open your mailbox to load the published state.'
                : publishedAppearanceSummary || 'The published state carries no theme or text size yet.'
            }
          >
            <Button
              variant="outlined"
              startIcon={<RestoreOutlinedIcon />}
              onClick={restoreAppearance}
              disabled={!isAuthenticated || !publishedAppearanceSummary}
              sx={{ minHeight: 44 }}
            >
              Restore
            </Button>
          </Row>
          <Divider />
          <FormControlLabel
            sx={{ m: 0, justifyContent: 'space-between', minHeight: 44 }}
            labelPlacement="start"
            label="Always fetch and apply published mail state"
            disabled={!identityKey}
            control={
              <Switch
                checked={autoApplyQdnState}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setAutoApplyQdnState(checked);
                  writeAutoApplyQdnState(identityKey, checked);
                }}
              />
            }
          />
          <Typography variant="body2" color="text.secondary">
            When on, the published state is loaded on this device without asking first. When off, Q-Mail+ asks
            once per sign-in.
          </Typography>
        </Section>

        <Section title="About">
          <Row label={`Q-Mail+ ${APP_VERSION}`} hint="Simon's + version of Q-Mail.">
            <Button variant="outlined" onClick={() => setChangelogOpen(true)}>
              What's new
            </Button>
          </Row>
          {state.rating.enabled && (
            <Row label="Rate this app">
              <Rating
                value={state.rating.userVote ?? 0}
                onChange={(_, value) => {
                  if (value) void controller.submitRating(value);
                }}
                disabled={!isAuthenticated || state.rating.loading}
              />
            </Row>
          )}
          <Typography variant="body2" color="text.secondary">
            Based on{' '}
            <Link href={UPSTREAM_URL} target="_blank" rel="noreferrer">
              Q-Mail by the Qortal team
            </Link>
            . Source:{' '}
            <Link href={SOURCE_URL} target="_blank" rel="noreferrer">
              SJQortal/Q-Apps-Plus
            </Link>
            .
          </Typography>
        </Section>
      </Column>

      <PublishStateModal />
      {blockedOpen && <BlockedNamesModal open={blockedOpen} onClose={() => setBlockedOpen(false)} />}
      <ChangelogDialog open={changelogOpen} onClose={() => setChangelogOpen(false)} />
    </Page>
  );
}
