import { styled } from '@mui/system';
import { accentWash, primarySoft } from '../styles/theme/theme';
import HomeIcon from '@mui/icons-material/Home';
import ExploreIcon from '@mui/icons-material/Explore';
import PersonIcon from '@mui/icons-material/Person';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SettingsIcon from '@mui/icons-material/Settings';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import GroupsIcon from '@mui/icons-material/Groups';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { Badge, Typography } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { NameSwitcher } from './NameSwitcher';
import { WhatsHappening } from './WhatsHappening';
import { NotificationsPreview } from './NotificationsPreview';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  nameSwitcherOnHomeAtom,
  rightPanelNotificationsEnabledAtom,
  subscriptionsEnabledAtom,
  trendingEnabledAtom,
} from '../state/global/settings';
import {
  hasUnreadNotificationsAtom,
  hubNotificationSupportedAtom,
  notificationPermissionAtom,
  declinedNotificationPermissionAtom,
} from '../state/global/notifications';
import { useGlobal } from 'qapp-core';
import { useEffect, useRef, useState } from 'react';
import { usePhoneLayout } from '../hooks/usePhoneLayout';
import { setLastViewedNotificationsTimestamp } from '../utils/notificationTimestamp';
import { QortalAvatar } from './QortalAvatar';

const SidebarContainer = styled('div')(({ theme }) => ({
  width: '290px',
  height: '100%',
  padding: theme.spacing(2),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  overflowY: 'auto',
  scrollBehavior: 'smooth',
  // Hide scrollbar on small screens for cleaner look
  [theme.breakpoints.down('md')]: {
    width: '68px',
    '&::-webkit-scrollbar': {
      width: '4px',
    },
  },
}));

const Spacer = styled('div')(({ theme }) => ({
  flex: 1,
  minHeight: theme.spacing(2),
}));

const NavButton = styled('button')<{ active?: boolean; disabled?: boolean }>(
  ({ theme, active, disabled }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(1.5, 2.5),
    borderRadius: theme.torq?.id === 'hub30' ? 10 : 28,
    border: 'none',
    backgroundColor: active ? primarySoft(theme) : 'transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '20px',
    fontWeight: active ? 700 : 400,
    color: active ? theme.palette.primary.main : theme.palette.text.primary,
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    position: 'relative',
    overflow: 'hidden',
    '&::before': {
      content: '""',
      position: 'absolute',
      left: 0,
      top: '50%',
      transform: 'translateY(-50%)',
      width: active ? '4px' : '0',
      height: '60%',
      backgroundColor: theme.palette.primary.main,
      borderRadius: '0 4px 4px 0',
      transition: 'width 0.3s ease',
    },
    '&:hover': disabled
      ? {}
      : {
          backgroundColor: primarySoft(theme),
          transform: 'translateX(4px)',
          '& svg, & .MuiAvatar-root': {
            transform: 'scale(1.1)',
          },
        },
    '& svg, & .MuiAvatar-root': {
      transition: 'transform 0.2s ease',
    },
    [theme.breakpoints.down('md')]: {
      width: '52px',
      height: '52px',
      justifyContent: 'center',
      padding: theme.spacing(1.5),
    },
  })
);

const NavLabel = styled('span')(({ theme }) => ({
  [theme.breakpoints.down('md')]: {
    display: 'none',
  },
}));

const NavAvatar = styled(QortalAvatar)({
  width: 26,
  height: 26,
  fontSize: '0.8rem',
});

const NarrowOnlyNavButton = styled(NavButton)({
  '@media (min-width: 1301px)': {
    display: 'none',
  },
});

const ProfileCluster = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  gap: theme.spacing(0.5),
  [theme.breakpoints.down('md')]: {
    flexDirection: 'column',
    width: 'auto',
    gap: theme.spacing(1),
  },
}));

const ProfileNavButton = styled(NavButton)({
  flex: 1,
  minWidth: 0,
});

const ProfileNotifyButton = styled(NavButton)(({ theme }) => ({
  flexShrink: 0,
  padding: theme.spacing(1.5),
  [theme.breakpoints.down('md')]: {
    width: '52px',
    height: '52px',
  },
}));

const NotificationsPanel = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
  minHeight: 64,
  maxHeight: 'calc(var(--torq-app-height) - 32px)',
  marginBottom: theme.spacing(2),
  borderRadius: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
  boxShadow:
    theme.palette.mode === 'dark'
      ? '0 2px 8px rgba(0, 0, 0, 0.3)'
      : '0 2px 8px rgba(0, 0, 0, 0.06)',
  overflow: 'hidden',
}));

const NotificationsCard = styled('button', {
  shouldForwardProp: (prop) => prop !== '$active' && prop !== '$open',
})<{
  $active?: boolean;
  $open?: boolean;
  disabled?: boolean;
}>(({ theme, $active, $open, disabled }) => ({
  appearance: 'none',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(1.5),
  padding: theme.spacing(2),
  minHeight: 64,
  flexShrink: 0,
  border: 'none',
  borderBottom: $open ? `1px solid ${theme.palette.divider}` : 'none',
  backgroundColor:
    $active || $open ? accentWash(theme, 0.1) : 'transparent',
  color: theme.palette.text.primary,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
  textAlign: 'left',
  transition: 'background-color 0.15s ease',
  '&:hover': disabled
    ? {}
    : {
        backgroundColor: accentWash(theme, 0.1),
      },
}));

const NotificationsCardMeta = styled('span')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.75),
  flexShrink: 0,
}));

const PreviewChevron = styled(KeyboardArrowDownIcon, {
  shouldForwardProp: (prop) => prop !== '$open',
})<{ $open?: boolean }>(({ $open }) => ({
  fontSize: 22,
  transition: 'transform 0.2s ease',
  transform: $open ? 'rotate(180deg)' : 'rotate(0deg)',
}));

const TweetButton = styled('button')<{ disabled?: boolean }>(
  ({ theme, disabled }) => ({
    background: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    border: 'none',
    borderRadius: theme.torq?.id === 'hub30' ? 8 : 28,
    padding: theme.spacing(2),
    fontWeight: 700,
    fontSize: '17px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    marginTop: theme.spacing(2),
    transition: 'all 0.2s ease',
    opacity: disabled ? 0.5 : 1,
    boxShadow:
      theme.palette.mode === 'dark'
        ? '0 1px 3px rgba(0, 0, 0, 0.3)'
        : '0 1px 3px rgba(0, 0, 0, 0.12)',
    '&:hover': disabled
      ? {}
      : {
          background: theme.palette.primary.dark,
          boxShadow:
            theme.palette.mode === 'dark'
              ? '0 2px 6px rgba(0, 0, 0, 0.4)'
              : '0 2px 6px rgba(0, 0, 0, 0.15)',
        },
    '&:active': disabled
      ? {}
      : {
          transform: 'scale(0.98)',
        },
    [theme.breakpoints.down('md')]: {
      width: '52px',
      height: '52px',
      borderRadius: '50%',
      padding: 0,
      fontSize: '24px',
    },
  })
);

const TweetButtonText = styled('span')(({ theme }) => ({
  [theme.breakpoints.down('md')]: {
    display: 'none',
  },
}));

const TweetButtonIcon = styled('span')(({ theme }) => ({
  display: 'none',
  [theme.breakpoints.down('md')]: {
    display: 'block',
  },
}));

const EnableNotificationsCard = styled('button')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  padding: theme.spacing(1.5, 2),
  borderRadius: '16px',
  border: `1px solid ${accentWash(theme, 0.32)}`,
  background: `linear-gradient(135deg, ${accentWash(theme, 0.08)} 0%, ${accentWash(theme, 0.03)} 100%)`,
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  transition: 'all 0.25s ease',
  '&:hover': {
    borderColor: theme.palette.primary.main,
    background: `linear-gradient(135deg, ${accentWash(theme, 0.16)} 0%, ${accentWash(theme, 0.07)} 100%)`,
    transform: 'translateY(-1px)',
    boxShadow: `0 4px 16px ${accentWash(theme, 0.18)}`,
  },
  '&:active': {
    transform: 'scale(0.98)',
  },
  [theme.breakpoints.down('md')]: {
    width: '52px',
    height: '52px',
    justifyContent: 'center',
    padding: theme.spacing(1.5),
    borderRadius: '50%',
  },
}));

const EnableNotificationsIconWrap = styled('span')(() => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  '@keyframes bellRing': {
    '0%, 100%': { transform: 'rotate(0deg)' },
    '15%': { transform: 'rotate(15deg)' },
    '30%': { transform: 'rotate(-12deg)' },
    '45%': { transform: 'rotate(10deg)' },
    '60%': { transform: 'rotate(-8deg)' },
    '75%': { transform: 'rotate(5deg)' },
  },
  '& svg': {
    color: 'var(--torq-accent, #1d9bf0)',
    fontSize: '22px',
    animation: 'bellRing 3s ease-in-out infinite',
  },
}));

const EnableNotificationsText = styled('span')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: '1px',
  [theme.breakpoints.down('md')]: {
    display: 'none',
  },
}));

const EnableNotificationsTitle = styled('span')(({ theme }) => ({
  fontSize: '14px',
  fontWeight: 600,
  color: theme.palette.primary.main,
  lineHeight: 1.3,
}));

const EnableNotificationsSubtitle = styled('span')(({ theme }) => ({
  fontSize: '11px',
  fontWeight: 400,
  color: theme.palette.text.secondary,
  lineHeight: 1.3,
}));

interface SidebarProps {
  onNavigate?: (page: string) => void;
  onTweet?: () => void;
  onSearch?: (query: string) => void;
  onTrendClick?: (trend: string) => void;
  onFollow?: (userId: string) => void;
  activePage?: string;
}

declare const qortalRequest: (params: any) => Promise<any>;

export function Sidebar({
  onNavigate = () => {},
  onTweet = () => {},
  activePage = 'home',
}: SidebarProps) {
  const { auth } = useGlobal();
  const phone = usePhoneLayout();
  const subscriptionsEnabled = useAtomValue(subscriptionsEnabledAtom);
  const nameSwitcherOnHome = useAtomValue(nameSwitcherOnHomeAtom);
  const [hasUnread, setHasUnread] = useAtom(hasUnreadNotificationsAtom);
  const rightPanelNotificationsEnabled = useAtomValue(
    rightPanelNotificationsEnabledAtom
  );
  const notificationsOnProfile = !rightPanelNotificationsEnabled;
  const hubSupported = useAtomValue(hubNotificationSupportedAtom);
  const notificationPermission = useAtomValue(notificationPermissionAtom);
  const setNotificationPermission = useSetAtom(notificationPermissionAtom);
  const [, setDeclinedMap] = useAtom(declinedNotificationPermissionAtom);

  const address = auth?.address;
  const showEnableNotifications =
    hubSupported && notificationPermission === false && !!address;

  const handleEnableHubNotifications = async () => {
    if (!address) return;
    try {
      const result = await qortalRequest({ action: 'NOTIFICATION_PERMISSION' });
      if (result) {
        setNotificationPermission(true);
        setDeclinedMap((prev) => {
          const next = { ...prev };
          delete next[address];
          return next;
        });
      }
    } catch (error) {
      console.error('Notification permission declined or errored:', error);
    }
  };

  const handleNotificationsClick = () => {
    if (!auth?.name) return; // Don't navigate if no auth.name
    // Update last viewed timestamp when clicking notifications
    setLastViewedNotificationsTimestamp(auth.name);
    setHasUnread(false);
    onNavigate('notifications');
  };

  const handleProfileClick = () => {
    if (!auth?.name) return; // Don't navigate if no auth.name
    onNavigate('profile');
  };

  const handleTweetClick = () => {
    if (!auth?.name) return; // Don't open modal if no auth.name
    onTweet();
  };

  return (
    <SidebarContainer>
      <NavButton
        active={activePage === 'home'}
        onClick={() => onNavigate('home')}
      >
        <HomeIcon />
        <NavLabel>Home</NavLabel>
      </NavButton>
      {notificationsOnProfile ? (
        <ProfileCluster>
          <ProfileNavButton
            active={activePage === 'profile'}
            onClick={handleProfileClick}
            disabled={!auth?.name}
          >
            <Badge
              color="primary"
              variant="dot"
              invisible={!hasUnread}
              sx={{
                '& .MuiBadge-dot': {
                  backgroundColor: 'primary.main',
                  boxShadow: '0 0 0 2px rgba(0, 0, 0, 0.1)',
                },
              }}
            >
              <NavAvatar name={auth?.name} alt="" aria-hidden>
                {auth?.name?.[0]?.toUpperCase() || <PersonIcon fontSize="small" />}
              </NavAvatar>
            </Badge>
            <NavLabel>Profile</NavLabel>
          </ProfileNavButton>
          <ProfileNotifyButton
            type="button"
            active={activePage === 'notifications'}
            onClick={handleNotificationsClick}
            disabled={!auth?.name}
            aria-label="Notifications"
            data-testid="profile-notifications"
          >
            <Badge
              color="primary"
              variant="dot"
              invisible={!hasUnread}
              sx={{
                '& .MuiBadge-dot': {
                  backgroundColor: 'primary.main',
                  boxShadow: '0 0 0 2px rgba(0, 0, 0, 0.1)',
                },
              }}
            >
              <NotificationsIcon
                sx={{
                  color: hasUnread ? 'primary.main' : 'inherit',
                  transition: 'color 0.2s ease',
                }}
              />
            </Badge>
          </ProfileNotifyButton>
        </ProfileCluster>
      ) : (
        <>
          <NavButton
            active={activePage === 'profile'}
            onClick={handleProfileClick}
            disabled={!auth?.name}
          >
            <NavAvatar name={auth?.name} alt="" aria-hidden>
              {auth?.name?.[0]?.toUpperCase() || <PersonIcon fontSize="small" />}
            </NavAvatar>
            <NavLabel>Profile</NavLabel>
          </NavButton>
          <NarrowOnlyNavButton
            active={activePage === 'notifications'}
            onClick={handleNotificationsClick}
            disabled={!auth?.name}
          >
            <Badge
              color="primary"
              variant="dot"
              invisible={!hasUnread}
              sx={{
                '& .MuiBadge-dot': {
                  backgroundColor: 'primary.main',
                  boxShadow: '0 0 0 2px rgba(0, 0, 0, 0.1)',
                },
              }}
            >
              <NotificationsIcon
                sx={{
                  color: hasUnread ? 'primary.main' : 'inherit',
                  transition: 'color 0.2s ease',
                }}
              />
            </Badge>
            <NavLabel>Notifications</NavLabel>
          </NarrowOnlyNavButton>
        </>
      )}
      <NavButton
        active={activePage === 'bookmarks'}
        onClick={() => onNavigate('bookmarks')}
        disabled={!auth?.name}
      >
        <BookmarkIcon />
        <NavLabel>Bookmarks</NavLabel>
      </NavButton>
      <NavButton
        active={activePage === 'settings'}
        onClick={() => onNavigate('settings')}
      >
        <SettingsIcon />
        <NavLabel>Settings</NavLabel>
      </NavButton>
      {subscriptionsEnabled && (
        <NavButton
          active={activePage === 'groups'}
          onClick={() => onNavigate('groups')}
          disabled={!auth?.name}
        >
          <GroupsIcon />
          <NavLabel>Subscriptions</NavLabel>
        </NavButton>
      )}

      <TweetButton onClick={handleTweetClick} disabled={!auth?.name}>
        <TweetButtonText>Post</TweetButtonText>
        <TweetButtonIcon>+</TweetButtonIcon>
      </TweetButton>
      <NavButton
        active={activePage === 'search'}
        onClick={() => onNavigate('search')}
      >
        <ExploreIcon />
        <NavLabel>Discover</NavLabel>
      </NavButton>

      {showEnableNotifications && (
        <EnableNotificationsCard onClick={handleEnableHubNotifications}>
          <EnableNotificationsIconWrap>
            <NotificationsActiveIcon />
          </EnableNotificationsIconWrap>
          <EnableNotificationsText>
            <EnableNotificationsTitle>
              Enable Hub notifications
            </EnableNotificationsTitle>
            <EnableNotificationsSubtitle>
              Get notified about mentions &amp; replies
            </EnableNotificationsSubtitle>
          </EnableNotificationsText>
        </EnableNotificationsCard>
      )}

      <Spacer />

      {/* The left panel is hidden on phones, which keep the switcher in Settings. */}
      {nameSwitcherOnHome && !phone ? <NameSwitcher /> : null}
    </SidebarContainer>
  );
}

export function RightSidebar({
  onTrendClick = () => {},
  onNavigate = () => {},
  onUserClick,
  onPostClick,
  activePage,
}: {
  onTrendClick?: (trend: string) => void;
  onNavigate?: (page: string) => void;
  onUserClick?: (userName: string) => void;
  onPostClick?: (postId: string, postName: string) => void;
  activePage?: string;
}) {
  const { auth } = useGlobal();
  const trendingEnabled = useAtomValue(trendingEnabledAtom);
  const rightPanelNotificationsEnabled = useAtomValue(
    rightPanelNotificationsEnabledAtom
  );
  const hasUnread = useAtomValue(hasUnreadNotificationsAtom);
  const setHasUnread = useSetAtom(hasUnreadNotificationsAtom);
  const [previewOpen, setPreviewOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const usesPreview = !trendingEnabled;

  useEffect(() => {
    if (!usesPreview) setPreviewOpen(false);
  }, [usesPreview]);

  useEffect(() => {
    if (!previewOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        setPreviewOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [previewOpen]);

  const markNotificationsViewed = () => {
    if (!auth?.name) return;
    setLastViewedNotificationsTimestamp(auth.name);
    setHasUnread(false);
  };

  const openFullNotifications = () => {
    markNotificationsViewed();
    setPreviewOpen(false);
    onNavigate('notifications');
  };

  const handleNotificationsClick = () => {
    if (!auth?.name) return;
    markNotificationsViewed();
    if (usesPreview) {
      setPreviewOpen((open) => !open);
      return;
    }
    onNavigate('notifications');
  };

  if (!trendingEnabled && !rightPanelNotificationsEnabled) {
    return null;
  }

  return (
    <SidebarContainer>
      {rightPanelNotificationsEnabled ? (
      <NotificationsPanel ref={panelRef}>
        <NotificationsCard
          type="button"
          $active={activePage === 'notifications'}
          $open={previewOpen}
          disabled={!auth?.name}
          onClick={handleNotificationsClick}
          aria-label="Notifications"
          aria-expanded={usesPreview ? previewOpen : undefined}
          aria-haspopup={usesPreview ? true : undefined}
        >
          <Typography
            fontWeight={700}
            sx={{
              fontSize: 20,
              lineHeight: 1.2,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            Notifications
          </Typography>
          <NotificationsCardMeta>
            <Badge
              color="primary"
              variant="dot"
              invisible={!hasUnread}
              sx={{
                '& .MuiBadge-dot': {
                  backgroundColor: 'primary.main',
                  boxShadow: '0 0 0 2px rgba(0, 0, 0, 0.1)',
                },
              }}
            >
              <NotificationsIcon
                sx={{
                  color: hasUnread ? 'primary.main' : 'inherit',
                  flexShrink: 0,
                  fontSize: 24,
                }}
              />
            </Badge>
            {usesPreview ? <PreviewChevron $open={previewOpen} /> : null}
          </NotificationsCardMeta>
        </NotificationsCard>
        {usesPreview && previewOpen ? (
          <NotificationsPreview
            onSeeAll={openFullNotifications}
            onUserClick={onUserClick}
            onPostClick={onPostClick}
            onItemOpen={() => setPreviewOpen(false)}
          />
        ) : null}
      </NotificationsPanel>
      ) : null}
      {trendingEnabled ? <WhatsHappening onTrendClick={onTrendClick} /> : null}

      {/* <WhoToFollowContainer>
        <WhoToFollowHeader>Who to follow</WhoToFollowHeader>
        {suggestedUsers.map((user) => (
          <FollowUserItem key={user.id}>
            <UserInfo>
              <UserAvatar>{user.name[0]}</UserAvatar>
              <UserDetails>
                <UserNameRow>
                  <Typography
                    variant="body1"
                    fontWeight={700}
                    sx={{ fontSize: '15px' }}
                  >
                    {user.name}
                  </Typography>
                  {user.verified && (
                    <VerifiedIcon sx={{ fontSize: '18px', color: 'primary.main' }} />
                  )}
                </UserNameRow>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontSize: '15px' }}
                >
                  @{user.username}
                </Typography>
              </UserDetails>
            </UserInfo>
            <FollowButton onClick={() => onFollow(user.id)}>
              Follow
            </FollowButton>
          </FollowUserItem>
        ))}
      </WhoToFollowContainer> */}
    </SidebarContainer>
  );
}
