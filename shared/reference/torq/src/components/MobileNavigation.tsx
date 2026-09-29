import { styled } from '@mui/system';
import { headerFill, primarySoft } from '../styles/theme/theme';
import { alpha } from '@mui/material/styles';
import { Badge, IconButton, Drawer, Box } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import ExploreIcon from '@mui/icons-material/Explore';
import PersonIcon from '@mui/icons-material/Person';
import NotificationsIcon from '@mui/icons-material/Notifications';
import MenuIcon from '@mui/icons-material/Menu';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import SettingsIcon from '@mui/icons-material/Settings';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import GroupsIcon from '@mui/icons-material/Groups';
import { useState } from 'react';
import { useHideBackDuringReply } from '../hooks/useHideBackDuringReply';
import { useAtomValue } from 'jotai';
import { hasUnreadNotificationsAtom } from '../state/global/notifications';
import { subscriptionsEnabledAtom } from '../state/global/settings';
import { useGlobal } from 'qapp-core';
import { NameSwitcher } from './NameSwitcher';
import { QortalAvatar } from './QortalAvatar';

const MobileBottomNav = styled('div', {
  shouldForwardProp: (prop) => prop !== '$visible',
})<{ $visible?: boolean }>(({ theme, $visible = true }) => ({
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  minHeight: '60px',
  height: 'calc(var(--torq-mobile-nav-height) + var(--torq-safe-bottom))',
  paddingBottom: 'var(--torq-safe-bottom)',
  backgroundColor: headerFill(theme, 'chromeStrong'),
  backdropFilter: 'blur(20px)',
  borderTop: `1px solid ${theme.palette.divider}`,
  display: 'none',
  alignItems: 'center',
  justifyContent: 'space-around',
  zIndex: 1000,
  boxShadow:
    theme.palette.mode === 'dark'
      ? '0 -2px 10px rgba(0, 0, 0, 0.3)'
      : '0 -2px 10px rgba(0, 0, 0, 0.1)',
  transform: $visible ? 'translateY(0)' : 'translateY(110%)',
  transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
  pointerEvents: $visible ? 'auto' : 'none',
  willChange: 'transform',
  '@media (max-width: 1000px)': {
    display: 'flex',
  },
}));

const NavIconButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== 'active',
})<{ active?: boolean }>(({ theme, active }) => ({
  color: active ? theme.palette.primary.main : theme.palette.text.primary,
  padding: theme.spacing(1.5),
  '&:hover': {
    backgroundColor: primarySoft(theme),
  },
  '& .MuiSvgIcon-root': {
    fontSize: '28px',
  },
}));

const FloatingPostButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== '$visible' && prop !== '$park',
})<{ $visible?: boolean; $park?: 'away' | 'lower' }>(({
  theme,
  $visible = true,
  $park = 'away',
}) => {
  const away = 'translateY(calc(100% + 96px + var(--torq-safe-bottom)))';
  const lower = 'translateY(var(--torq-mobile-nav-height))';
  const parked = $park === 'lower' ? lower : away;
  const hoverParked =
    $park === 'lower'
      ? 'translateY(calc(var(--torq-mobile-nav-height) - 2px))'
      : away;
  const activeParked =
    $park === 'lower'
      ? 'translateY(calc(var(--torq-mobile-nav-height) + 1px))'
      : away;
  return {
    position: 'fixed',
    bottom: 'calc(80px + var(--torq-safe-bottom))',
    right: theme.spacing(2),
    width: '56px',
    height: '56px',
    backgroundColor: alpha(theme.palette.primary.main, 0.55),
    color: theme.palette.primary.contrastText,
    boxShadow: `0 2px 10px ${alpha(theme.palette.primary.main, 0.22)}`,
    zIndex: 1000,
    display: 'none',
    transform: $visible ? 'translateY(0)' : parked,
    opacity: 1,
    pointerEvents: $visible || $park === 'lower' ? 'auto' : 'none',
    transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
    willChange: 'transform',
    '&:hover': {
      backgroundColor: alpha(theme.palette.primary.main, 0.78),
      transform: $visible ? 'translateY(-2px)' : hoverParked,
    },
    '&:active': {
      backgroundColor: alpha(theme.palette.primary.main, 0.9),
      transform: $visible ? 'translateY(1px)' : activeParked,
    },
    '@media (max-width: 1000px)': {
      display: 'flex',
    },
  };
});

const DrawerHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  backgroundColor: headerFill(theme, 'chromeStrong'),
}));

const DrawerContent = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  height: '100%',
  overflow: 'auto', // Allow scrolling for content
  backgroundColor: theme.palette.background.default,
}));

const MenuButton = styled('button', {
  shouldForwardProp: (prop) => prop !== 'active',
})<{ active?: boolean }>(({ theme, active }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  padding: theme.spacing(1.5, 2),
  borderRadius: '12px',
  border: 'none',
  backgroundColor: active ? primarySoft(theme) : 'transparent',
  cursor: 'pointer',
  fontSize: '18px',
  fontWeight: active ? 600 : 400,
  color: active ? theme.palette.primary.main : theme.palette.text.primary,
  transition: 'all 0.2s ease',
  width: '100%',
  textAlign: 'left',
  '&:hover': {
    backgroundColor: primarySoft(theme),
  },
  '&:disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
}));

const Divider = styled('div')(({ theme }) => ({
  height: '1px',
  backgroundColor: theme.palette.divider,
  margin: theme.spacing(1, 0),
}));

interface MobileNavigationProps {
  activePage?: string;
  onNavigate: (page: string) => void;
  onTweet: () => void;
  visible?: boolean;
  showFloatingButton?: boolean; // Control whether to show the floating post button
  showBackButton?: boolean;
  onBack?: () => void;
}

export function MobileNavigation({
  activePage = 'home',
  onNavigate,
  onTweet,
  visible = true,
  showFloatingButton = true,
  showBackButton = false,
  onBack = () => {},
}: MobileNavigationProps) {
  const { auth } = useGlobal();
  const subscriptionsEnabled = useAtomValue(subscriptionsEnabledAtom);
  const hasUnread = useAtomValue(hasUnreadNotificationsAtom);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hideBackDuringReply = useHideBackDuringReply();

  const handleNavClick = (page: string) => {
    if (
      page === 'profile' ||
      page === 'notifications' ||
      page === 'bookmarks' ||
      (subscriptionsEnabled && page === 'groups')
    ) {
      if (!auth?.name) return;
    }
    onNavigate(page);
  };

  const handleTweetClick = () => {
    if (!auth?.name) return;
    onTweet();
  };

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleMenuItemClick = (page: string) => {
    if (
      page === 'profile' ||
      page === 'notifications' ||
      page === 'bookmarks' ||
      (subscriptionsEnabled && page === 'groups')
    ) {
      if (!auth?.name) return;
    }
    onNavigate(page);
    setDrawerOpen(false);
  };

  return (
    <>
      {/* Bottom Navigation Bar */}
      <MobileBottomNav $visible={visible}>
        <NavIconButton
          active={activePage === 'home'}
          onClick={() => handleNavClick('home')}
          aria-label="Home"
        >
          <HomeIcon />
        </NavIconButton>

        <NavIconButton
          active={activePage === 'profile'}
          onClick={() => handleNavClick('profile')}
          disabled={!auth?.name}
          aria-label="Profile"
        >
          <QortalAvatar
            name={auth?.name}
            alt=""
            aria-hidden
            sx={{ width: 26, height: 26, fontSize: '0.8rem' }}
          >
            {auth?.name?.[0]?.toUpperCase() || <PersonIcon fontSize="small" />}
          </QortalAvatar>
        </NavIconButton>

        <NavIconButton
          active={activePage === 'notifications'}
          onClick={() => handleNavClick('notifications')}
          disabled={!auth?.name}
          aria-label="Notifications"
          data-torq-notification-bell=""
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
        </NavIconButton>

        <NavIconButton
          active={activePage === 'search'}
          onClick={() => handleNavClick('search')}
          aria-label="Discover"
        >
          <ExploreIcon />
        </NavIconButton>

        <NavIconButton onClick={handleDrawerToggle} aria-label="More options">
          <MenuIcon />
        </NavIconButton>
      </MobileBottomNav>

      {/* Floating Post Button - only show when showFloatingButton is true */}
      {showFloatingButton && (
        <FloatingPostButton
          $visible={visible}
          onClick={handleTweetClick}
          disabled={!auth?.name}
          aria-label="Create post"
        >
          <AddIcon />
        </FloatingPostButton>
      )}
      {showBackButton && !hideBackDuringReply && (
        <FloatingPostButton
          $visible={visible}
          $park="lower"
          onClick={onBack}
          aria-label="Back"
        >
          <ArrowBackIcon />
        </FloatingPostButton>
      )}

      {/* Side Drawer for Additional Options */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={handleDrawerToggle}
        sx={{
          '& .MuiDrawer-paper': {
            width: '85vw',
            maxWidth: '350px',
          },
        }}
      >
        <DrawerHeader>
          <Box sx={{ fontSize: '20px', fontWeight: 700 }}>Menu</Box>
          <IconButton onClick={handleDrawerToggle} aria-label="Close menu">
            <CloseIcon />
          </IconButton>
        </DrawerHeader>

        <DrawerContent>
          {/* Name Switcher */}
          <NameSwitcher />

          <Divider />

          {/* Additional Navigation Options */}
          <MenuButton
            active={activePage === 'bookmarks'}
            onClick={() => handleMenuItemClick('bookmarks')}
            disabled={!auth?.name}
          >
            <BookmarkIcon />
            Bookmarks
          </MenuButton>
          <MenuButton
            active={activePage === 'settings'}
            onClick={() => handleMenuItemClick('settings')}
          >
            <SettingsIcon />
            Settings
          </MenuButton>

          {subscriptionsEnabled && (
            <MenuButton
              active={activePage === 'groups'}
              onClick={() => handleMenuItemClick('groups')}
              disabled={!auth?.name}
            >
              <GroupsIcon />
              Subscriptions
            </MenuButton>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}
