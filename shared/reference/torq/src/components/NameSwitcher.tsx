import { useState, useEffect } from 'react';
import { styled } from '@mui/system';
import {
  Typography,
  Menu,
  MenuItem,
  CircularProgress,
  Box,
  Chip,
  TextField,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import CheckIcon from '@mui/icons-material/Check';
import StarIcon from '@mui/icons-material/Star';
import { useGlobal, showError, showSuccess, useAuth } from 'qapp-core';
import { useNavigate } from 'react-router-dom';
import { useAtom, useSetAtom } from 'jotai';
import { preferredNamesMapAtom } from '../state/global/profile';
import {
  userNamesAtom,
  isLoadingUserNamesAtom,
} from '../state/global/userNames';
import { LIST_POSTS_FEED } from '../constants/qdn';
import { prefetchQortalAvatars } from '../utils/prefetchQortalAvatars';
import { QortalAvatar } from './QortalAvatar';

const NAME_SEARCH_MIN = 6;

const NameSwitcherContainer = styled('div', {
  shouldForwardProp: (prop) => prop !== '$settings',
})<{ $settings?: boolean }>(({ theme, $settings }) => ({
  padding: $settings ? 0 : theme.spacing(2),
  borderTop: $settings ? 'none' : `1px solid ${theme.palette.divider}`,
  width: $settings ? 'min(520px, 100%)' : 'auto',
  marginLeft: $settings ? 'auto' : undefined,
  marginRight: $settings ? 'auto' : undefined,
  '@media (min-width: 1001px)': {
    marginTop: $settings ? 0 : 'auto',
  },
}));

const NameSwitcherButton = styled('button')(({ theme }) => ({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(1),
  padding: theme.spacing(1.25, 1.5),
  minWidth: 0,
  borderRadius: '28px',
  border: 'none',
  backgroundColor:
    theme.palette.mode === 'dark'
      ? 'rgba(255, 255, 255, 0.08)'
      : 'rgba(0, 0, 0, 0.05)',
  cursor: 'pointer',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    backgroundColor:
      theme.palette.mode === 'dark'
        ? 'rgba(255, 255, 255, 0.12)'
        : 'rgba(0, 0, 0, 0.08)',
    transform: 'translateY(-2px)',
    boxShadow:
      theme.palette.mode === 'dark'
        ? '0 4px 12px rgba(0, 0, 0, 0.3)'
        : '0 4px 12px rgba(0, 0, 0, 0.1)',
  },
}));

const NameInfo = styled('div')({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  flex: 1,
  minWidth: 0,
});

const NameAvatar = styled('div')(({ theme }) => ({
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  background: 'transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.palette.text.secondary,
  fontSize: '18px',
  fontWeight: 700,
  flexShrink: 0,
  overflow: 'hidden',
}));

const NameDetails = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  minWidth: 0,
  flex: 1,
  overflow: 'hidden',
});

const CurrentName = styled(Typography)(({ theme }) => ({
  fontSize: 15,
  fontWeight: 700,
  lineHeight: 1.25,
  color: theme.palette.text.primary,
  textAlign: 'left',
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}));

const ArrowIcon = styled(KeyboardArrowUpIcon)({
  flexShrink: 0,
  transition: 'transform 0.2s ease',
});

const StyledMenuItem = styled(MenuItem)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(1.25, 2),
  minWidth: '280px',
  '&:hover': {
    backgroundColor:
      theme.palette.mode === 'dark'
        ? 'rgba(29, 155, 240, 0.15)'
        : 'rgba(29, 155, 240, 0.1)',
  },
}));

const MenuNameAvatar = styled(QortalAvatar, {
  shouldForwardProp: (prop) => prop !== '$solid',
})<{ $solid?: boolean }>(({ theme, $solid }) => ({
  width: 32,
  height: 32,
  flexShrink: 0,
  fontSize: 14,
  fontWeight: 700,
  backgroundColor: $solid ? theme.palette.background.paper : 'transparent',
}));

const PrimaryBadge = styled(Chip)(({ theme }) => ({
  height: '20px',
  fontSize: '11px',
  fontWeight: 600,
  borderRadius: '10px',
  backgroundColor:
    theme.palette.mode === 'dark'
      ? 'rgba(255, 193, 7, 0.2)'
      : 'rgba(255, 193, 7, 0.15)',
  color: theme.palette.mode === 'dark' ? '#ffc107' : '#f57c00',
  '& .MuiChip-icon': {
    fontSize: '14px',
    marginLeft: '4px',
    color: 'inherit',
  },
}));

export function NameSwitcher({
  variant = 'panel',
}: {
  variant?: 'panel' | 'settings';
} = {}) {
  const { auth, lists } = useGlobal();
  const { switchName } = useAuth();
  const navigate = useNavigate();

  const [preferredNamesMap, setPreferredNamesMap] = useAtom(
    preferredNamesMapAtom
  );
  const [names] = useAtom(userNamesAtom);
  const [isLoading] = useAtom(isLoadingUserNamesAtom);
  const setUserNames = useSetAtom(userNamesAtom);
  const setIsLoadingUserNames = useSetAtom(isLoadingUserNamesAtom);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [nameQuery, setNameQuery] = useState('');
  const menuOpen = Boolean(anchorEl);
  const settingsLayout = variant === 'settings';

  // Fetch names when component mounts or address changes
  useEffect(() => {
    const fetchNames = async () => {
      if (!auth?.address) {
        setUserNames([]);
        setIsLoadingUserNames(false);
        return;
      }

      setIsLoadingUserNames(true);
      try {
        const response = await fetch(`/names/address/${auth.address}`);
        if (!response.ok) {
          throw new Error('Failed to fetch names');
        }
        const data = await response.json();
        const fetchedNames = data?.map((item: any) => item?.name) || [];
        setUserNames(fetchedNames);
      } catch (error) {
        console.error('Error fetching names:', error);
        showError('Failed to load names');
        setUserNames([]);
      } finally {
        setIsLoadingUserNames(false);
      }
    };

    fetchNames();
  }, [auth?.address, setUserNames, setIsLoadingUserNames]);

  useEffect(() => {
    if (!auth?.name && names.length === 0) return;
    prefetchQortalAvatars(
      [auth?.name, ...names].filter((name): name is string => Boolean(name))
    );
  }, [auth?.name, names]);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setNameQuery('');
  };

  const handleNameSwitch = async (name: string) => {
    if (!switchName || name === auth?.name) {
      handleMenuClose();
      return;
    }

    setIsSwitching(true);
    try {
      await switchName(name);
      lists.deleteList(LIST_POSTS_FEED);
      // Save the preferred name for this address
      if (auth?.address) {
        setPreferredNamesMap({
          ...preferredNamesMap,
          [auth.address]: name,
        });
      }

      showSuccess(`Switched to ${name}`);
      handleMenuClose();

      // The profile check will happen automatically via useInitializeProfile
      // when auth.name changes. If the name has no profile, Layout will
      // show CreateProfile. If they have a profile, navigate to it.
      // Small delay to let the profile check start
      setTimeout(() => {
        navigate(`/user/${name}`);
      }, 100);
    } catch (error) {
      console.error('Error switching name:', error);
      showError('Failed to switch name');
    } finally {
      setIsSwitching(false);
    }
  };

  const handleAuthenticate = async () => {
    if (!auth) return;

    setIsSwitching(true);
    try {
      await auth.authenticateUser();
      lists.deleteList(LIST_POSTS_FEED);

      showSuccess('Authentication successful');
    } catch (error) {
      console.error('Authentication failed:', error);
      showError('Failed to authenticate');
    } finally {
      setIsSwitching(false);
    }
  };

  // If user is not authenticated, show Authenticate button
  const query = nameQuery.trim().toLowerCase();
  const visibleNames = query
    ? names.filter((name) => name.toLowerCase().includes(query))
    : names;
  const showNameSearch = names.length >= NAME_SEARCH_MIN;

  if (!auth?.address) {
    return (
      <NameSwitcherContainer $settings={settingsLayout}>
        <NameSwitcherButton
          onClick={handleAuthenticate}
          disabled={isSwitching || auth?.isLoadingUser}
        >
          <NameInfo>
            <NameAvatar>
              <PersonIcon sx={{ fontSize: '20px', color: 'inherit' }} />
            </NameAvatar>
            <NameDetails>
              <Typography
                variant="body1"
                fontWeight={700}
                sx={{
                  fontSize: '15px',
                  color: 'text.primary',
                  textAlign: 'left',
                }}
              >
                Authenticate
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontSize: '13px',
                  color: 'text.secondary',
                }}
              >
                {auth?.isLoadingUser ? 'Authenticating...' : 'Required to post'}
              </Typography>
            </NameDetails>
          </NameInfo>
          {isSwitching || auth?.isLoadingUser ? (
            <CircularProgress size={20} />
          ) : null}
        </NameSwitcherButton>
      </NameSwitcherContainer>
    );
  }

  // If user is authenticated but has no name, show message about needing a name
  if (!auth?.name) {
    return (
      <NameSwitcherContainer $settings={settingsLayout}>
        <NameSwitcherButton
          onClick={async () => {
            try {
              await qortalRequest({
                action: 'OPEN_NEW_TAB',
                qortalLink: 'qortal://APP/names',
              });
            } catch (error) {
              console.error('Error opening new tab:', error);
            }
          }}
        >
          <NameInfo>
            <NameAvatar
              sx={{
                flexShrink: 0,
              }}
            >
              <PersonIcon sx={{ fontSize: '20px', color: 'inherit' }} />
            </NameAvatar>
            <NameDetails>
              <Typography
                variant="body1"
                fontWeight={700}
                sx={{
                  fontSize: '15px',
                  color: 'text.primary',
                  textAlign: 'left',
                }}
              >
                No Name
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontSize: '13px',
                  color: 'text.secondary',
                  textAlign: 'left',
                }}
              >
                Qortal name required to post
              </Typography>
            </NameDetails>
          </NameInfo>
        </NameSwitcherButton>
      </NameSwitcherContainer>
    );
  }

  const currentName = auth.name;

  return (
    <NameSwitcherContainer $settings={settingsLayout}>
      <NameSwitcherButton onClick={handleMenuClick} disabled={isSwitching}>
        <NameInfo>
          <NameAvatar>
            <QortalAvatar
              name={currentName}
              alt={`${currentName} avatar`}
              transparentBackground={!settingsLayout}
              sx={{ width: 40, height: 40 }}
            >
              <PersonIcon sx={{ fontSize: '20px' }} />
            </QortalAvatar>
          </NameAvatar>
          <NameDetails>
            <CurrentName title={`@${currentName}`}>
              @{currentName}
            </CurrentName>
            <Typography
              variant="body2"
              sx={{
                fontSize: '13px',
                color: 'text.secondary',
              }}
            >
              {isLoading
                ? 'Loading...'
                : names.length > 1
                  ? `${names.length} names`
                  : 'Switch name'}
            </Typography>
          </NameDetails>
        </NameInfo>
        {isSwitching ? (
          <CircularProgress size={20} />
        ) : (
          <ArrowIcon
            sx={{
              transform: settingsLayout
                ? menuOpen
                  ? 'rotate(0deg)'
                  : 'rotate(180deg)'
                : menuOpen
                  ? 'rotate(180deg)'
                  : 'rotate(0deg)',
            }}
          />
        )}
      </NameSwitcherButton>

      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: settingsLayout ? 'bottom' : 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: settingsLayout ? 'top' : 'bottom',
          horizontal: 'center',
        }}
        slotProps={{
          paper: {
            sx: {
              borderRadius: '16px',
              maxHeight: settingsLayout ? 440 : 360,
              width: settingsLayout ? 'min(520px, calc(100vw - 32px))' : undefined,
              minWidth: settingsLayout ? 320 : undefined,
              overflowY: 'auto',
              boxShadow: (theme) =>
                theme.palette.mode === 'dark'
                  ? '0 8px 24px rgba(0, 0, 0, 0.4)'
                  : '0 8px 24px rgba(0, 0, 0, 0.15)',
              mt: settingsLayout ? 1 : -1,
            },
          },
        }}
      >
        {showNameSearch ? (
          <Box
            sx={{
              position: 'sticky',
              top: 0,
              zIndex: 1,
              px: 1.5,
              pt: 1.25,
              pb: 1,
              backgroundColor: 'background.paper',
            }}
          >
            <TextField
              autoFocus
              fullWidth
              size="small"
              placeholder="Search names"
              value={nameQuery}
              onChange={(event) => setNameQuery(event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
              inputProps={{ 'aria-label': 'Search names' }}
            />
          </Box>
        ) : null}
        {isLoading ? (
          <StyledMenuItem>
            <CircularProgress size={20} />
          </StyledMenuItem>
        ) : names.length === 0 ? (
          <StyledMenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              No names found
            </Typography>
          </StyledMenuItem>
        ) : visibleNames.length === 0 ? (
          <StyledMenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              No matching names
            </Typography>
          </StyledMenuItem>
        ) : (
          visibleNames.map((name) => {
            const isPrimary = name === auth?.primaryName;
            const isCurrent = name === currentName;

            return (
              <StyledMenuItem
                key={name}
                onClick={() => handleNameSwitch(name)}
                disabled={isSwitching}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <MenuNameAvatar
                    name={name}
                    alt={`${name} avatar`}
                    $solid={settingsLayout}
                    transparentBackground={!settingsLayout}
                    imgProps={{ loading: 'lazy' }}
                  >
                    {name[0]?.toUpperCase() || (
                      <PersonIcon sx={{ fontSize: 18 }} />
                    )}
                  </MenuNameAvatar>
                  <Typography
                    variant="body1"
                    fontWeight={isCurrent ? 700 : 400}
                    title={`@${name}`}
                    sx={{
                      fontSize: '15px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                    }}
                  >
                    @{name}
                  </Typography>
                  {isPrimary && (
                    <PrimaryBadge
                      icon={<StarIcon />}
                      label="Primary"
                      size="small"
                    />
                  )}
                </Box>
                {isCurrent && (
                  <CheckIcon sx={{ fontSize: '20px', color: 'primary.main' }} />
                )}
              </StyledMenuItem>
            );
          })
        )}
      </Menu>
    </NameSwitcherContainer>
  );
}
