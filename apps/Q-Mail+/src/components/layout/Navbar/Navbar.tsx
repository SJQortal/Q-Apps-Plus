import React from 'react'
import {
  Box,
  Checkbox,
  Divider,
  FormControlLabel,
  IconButton,
  Popover,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material'
import { useSelector } from 'react-redux'
import { RootState } from '../../../state/store'
import { AppMenu } from '@qortal/qapp-lib/app-shell/react'
import type {
  AppShellController,
  AppShellState
} from '@qortal/qapp-lib/app-shell/core'
import { UserNavbar } from '../../common/UserNavbar/UserNavbar'
import { removePrefix } from '../../../utils/blogIdformats'
import { useLocation } from 'react-router-dom'
import { BlockedNamesModal } from '../../common/BlockedNamesModal/BlockedNamesModal'
import Logo from '../../../assets/svgs/Logo.svg'
import LogoLight from '../../../assets/svgs/LogoLight.svg'
import {
  readAutoApplyQdnState,
  writeAutoApplyQdnState
} from '../../../utils/qdnStatePreference'
import packageJson from '../../../../package.json'
import {
  CustomAppBar,
  CustomToolbar,
  DropdownContainer,
  DropdownText,
  QblogLogoContainer
} from './Navbar-styles'
import PersonOffIcon from '@mui/icons-material/PersonOff'
import MenuIcon from '@mui/icons-material/Menu'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { executeEvent, subscribeToEvent, unsubscribeFromEvent } from '../../../utils/events'
interface Props {
  isAuthenticated: boolean
  userName: string | null
  userAvatar: string
  accountNames: { name: string }[]
  setActiveName: (name: string) => void
  appShellController: AppShellController
  appShellState: AppShellState
}

const AppMenuCompat = AppMenu as unknown as React.ComponentType<any>

const NavBar: React.FC<Props> = ({
  isAuthenticated,
  userName,
  userAvatar,
  accountNames,
  setActiveName,
  appShellController,
  appShellState
}) => {
  const theme = useTheme()
  const isMobile = useMediaQuery('(max-width:950px)')
  const logoSrc = theme.palette.mode === 'light' ? LogoLight : Logo
  const appVersion = packageJson.version
  const userAddress = useSelector(
    (state: RootState) =>
      state.auth?.user?.address || state.auth?.user?.name || ''
  )
  const { visitingBlog } = useSelector((state: RootState) => state.global)
  const location = useLocation()
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null)
  const [isOpenModal, setIsOpenModal] = React.useState<boolean>(false)
  const [autoApplyQdnState, setAutoApplyQdnState] = React.useState<boolean>(
    () => readAutoApplyQdnState(userAddress)
  )
  const stripBlogId = removePrefix(visitingBlog?.blogId || '')

  React.useEffect(() => {
    setAutoApplyQdnState(readAutoApplyQdnState(userAddress))
  }, [userAddress])

  React.useEffect(() => {
    const onAuthenticate = () => {
      void appShellController.authenticate()
    }

    subscribeToEvent('qmail:authenticate', onAuthenticate)
    return () => {
      unsubscribeFromEvent('qmail:authenticate', onAuthenticate)
    }
  }, [appShellController])

  if (visitingBlog?.navbarConfig && location?.pathname?.includes(stripBlogId)) {
    return (
      <UserNavbar
        title={visitingBlog?.title || ''}
        menuItems={visitingBlog?.navbarConfig?.navItems || []}
        name={visitingBlog?.name || ''}
        blogId={visitingBlog?.blogId || ''}
      />
    )
  }

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleCloseUserDropdown = () => {
    setAnchorEl(null)
    appShellController.closeMenu()
  }
  const onClose = () => {
    setIsOpenModal(false)
  }

  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
    handleClick(event)
    appShellController.openMenu()
  }

  const handleSidebarAnchorClick = () => {
    executeEvent('qmail:left-sidebar-anchor-click', {})
  }

  const handleSidebarAnchorPointerEnter = () => {
    executeEvent('qmail:left-sidebar-anchor-pointer-enter', {})
  }

  const handleSidebarAnchorPointerLeave = () => {
    executeEvent('qmail:left-sidebar-anchor-pointer-leave', {})
  }

  const open = Boolean(anchorEl) && appShellState.ui.menuOpen
  const id = open ? 'simple-popover' : undefined

  return (
    <CustomAppBar position="sticky" elevation={2}>
      <CustomToolbar variant="dense">
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <IconButton
            className='qapp-lib-top-bar-icon qmail-sidebar-anchor-button'
            onClick={handleSidebarAnchorClick}
            onPointerEnter={handleSidebarAnchorPointerEnter}
            onPointerLeave={handleSidebarAnchorPointerLeave}
            aria-label={isMobile ? 'Open mailboxes' : 'Toggle sidebar mode'}
            disableRipple
            sx={{
              borderRadius: '14px',
              padding: isMobile ? '6px 10px' : '4px',
              margin: '-4px',
              gap: isMobile ? '10px' : 0,
              '&:hover': {
                background: 'var(--qmail-shell-hover)'
              }
            }}
          >
            <QblogLogoContainer
              style={{
                height: '54px'
              }}
              src={logoSrc}
              alt='Q-Mail Logo'
            />
            {isMobile && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  lineHeight: 1
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: 'var(--qmail-thread-text)'
                  }}
                >
                  Mailboxes
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.68rem',
                    opacity: 0.72,
                    color: 'var(--qmail-thread-text)'
                  }}
                >
                  Tap to open
                </Typography>
              </Box>
            )}
            {isMobile && (
              <MenuIcon
                sx={{
                  color: 'var(--qmail-thread-text)',
                  fontSize: '1.1rem'
                }}
              />
            )}
          </IconButton>
          <Typography
            sx={{
              display: isMobile ? 'none' : 'block',
              fontSize: '1rem',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              color: 'var(--qmail-thread-text)'
            }}
          >
            v{appVersion}
          </Typography>
          <Tooltip title='Changelog'>
            <IconButton
              className='qapp-shell-icon-button qapp-shell-info-button'
              onClick={() => {
                executeEvent('qmail:toggle-changelog', {})
              }}
              aria-label='Changelog'
              sx={{
                color: theme.palette.text.primary,
                borderRadius: '8px',
                border: '1px solid var(--qmail-compose-button-border)',
                background: 'var(--qmail-compose-button-bg)',
                '&:hover': {
                  background: 'var(--qmail-compose-button-hover-bg)',
                  borderColor: 'var(--qmail-shell-border)',
                },
              }}
            >
              <InfoOutlinedIcon fontSize='small' />
            </IconButton>
          </Tooltip>
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '6px' : 0
          }}
        >
          <IconButton
            className='qapp-shell-icon-button qapp-shell-menu-button'
            onClick={handleOpenUserMenu}
            aria-label='Menu'
            title='Menu'
            sx={{ color: theme.palette.text.primary }}
          >
            <MenuIcon />
          </IconButton>
          <Popover
            id={id}
            open={open}
            anchorEl={anchorEl}
            onClose={handleCloseUserDropdown}
            PaperProps={{
              sx: {
                minWidth: '280px',
                backgroundColor: 'var(--qmail-shell-popover-bg)',
                border: '1px solid var(--qmail-shell-border)',
                color: 'var(--qmail-thread-text)'
              }
            }}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'left'
            }}
          >
            <Box className='qmail-user-menu-content'>
              <Box
                sx={{
                  borderTop: 'none'
                }}
              >
                <AppMenuCompat
                  state={appShellState}
                  controller={appShellController}
                  sections={['auth', 'settings', 'rating']}
                  labels={{
                    authSectionTitle: 'Authentication',
                    authenticateButton: 'Authenticate',
                    authenticatingButton: 'Authenticating',
                    settingsSectionTitle: 'Settings',
                    textSizeLabel: 'Text size',
                    themeModeLabel: 'Theme mode',
                    authOnStartupLabel: 'Authenticate on startup',
                    ratingSectionTitle: 'Rate this app',
                    ratingNoRatingsLabel: 'No ratings yet',
                    ratingRefreshButton: 'Refresh'
                  }}
                />
              </Box>
              {isAuthenticated && userAddress && (
                <>
                  <Divider />
                  <Box
                    sx={{
                      p: 2,
                      display: 'grid',
                      gap: 1
                    }}
                  >
                    <Typography variant="subtitle2">
                      QDN State
                    </Typography>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={autoApplyQdnState}
                          onChange={event => {
                            const checked = event.target.checked
                            setAutoApplyQdnState(checked)
                            writeAutoApplyQdnState(userAddress, checked)
                          }}
                        />
                      }
                      label="Always fetch and apply QDN state"
                    />
                  </Box>
                </>
              )}
              {isAuthenticated && (
                <Box
                  sx={{
                    borderTop: `1px solid ${theme.palette.divider}`
                  }}
                >
                  <DropdownContainer
                    onClick={() => {
                      setIsOpenModal(true)
                      handleCloseUserDropdown()
                    }}
                  >
                    <PersonOffIcon
                      sx={{
                        color: 'var(--qmail-danger-text)'
                      }}
                    />
                    <DropdownText>Blocked Names</DropdownText>
                  </DropdownContainer>
                </Box>
              )}
            </Box>
          </Popover>
          {isOpenModal && (
            <BlockedNamesModal open={isOpenModal} onClose={onClose} />
          )}
        </Box>
      </CustomToolbar>
    </CustomAppBar>
  )
}

export default NavBar
