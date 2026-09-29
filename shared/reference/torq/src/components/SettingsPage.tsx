import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePhoneLayout } from '../hooks/usePhoneLayout';
import { styled } from '@mui/system';
import {
  Typography,
  IconButton,
  Switch,
  TextField,
  Button,
  Chip,
  Box,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import BlockIcon from '@mui/icons-material/Block';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import GroupsIcon from '@mui/icons-material/Groups';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsIcon from '@mui/icons-material/Notifications';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import ViewSidebarOutlinedIcon from '@mui/icons-material/ViewSidebarOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import { useAtom, useAtomValue } from 'jotai';
import { showError, showSuccess, useGlobal } from 'qapp-core';
import {
  fetchSettingsFromQdn,
  publishSettingsToQdn,
} from '../utils/settingsQdn';
import {
  hiddenUsersAtom,
  hiddenWordsAtom,
  expandNestedRepliesAtom,
  subscriptionsEnabledAtom,
  editHistoryEnabledAtom,
  nameSwitcherOnHomeAtom,
  rightPanelNotificationsEnabledAtom,
  sidePanelsHideOnScrollAtom,
  trendingEnabledAtom,
  uiThemeAtom,
  UI_THEME_HUB,
  UI_THEME_QUITTER,
  UI_THEME_WHITE,
  UI_THEME_X,
  type TorqUiThemeId,
} from '../state/global/settings';
import { headerFill, HUB_BLUE } from '../styles/theme/theme';
import {
  notificationSnackbarEnabledAtom,
  notificationSoundEnabledAtom,
} from '../state/global/notifications';
import { testNotificationSound } from '../utils/notificationSound';
import { isPublicNodeAtom } from '../state/global/system';
import {
  addHiddenUsers,
  addHiddenWords,
  currentHiddenUserQuery,
  MAX_HIDDEN_USERS,
  MAX_HIDDEN_WORDS,
  normalizeHiddenUser,
  removeHiddenUser,
  removeHiddenWord,
  stripLastHiddenUserToken,
} from '../utils/contentFilters';
import { followedUsersAtom } from '../state/global/follows';
import { useMentionSearch } from '../hooks/useMentionSearch';
import { MentionAutocomplete } from './MentionAutocomplete';
import { NameSwitcher } from './NameSwitcher';
import { TORQ_VERSION } from '../constants/changelog';
import { ChangelogDialog } from './ChangelogDialog';

const PageContainer = styled('div')(({ theme }) => ({
  width: '100%',
  maxWidth: '600px',
  margin: '0 auto',
  minHeight: 'var(--torq-app-height)',
  position: 'relative',
  '@media (max-width: 1300px)': {
    maxWidth: '100%',
  },
}));

const PageHeader = styled('div')(({ theme }) => ({
  position: 'sticky',
  top: 0,
  background: headerFill(theme),
  backdropFilter: 'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  borderBottom: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(2),
  zIndex: 10,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  '@media (max-width: 1000px)': {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: 'calc(64px + env(safe-area-inset-top, 0px))',
    padding: 'env(safe-area-inset-top, 0px) 12px 0',
    zIndex: 30,
  },
}));

const ThemeGrid = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: theme.spacing(1.25),
  width: '100%',
  marginTop: theme.spacing(1.5),
  '@media (max-width: 420px)': {
    gridTemplateColumns: '1fr',
  },
}));

const ThemeCard = styled('button')<{ $active?: boolean }>(({ theme, $active }) => ({
  appearance: 'none',
  textAlign: 'left',
  cursor: 'pointer',
  borderRadius: 12,
  border: `1px solid ${
    $active ? theme.palette.primary.main : theme.palette.divider
  }`,
  background: theme.palette.background.paper,
  color: 'inherit',
  padding: theme.spacing(1.25),
  display: 'grid',
  gap: theme.spacing(1),
  boxShadow: $active ? `0 0 0 1px ${theme.palette.primary.main}` : 'none',
  transition: 'border-color 160ms ease, box-shadow 160ms ease',
}));

const ThemeSwatches = styled('div')({
  display: 'flex',
  height: 44,
  overflow: 'hidden',
  borderRadius: 8,
});

const ThemeSwatch = styled('span')({
  flex: 1,
});

const NameSwitchSection = styled('section')(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  padding: theme.spacing(2.5, 2, 1.5),
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const Section = styled('section')(({ theme }) => ({
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(1.5),
}));

const SettingRow = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(2),
  padding: theme.spacing(1.25, 0),
}));

const DesktopOnlySection = styled(Section)({
  '@media (max-width: 1000px)': {
    display: 'none',
  },
});

const DesktopOnlyRow = styled(SettingRow)({
  '@media (max-width: 1000px)': {
    display: 'none',
  },
});

const FilterBlock = styled(SettingRow)({
  alignItems: 'flex-start',
  flexDirection: 'column',
});

const SettingCopy = styled('div')({
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

const LinkRow = styled('button')(({ theme }) => ({
  appearance: 'none',
  width: '100%',
  border: 0,
  background: 'transparent',
  color: 'inherit',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(2),
  padding: theme.spacing(1.5, 0),
  cursor: 'pointer',
  textAlign: 'left',
  '&:disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
}));

const WordRow = styled('div')(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  alignItems: 'flex-start',
  marginTop: theme.spacing(1.5),
  minWidth: 0,
  width: '100%',
  '@media (max-width: 600px)': {
    flexDirection: 'column',
    '& > button': {
      alignSelf: 'stretch',
    },
    '& .MuiInputBase-input': {
      fontSize: 16,
    },
  },
}));

const SyncRow = styled('div')(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
  marginTop: theme.spacing(1.5),
  width: '100%',
  '& > button': {
    flex: '1 1 220px',
  },
}));

const WordList = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
  marginTop: theme.spacing(1.5),
}));

interface SettingsPageProps {
  onBack?: () => void;
  onBlockedUsers?: () => void;
}

export function SettingsPage({
  onBack = () => {},
  onBlockedUsers = () => {},
}: SettingsPageProps) {
  const phone = usePhoneLayout();
  const { auth, identifierOperations } = useGlobal();
  const isPublicNode = useAtomValue(isPublicNodeAtom);
  const [uiTheme, setUiTheme] = useAtom(uiThemeAtom);
  const [trendingEnabled, setTrendingEnabled] = useAtom(trendingEnabledAtom);
  const [expandNestedReplies, setExpandNestedReplies] = useAtom(
    expandNestedRepliesAtom
  );
  const [subscriptionsEnabled, setSubscriptionsEnabled] = useAtom(
    subscriptionsEnabledAtom
  );
  const [editHistoryEnabled, setEditHistoryEnabled] = useAtom(
    editHistoryEnabledAtom
  );
  const [sidePanelsHideOnScroll, setSidePanelsHideOnScroll] = useAtom(
    sidePanelsHideOnScrollAtom
  );
  const [nameSwitcherOnHome, setNameSwitcherOnHome] = useAtom(
    nameSwitcherOnHomeAtom
  );
  const [rightPanelNotificationsEnabled, setRightPanelNotificationsEnabled] =
    useAtom(rightPanelNotificationsEnabledAtom);
  const [snackbarEnabled, setSnackbarEnabled] = useAtom(
    notificationSnackbarEnabledAtom
  );
  const [soundEnabled, setSoundEnabled] = useAtom(notificationSoundEnabledAtom);
  const [hiddenWords, setHiddenWords] = useAtom(hiddenWordsAtom);
  const [hiddenUsers, setHiddenUsers] = useAtom(hiddenUsersAtom);
  const followedUsers = useAtomValue(followedUsersAtom);
  const [wordInput, setWordInput] = useState('');
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [isSavingToQdn, setIsSavingToQdn] = useState(false);
  const [isFetchingFromQdn, setIsFetchingFromQdn] = useState(false);
  const [nameMenuOpen, setNameMenuOpen] = useState(false);
  const [selectedNameIndex, setSelectedNameIndex] = useState(0);
  const [nameMenuPosition, setNameMenuPosition] = useState({ top: 0, left: 0 });
  const userFieldRef = useRef<HTMLDivElement>(null);
  const followedNames = useMemo(
    () => followedUsers.map((user) => user.userName).filter(Boolean),
    [followedUsers]
  );
  const {
    suggestions,
    isSearching,
    search: searchUsers,
    reset: resetUserSearch,
  } = useMentionSearch(followedNames);
  const nameQuery = currentHiddenUserQuery(userInput);
  const visibleSuggestions = useMemo(() => {
    const hidden = new Set(
      hiddenUsers.map((name) => normalizeHiddenUser(name).toLowerCase())
    );
    return suggestions.filter(
      (name) => !hidden.has(normalizeHiddenUser(name).toLowerCase())
    );
  }, [suggestions, hiddenUsers]);

  const updateNameMenuPosition = () => {
    const field = userFieldRef.current;
    if (!field) return;
    const rect = field.getBoundingClientRect();
    setNameMenuPosition({ top: rect.bottom + 4, left: rect.left });
  };

  const closeNameMenu = () => {
    setNameMenuOpen(false);
    setSelectedNameIndex(0);
    resetUserSearch();
  };

  useEffect(() => {
    setSelectedNameIndex(0);
  }, [visibleSuggestions]);

  useEffect(() => {
    if (!nameMenuOpen) return;
    const update = () => updateNameMenuPosition();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [nameMenuOpen]);

  const handleAddWords = () => {
    const next = addHiddenWords(hiddenWords, wordInput);
    if (next !== hiddenWords) {
      setHiddenWords(next);
    }
    setWordInput('');
  };

  const handleAddUsers = () => {
    const next = addHiddenUsers(hiddenUsers, userInput);
    if (next !== hiddenUsers) {
      setHiddenUsers(next);
    }
    setUserInput('');
    closeNameMenu();
  };

  const handleSelectHiddenUser = (name: string) => {
    if (hiddenUsers.length >= MAX_HIDDEN_USERS) return;
    const leftover = stripLastHiddenUserToken(userInput);
    const next = addHiddenUsers(hiddenUsers, name);
    if (next !== hiddenUsers) {
      setHiddenUsers(next);
    }
    setUserInput(leftover);
    closeNameMenu();
  };

  const canSyncSettings = Boolean(auth?.name && identifierOperations);
  const isSyncingSettings = isSavingToQdn || isFetchingFromQdn;

  const handleSaveSettingsToQdn = async () => {
    if (!auth?.name || !identifierOperations || isSyncingSettings) return;
    setIsSavingToQdn(true);
    try {
      await publishSettingsToQdn(
        auth.name,
        {
          uiTheme,
          trendingEnabled,
          expandNestedReplies,
          subscriptionsEnabled,
          editHistoryEnabled,
          sidePanelsHideOnScroll,
          nameSwitcherOnHome,
          rightPanelNotificationsEnabled,
          notificationAlerts: snackbarEnabled,
          notificationSound: soundEnabled,
          hiddenWords,
          hiddenUsers,
        },
        identifierOperations
      );
      showSuccess('Settings saved to QDN');
    } catch (error) {
      console.error('Error saving settings to QDN:', error);
      showError('Could not save settings to QDN');
    } finally {
      setIsSavingToQdn(false);
    }
  };

  const handleFetchSettingsFromQdn = async () => {
    if (!auth?.name || !identifierOperations || isSyncingSettings) return;
    setIsFetchingFromQdn(true);
    try {
      const remote = await fetchSettingsFromQdn(auth.name, identifierOperations);
      if (!remote) {
        showError('No settings saved on QDN for this account yet');
        return;
      }
      setUiTheme(remote.uiTheme);
      setTrendingEnabled(remote.trendingEnabled);
      setExpandNestedReplies(remote.expandNestedReplies);
      setSubscriptionsEnabled(remote.subscriptionsEnabled);
      setEditHistoryEnabled(remote.editHistoryEnabled === true);
      setSidePanelsHideOnScroll(remote.sidePanelsHideOnScroll);
      setNameSwitcherOnHome(remote.nameSwitcherOnHome === true);
      setRightPanelNotificationsEnabled(remote.rightPanelNotificationsEnabled);
      setSnackbarEnabled(remote.notificationAlerts);
      setSoundEnabled(remote.notificationSound);
      setHiddenWords(remote.hiddenWords);
      setHiddenUsers(remote.hiddenUsers);
      showSuccess('Settings restored from QDN');
    } catch (error) {
      console.error('Error fetching settings from QDN:', error);
      showError('Could not fetch settings from QDN');
    } finally {
      setIsFetchingFromQdn(false);
    }
  };

  const handleUserInputChange = (value: string) => {
    setUserInput(value);
    const query = currentHiddenUserQuery(value);
    if (!query) {
      closeNameMenu();
      return;
    }
    updateNameMenuPosition();
    setNameMenuOpen(true);
    searchUsers(query);
  };

  return (
    <PageContainer>
      {phone ? (
        <div
          aria-hidden
          style={{ height: 'calc(64px + env(safe-area-inset-top, 0px))' }}
        />
      ) : null}
      {phone ? (
        createPortal(
          <PageHeader data-torq-pinned-header>
            <IconButton onClick={onBack} size="small" aria-label="Back">
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h6" fontWeight={700}>
              Settings
            </Typography>
          </PageHeader>,
          document.body
        )
      ) : (
        <PageHeader>
          <IconButton onClick={onBack} size="small" aria-label="Back">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" fontWeight={700}>
            Settings
          </Typography>
        </PageHeader>
      )}

      {/* Phones have no left panel, so they always keep the switcher here. */}
      {phone || !nameSwitcherOnHome ? (
        <NameSwitchSection>
          <NameSwitcher variant="settings" />
        </NameSwitchSection>
      ) : null}

      <Section>
        <SectionTitle>Account</SectionTitle>
        <SettingCopy>
          <Typography
            fontWeight={700}
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <CloudSyncIcon fontSize="small" color="primary" />
            QDN settings
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Save these settings to your Qortal name, then fetch them on another
            device. Follows and Qortal blocked users stay on those lists.
          </Typography>
        </SettingCopy>
        {!canSyncSettings ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            Sign in with a Qortal name to sync settings.
          </Typography>
        ) : null}
        <SyncRow>
          <Button
            variant="outlined"
            startIcon={<CloudUploadIcon />}
            onClick={() => void handleSaveSettingsToQdn()}
            disabled={!canSyncSettings || isSyncingSettings}
          >
            {isSavingToQdn ? 'Saving…' : 'Save Settings to QDN'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<CloudDownloadIcon />}
            onClick={() => void handleFetchSettingsFromQdn()}
            disabled={!canSyncSettings || isSyncingSettings}
          >
            {isFetchingFromQdn ? 'Fetching…' : 'Fetch Settings from QDN'}
          </Button>
        </SyncRow>
      </Section>

      <Section>
        <SectionTitle>Appearance</SectionTitle>
        <SettingCopy>
          <Typography
            fontWeight={700}
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <PaletteOutlinedIcon fontSize="small" color="primary" />
            Theme
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Choose how Torq looks. This applies to the feed, composer, embeds,
            and menus.
          </Typography>
        </SettingCopy>
        <ThemeGrid>
          {(
            [
              {
                id: UI_THEME_HUB,
                name: 'Hub 3.0 Theme',
                description: 'Hub chat surfaces and soft blue',
                swatches: ['#0E0F14', '#1D1F27', HUB_BLUE.primary, '#F6F2EA'],
              },
              {
                id: UI_THEME_QUITTER,
                name: 'Quitter Theme',
                description: 'Twitter-style blues and charcoal',
                swatches: ['#15202b', '#192734', '#1d9bf0', '#f7f9fc'],
              },
              {
                id: UI_THEME_X,
                name: 'X Theme',
                description: 'Lights-out black, X blue, and gray borders',
                swatches: ['#000000', '#16181c', '#2f3336', '#1d9bf0'],
              },
              {
                id: UI_THEME_WHITE,
                name: 'White Theme',
                description: 'Clean white surfaces and black text',
                swatches: ['#ffffff', '#f6f6f6', '#111111', '#e6e6e6'],
              },
            ] as Array<{
              id: TorqUiThemeId;
              name: string;
              description: string;
              swatches: string[];
            }>
          ).map((option) => {
            const active = uiTheme === option.id;
            return (
              <ThemeCard
                key={option.id}
                type="button"
                $active={active}
                aria-pressed={active}
                aria-label={option.name}
                onClick={() => setUiTheme(option.id)}
              >
                <ThemeSwatches>
                  {option.swatches.map((color) => (
                    <ThemeSwatch key={color} style={{ backgroundColor: color }} />
                  ))}
                </ThemeSwatches>
                <div>
                  <Typography fontWeight={750} sx={{ fontSize: 14 }}>
                    {option.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.description}
                  </Typography>
                </div>
              </ThemeCard>
            );
          })}
        </ThemeGrid>
      </Section>

      <Section>
        <SectionTitle>Notifications</SectionTitle>
        <SettingRow>
          <SettingCopy>
            <Typography
              fontWeight={700}
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <NotificationsActiveIcon fontSize="small" color="primary" />
              Notification Alerts
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Show a popup alert when you receive new notifications
            </Typography>
          </SettingCopy>
          <Switch
            checked={snackbarEnabled}
            onChange={(event) => setSnackbarEnabled(event.target.checked)}
            inputProps={{ 'aria-label': 'Toggle notification alerts' }}
            color="primary"
          />
        </SettingRow>
        <SettingRow>
          <SettingCopy>
            <Typography
              fontWeight={700}
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <VolumeUpIcon fontSize="small" color="primary" />
              Notification Sound
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Play a sound when new notifications arrive{' '}
              <Box
                component="span"
                sx={{
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  testNotificationSound();
                }}
              >
                (test sound)
              </Box>
            </Typography>
          </SettingCopy>
          <Switch
            checked={soundEnabled}
            onChange={(event) => setSoundEnabled(event.target.checked)}
            inputProps={{ 'aria-label': 'Toggle notification sound' }}
            color="primary"
          />
        </SettingRow>
        <DesktopOnlyRow data-desktop-only="true">
          <SettingCopy>
            <Typography
              fontWeight={700}
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <NotificationsIcon fontSize="small" color="primary" />
              Right panel notifications
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Show notifications on the right panel. When off, they appear on
              the Profile button
            </Typography>
          </SettingCopy>
          <Switch
            checked={rightPanelNotificationsEnabled}
            onChange={(event) =>
              setRightPanelNotificationsEnabled(event.target.checked)
            }
            inputProps={{ 'aria-label': 'Toggle right panel notifications' }}
            color="primary"
          />
        </DesktopOnlyRow>
      </Section>

      <DesktopOnlySection data-desktop-only="true">
        <SectionTitle>Layout</SectionTitle>
        <SettingRow>
          <SettingCopy>
            <Typography
              fontWeight={700}
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <ViewSidebarOutlinedIcon fontSize="small" color="primary" />
              Hide side panels on scroll
            </Typography>
            <Typography variant="body2" color="text.secondary">
              The side columns stay in place. Home, Profile, Bookmarks,
              Settings, Post, Discover, and the right panel slide up with the
              feed, and scroll back down at the same speed. Turn this off to
              keep them on screen.
            </Typography>
          </SettingCopy>
          <Switch
            checked={sidePanelsHideOnScroll}
            onChange={(event) =>
              setSidePanelsHideOnScroll(event.target.checked)
            }
            inputProps={{ 'aria-label': 'Toggle hide side panels on scroll' }}
            color="primary"
          />
        </SettingRow>
        <SettingRow>
          <SettingCopy>
            <Typography
              fontWeight={700}
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <ManageAccountsOutlinedIcon fontSize="small" color="primary" />
              Name switcher on Home
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Show the name switcher at the bottom of the left panel. When off,
              it stays at the top of Settings.
            </Typography>
          </SettingCopy>
          <Switch
            checked={nameSwitcherOnHome}
            onChange={(event) => setNameSwitcherOnHome(event.target.checked)}
            inputProps={{ 'aria-label': 'Toggle name switcher on Home' }}
            color="primary"
          />
        </SettingRow>
      </DesktopOnlySection>

      <Section>
        <SectionTitle>Content</SectionTitle>
        <SettingRow>
          <SettingCopy>
            <Typography
              fontWeight={700}
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <WhatshotIcon fontSize="small" color="primary" />
              Trending
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Show trending hashtags on Home and in What's happening
            </Typography>
          </SettingCopy>
          <Switch
            checked={trendingEnabled}
            onChange={(event) => setTrendingEnabled(event.target.checked)}
            inputProps={{ 'aria-label': 'Toggle trending' }}
            color="primary"
          />
        </SettingRow>
        <SettingRow>
          <SettingCopy>
            <Typography
              fontWeight={700}
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <AccountTreeIcon fontSize="small" color="primary" />
              Expand reply threads
            </Typography>
            <Typography variant="body2" color="text.secondary">
              When viewing a post, open every reply and reply-to-reply. When
              off, only the first line of replies is shown; deeper replies stay
              hidden until you tap Show replies
            </Typography>
          </SettingCopy>
          <Switch
            checked={expandNestedReplies}
            onChange={(event) => setExpandNestedReplies(event.target.checked)}
            inputProps={{ 'aria-label': 'Toggle expand reply threads' }}
            color="primary"
          />
        </SettingRow>
        <SettingRow>
          <SettingCopy>
            <Typography
              fontWeight={700}
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <HistoryOutlinedIcon fontSize="small" color="primary" />
              Edited posts
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Show a quiet Edited mark next to the date when a post has been
              changed. Open it to see when it changed and the current post.
            </Typography>
          </SettingCopy>
          <Switch
            checked={editHistoryEnabled}
            onChange={(event) => setEditHistoryEnabled(event.target.checked)}
            inputProps={{ 'aria-label': 'Toggle edit history' }}
            color="primary"
          />
        </SettingRow>
        <SettingRow>
          <SettingCopy>
            <Typography
              fontWeight={700}
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <GroupsIcon fontSize="small" color="primary" />
              Subscriptions
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Encrypted group posts and the Subscriptions page. A profile that
              has launched a subscription still shows Subscribe to everyone
            </Typography>
          </SettingCopy>
          <Switch
            checked={subscriptionsEnabled}
            onChange={(event) =>
              setSubscriptionsEnabled(event.target.checked)
            }
            inputProps={{ 'aria-label': 'Toggle subscriptions' }}
            color="primary"
          />
        </SettingRow>

        <FilterBlock>
          <SettingCopy>
            <Typography
              fontWeight={700}
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <FilterAltIcon fontSize="small" color="primary" />
              Hidden words
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Hide posts that contain these words or phrases
            </Typography>
          </SettingCopy>
          <WordRow>
            <TextField
              size="small"
              fullWidth
              label="Add a word or phrase"
              value={wordInput}
              onChange={(event) => setWordInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleAddWords();
                }
              }}
              helperText="Separate multiple words with commas"
            />
            <Button
              variant="contained"
              onClick={handleAddWords}
              disabled={!wordInput.trim() || hiddenWords.length >= MAX_HIDDEN_WORDS}
            >
              Add
            </Button>
          </WordRow>
          {hiddenWords.length > 0 ? (
            <WordList>
              {hiddenWords.map((word) => (
                <Chip
                  key={word.toLowerCase()}
                  label={word}
                  onDelete={() =>
                    setHiddenWords(removeHiddenWord(hiddenWords, word))
                  }
                />
              ))}
            </WordList>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              No hidden words yet
            </Typography>
          )}
        </FilterBlock>

        <FilterBlock>
          <SettingCopy>
            <Typography
              fontWeight={700}
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <VisibilityOffIcon fontSize="small" color="primary" />
              Hidden users
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Hide posts from these accounts in Torq only. You still see their
              likes, and their comments on your posts. This does not block them
              across Qortal.
            </Typography>
          </SettingCopy>
          <WordRow>
            <Box ref={userFieldRef} sx={{ flex: 1, minWidth: 0 }}>
              <TextField
                size="small"
                fullWidth
                label="Add a username"
                value={userInput}
                onChange={(event) => handleUserInputChange(event.target.value)}
                onFocus={() => {
                  if (nameQuery) {
                    updateNameMenuPosition();
                    setNameMenuOpen(true);
                    searchUsers(nameQuery);
                  }
                }}
                onBlur={() => {
                  window.setTimeout(() => setNameMenuOpen(false), 0);
                }}
                onKeyDown={(event) => {
                  if (nameMenuOpen && visibleSuggestions.length > 0) {
                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      setSelectedNameIndex((index) =>
                        index < visibleSuggestions.length - 1 ? index + 1 : index
                      );
                      return;
                    }
                    if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      setSelectedNameIndex((index) =>
                        index > 0 ? index - 1 : 0
                      );
                      return;
                    }
                    if (event.key === 'Enter' || event.key === 'Tab') {
                      event.preventDefault();
                      handleSelectHiddenUser(
                        visibleSuggestions[selectedNameIndex]
                      );
                      return;
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      closeNameMenu();
                      return;
                    }
                  }
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleAddUsers();
                  }
                }}
                helperText="Search names as you type, or add several with commas"
                inputProps={{
                  autoComplete: 'off',
                  'aria-autocomplete': 'list',
                  'aria-expanded': nameMenuOpen,
                  'aria-controls': nameMenuOpen
                    ? 'hidden-user-suggestions'
                    : undefined,
                }}
              />
            </Box>
            <Button
              variant="contained"
              onClick={handleAddUsers}
              disabled={!userInput.trim() || hiddenUsers.length >= MAX_HIDDEN_USERS}
            >
              Hide
            </Button>
          </WordRow>
          {nameMenuOpen ? (
            <MentionAutocomplete
              id="hidden-user-suggestions"
              query={nameQuery}
              suggestions={visibleSuggestions}
              followedNames={followedNames}
              selectedIndex={selectedNameIndex}
              isSearching={isSearching}
              top={nameMenuPosition.top}
              left={nameMenuPosition.left}
              title="Hide a user"
              listLabel="Username suggestions"
              onSelect={handleSelectHiddenUser}
              onHoverIndex={setSelectedNameIndex}
            />
          ) : null}
          {hiddenUsers.length > 0 ? (
            <WordList>
              {hiddenUsers.map((name) => (
                <Chip
                  key={name.toLowerCase()}
                  label={name}
                  onDelete={() =>
                    setHiddenUsers(removeHiddenUser(hiddenUsers, name))
                  }
                />
              ))}
            </WordList>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              No hidden users yet
            </Typography>
          )}
        </FilterBlock>
      </Section>

      {!isPublicNode ? (
        <Section>
          <SectionTitle>Safety</SectionTitle>
          <LinkRow
            type="button"
            onClick={onBlockedUsers}
            disabled={!auth?.name}
            aria-label="Blocked Users"
          >
            <SettingCopy>
              <Typography
                fontWeight={700}
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <BlockIcon fontSize="small" color="primary" />
                Blocked Users
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Review and unblock accounts you have blocked
              </Typography>
            </SettingCopy>
            <ArrowForwardIosIcon sx={{ fontSize: 16, opacity: 0.6 }} />
          </LinkRow>
        </Section>
      ) : null}

      <Section>
        <LinkRow
          type="button"
          onClick={() => setChangelogOpen(true)}
          aria-label={`Torq ${TORQ_VERSION}`}
        >
          <SettingCopy>
            <Typography fontWeight={700}>Torq {TORQ_VERSION}</Typography>
            <Typography variant="body2" color="text.secondary">
              Changelog
            </Typography>
          </SettingCopy>
          <ArrowForwardIosIcon sx={{ fontSize: 16, opacity: 0.6 }} />
        </LinkRow>
      </Section>
      <ChangelogDialog
        open={changelogOpen}
        onClose={() => setChangelogOpen(false)}
      />
    </PageContainer>
  );
}
