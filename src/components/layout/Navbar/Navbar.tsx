import React from 'react'
import {
  Box,
  IconButton,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material'
import { useSelector } from 'react-redux'
import { RootState } from '../../../state/store'
import { UserNavbar } from '../../common/UserNavbar/UserNavbar'
import { removePrefix } from '../../../utils/blogIdformats'
import { useLocation, useNavigate } from 'react-router-dom'
import Logo from '../../../assets/svgs/Logo.svg'
import LogoLight from '../../../assets/svgs/LogoLight.svg'
import packageJson from '../../../../package.json'
import {
  CustomAppBar,
  CustomToolbar,
  QblogLogoContainer
} from './Navbar-styles'
import MenuIcon from '@mui/icons-material/Menu'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import { executeEvent } from '../../../utils/events'
import { SETTINGS_PATH } from '../../../pages/Settings/SettingsPage'

const NavBar: React.FC = () => {
  const theme = useTheme()
  const isMobile = useMediaQuery('(max-width:950px)')
  const logoSrc = theme.palette.mode === 'light' ? LogoLight : Logo
  const appVersion = packageJson.version
  const { visitingBlog } = useSelector((state: RootState) => state.global)
  const location = useLocation()
  const navigate = useNavigate()
  const stripBlogId = removePrefix(visitingBlog?.blogId || '')

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

  const openSettings = () => {
    if (location.pathname === SETTINGS_PATH) return
    navigate(SETTINGS_PATH, { state: { backgroundLocation: location } })
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
            sx={[{
              borderRadius: '14px',
              margin: '-4px',
              '&:hover': {
                background: 'var(--qmail-shell-hover)'
              }
            }, isMobile ? {
              padding: '6px 10px'
            } : {
              padding: '4px'
            }, isMobile ? {
              gap: '10px'
            } : {
              gap: 0
            }]}
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
            sx={[{
              fontSize: '1rem',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              color: 'var(--qmail-thread-text)'
            }, isMobile ? {
              display: 'none'
            } : {
              display: 'block'
            }]}
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
          sx={[{
            display: 'flex',
            alignItems: 'center'
          }, isMobile ? {
            gap: '6px'
          } : {
            gap: 0
          }]}
        >
          <Tooltip title='Settings'>
            <IconButton
              className='qapp-shell-icon-button qapp-shell-menu-button'
              onClick={openSettings}
              aria-label='Settings'
              sx={{ color: theme.palette.text.primary }}
            >
              <SettingsOutlinedIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </CustomToolbar>
    </CustomAppBar>
  );
}

export default NavBar
