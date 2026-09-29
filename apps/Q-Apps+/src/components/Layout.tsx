import type { ReactNode } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import AppsRounded from '@mui/icons-material/AppsRounded';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import { IconButton } from '@mui/material';
import { headerFill, primarySoft } from '../hub-theme';
import { usePhoneLayout } from '../hooks/usePhoneLayout';
import { useHideOnScroll } from '../hooks/useHideOnScroll';

export const RAIL_WIDTH_MD = 96;
export const RAIL_WIDTH_SM = 64;
export const BOTTOM_NAV_HEIGHT = 60;

const Shell = styled('div')({
  display: 'flex',
  minHeight: '100dvh',
  width: '100%',
});

const Rail = styled('nav')(({ theme }) => ({
  position: 'sticky',
  top: 0,
  alignSelf: 'flex-start',
  height: '100dvh',
  flexShrink: 0,
  width: RAIL_WIDTH_SM,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  padding: theme.spacing(1.5, 0.75),
  background: headerFill(theme),
  backdropFilter: 'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  borderRight: `1px solid ${theme.palette.divider}`,
  zIndex: 20,
  [theme.breakpoints.up('md')]: {
    width: RAIL_WIDTH_MD,
  },
  [theme.breakpoints.down('sm')]: {
    display: 'none',
  },
}));

const RailMark = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  marginBottom: theme.spacing(1.5),
  color: theme.palette.mode === 'dark' ? theme.palette.primary.main : theme.palette.primary.dark,
}));

const NavItem = styled(RouterLink, { shouldForwardProp: (prop) => prop !== '$active' })<{
  $active?: boolean;
}>(({ theme, $active }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  width: '100%',
  minHeight: 52,
  padding: theme.spacing(0.75, 0.5),
  borderRadius: theme.shape.borderRadius,
  textDecoration: 'none',
  color: $active ? theme.palette.primary.main : theme.palette.text.secondary,
  background: $active ? primarySoft(theme) : 'transparent',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.2,
  transition: 'background 150ms ease, color 150ms ease',
  '&:hover': {
    background: $active ? primarySoft(theme) : theme.palette.action.hover,
    color: $active ? theme.palette.primary.main : theme.palette.text.primary,
  },
  '& span': {
    display: 'none',
    [theme.breakpoints.up('md')]: { display: 'block' },
  },
}));

const BottomNav = styled('nav')(({ theme }) => ({
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  display: 'none',
  alignItems: 'stretch',
  justifyContent: 'space-around',
  height: `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  background: headerFill(theme, 'chromeStrong'),
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderTop: `1px solid ${theme.palette.divider}`,
  zIndex: 30,
  [theme.breakpoints.down('sm')]: {
    display: 'flex',
  },
}));

const BottomItem = styled(RouterLink, { shouldForwardProp: (prop) => prop !== '$active' })<{
  $active?: boolean;
}>(({ theme, $active }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  minWidth: 64,
  textDecoration: 'none',
  fontSize: 11,
  fontWeight: 600,
  color: $active ? theme.palette.primary.main : theme.palette.text.secondary,
  '&:hover': { color: $active ? theme.palette.primary.main : theme.palette.text.primary },
}));

const Main = styled('main')(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  [theme.breakpoints.down('sm')]: {
    paddingBottom: `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
  },
}));

const NAV = [
  { to: '/', label: 'Apps', icon: AppsRounded, match: (p: string) => p === '/' || p.startsWith('/app/') },
  { to: '/settings', label: 'Settings', icon: SettingsOutlined, match: (p: string) => p.startsWith('/settings') },
];

export function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <Shell>
      <Rail aria-label="Main">
        <RailMark>
          <AppsRounded sx={{ fontSize: 30 }} />
          <Typography sx={{ fontSize: 11, fontWeight: 700, display: { xs: 'none', md: 'block' } }}>
            Q-Apps+
          </Typography>
        </RailMark>
        {NAV.map((item) => (
          <NavItem key={item.to} to={item.to} $active={item.match(pathname)} aria-label={item.label}>
            <item.icon />
            <span>{item.label}</span>
          </NavItem>
        ))}
      </Rail>
      <Main>{children}</Main>
      <BottomNav aria-label="Main">
        {NAV.map((item) => (
          <BottomItem key={item.to} to={item.to} $active={item.match(pathname)} aria-label={item.label}>
            <item.icon />
            {item.label}
          </BottomItem>
        ))}
      </BottomNav>
    </Shell>
  );
}

/* ---- Page chrome ------------------------------------------------------- */

const HeaderBar = styled('header', { shouldForwardProp: (prop) => prop !== '$hidden' })<{ $hidden?: boolean }>(
  ({ theme, $hidden }) => ({
    position: 'sticky',
    top: 0,
    zIndex: 15,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    minHeight: 56,
    padding: `env(safe-area-inset-top, 0px) ${theme.spacing(2)} 0`,
    background: headerFill(theme),
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    borderBottom: `1px solid ${theme.palette.divider}`,
    transform: $hidden ? 'translateY(-100%)' : 'translateY(0)',
    transition: 'transform 200ms ease',
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  })
);

const HeaderTitle = styled('div')({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
});

const HeaderActions = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  flexShrink: 0,
}));

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  backTo?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, backTo, actions }: PageHeaderProps) {
  const phone = usePhoneLayout();
  const hidden = useHideOnScroll(phone);
  return (
    <HeaderBar $hidden={hidden}>
      {backTo && (
        <IconButton component={RouterLink} to={backTo} aria-label="Back" edge="start" size="small">
          <ArrowBackOutlined />
        </IconButton>
      )}
      <HeaderTitle>
        <Typography component="h1" variant="h6" noWrap sx={{ fontSize: 17, fontWeight: 700, lineHeight: 1.2 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary" noWrap>
            {subtitle}
          </Typography>
        )}
      </HeaderTitle>
      {actions && <HeaderActions>{actions}</HeaderActions>}
    </HeaderBar>
  );
}

export const Page = styled('div', { shouldForwardProp: (prop) => prop !== '$maxWidth' })<{ $maxWidth?: number }>(
  ({ theme, $maxWidth = 1100 }) => ({
    width: '100%',
    maxWidth: $maxWidth,
    margin: '0 auto',
    padding: theme.spacing(2, 2, 4),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(1.5, 2, 3),
    },
  })
);

export const SectionTitle = styled(Typography)(({ theme }) => ({
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.6,
  textTransform: 'uppercase',
  color: theme.palette.text.secondary,
}));

export const Section = styled('section')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
}));

export const Card = styled('div')(({ theme }) => ({
  background: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(2),
}));
