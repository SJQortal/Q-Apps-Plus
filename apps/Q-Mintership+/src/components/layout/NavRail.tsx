import { Badge, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useLocation, useNavigate } from 'react-router-dom';
import { headerFill, primarySoft } from '../../hub-theme';
import { useCompactRail } from '../../hooks/usePhoneLayout';
import { APP_NAME } from '../../constants/plus';
import { isNavActive, railItems } from './navItems';

export const RAIL_WIDTH = 220;
export const RAIL_WIDTH_COMPACT = 72;

const Rail = styled('nav')(({ theme }) => ({
  position: 'sticky',
  top: 0,
  alignSelf: 'flex-start',
  height: 'var(--qmp-app-height, 100dvh)',
  width: RAIL_WIDTH,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
  padding: theme.spacing(2, 1.5),
  paddingTop: `calc(${theme.spacing(2)} + var(--qp-safe-top))`,
  backgroundColor: headerFill(theme),
  backdropFilter: 'blur(12px)',
  borderRight: `1px solid ${theme.palette.divider}`,
  overflowY: 'auto',
  [theme.breakpoints.down('md')]: {
    width: RAIL_WIDTH_COMPACT,
    padding: theme.spacing(2, 1),
    alignItems: 'center',
  },
}));

const Brand = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.25),
  padding: theme.spacing(1, 1.5, 2),
  [theme.breakpoints.down('md')]: { padding: theme.spacing(1, 0, 2), justifyContent: 'center' },
}));

const BrandMark = styled('span')(({ theme }) => ({
  width: 32,
  height: 32,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: primarySoft(theme),
  color: theme.palette.primary.main,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 800,
  fontSize: 13,
  flexShrink: 0,
}));

/**
 * A rail item. The selected item's highlight is its own layer: on a page
 * change the old one fades out as the new one fades in and settles to full
 * size, so the selection glides from item to item.
 */
const NavButton = styled('button', {
  shouldForwardProp: (prop) => prop !== '$active',
})<{ $active?: boolean }>(({ theme, $active }) => ({
  position: 'relative',
  isolation: 'isolate',
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  width: '100%',
  minHeight: 44,
  padding: theme.spacing(1.25, 1.5),
  border: 0,
  borderRadius:
    theme.qplus.id === 'hub30' || theme.qplus.id === 'hub20' ? theme.shape.borderRadius : 999,
  backgroundColor: 'transparent',
  color: $active ? theme.palette.primary.main : theme.palette.text.primary,
  cursor: 'pointer',
  font: 'inherit',
  fontSize: 15,
  fontWeight: $active ? 700 : 500,
  textAlign: 'left',
  transition: 'background-color 160ms ease, color 160ms ease',
  '&::before': {
    content: '""',
    position: 'absolute',
    inset: 0,
    zIndex: -1,
    borderRadius: 'inherit',
    backgroundColor: primarySoft(theme),
    opacity: $active ? 1 : 0,
    scale: $active ? '1' : '0.92',
    transition: 'opacity 200ms ease-out, scale 240ms cubic-bezier(0.2, 0, 0, 1)',
  },
  '&:hover': { backgroundColor: $active ? 'transparent' : theme.palette.action.hover },
  '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
  '& svg': { fontSize: 24, flexShrink: 0 },
  [theme.breakpoints.down('md')]: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    padding: theme.spacing(1.5),
  },
}));

const NavLabel = styled('span')({
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export function NavRail({
  isAdmin,
  decisionsBadge = 0,
}: {
  isAdmin: boolean;
  decisionsBadge?: number;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const compact = useCompactRail();
  return (
    <Rail aria-label="Main">
      <Brand>
        <BrandMark aria-hidden>QM+</BrandMark>
        {compact ? null : (
          // One line: at 18 px the name broke after "Q-".
          <Typography sx={{ fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' }}>
            {APP_NAME}
          </Typography>
        )}
      </Brand>
      {railItems(isAdmin).map(({ key, label, path, Icon }) => {
        const active = isNavActive(pathname, path);
        const badge = key === 'decisions' ? decisionsBadge : 0;
        return (
          <NavButton
            key={key}
            type="button"
            $active={active}
            aria-current={active ? 'page' : undefined}
            title={compact ? label : undefined}
            onClick={() => navigate(path)}
          >
            <Badge
              badgeContent={badge}
              color="error"
              max={99}
              overlap="circular"
              slotProps={{ badge: { 'aria-hidden': true } }}
            >
              <Icon aria-hidden />
            </Badge>
            <NavLabel className={compact ? 'qmp-visually-hidden' : undefined}>{label}</NavLabel>
            {badge ? <span className="qmp-visually-hidden">, {badge} waiting for you</span> : null}
          </NavButton>
        );
      })}
    </Rail>
  );
}
