import { Badge } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useLocation, useNavigate } from 'react-router-dom';
import { headerFill, primarySoft } from '../../hub-theme';
import { isNavActive, phoneItems } from './navItems';

export const BOTTOM_NAV_HEIGHT = 60;

const Bar = styled('nav')(({ theme }) => ({
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: theme.zIndex.appBar,
  height: `calc(${BOTTOM_NAV_HEIGHT}px + var(--qp-safe-bottom))`,
  paddingBottom: 'var(--qp-safe-bottom)',
  display: 'flex',
  alignItems: 'stretch',
  justifyContent: 'space-around',
  backgroundColor: headerFill(theme, 'chromeStrong'),
  backdropFilter: 'blur(16px)',
  borderTop: `1px solid ${theme.palette.divider}`,
}));

const Item = styled('button', {
  shouldForwardProp: (prop) => prop !== '$active',
})<{ $active?: boolean }>(({ theme, $active }) => ({
  flex: 1,
  minWidth: 0,
  minHeight: 44,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  border: 0,
  background: 'none',
  color: $active ? theme.palette.primary.main : theme.palette.text.secondary,
  cursor: 'pointer',
  font: 'inherit',
  fontSize: 12,
  fontWeight: $active ? 700 : 500,
  transition: 'color 160ms ease',
  '& svg': {
    fontSize: 24,
    padding: '2px 12px',
    borderRadius: 999,
    boxSizing: 'content-box',
    backgroundColor: $active ? primarySoft(theme) : 'transparent',
    transition: 'background-color 160ms ease',
  },
  '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
}));

const Label = styled('span')({
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  padding: '0 2px',
});

export function BottomNav({
  isAdmin,
  decisionsBadge = 0,
}: {
  isAdmin: boolean;
  decisionsBadge?: number;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <Bar aria-label="Main">
      {phoneItems(isAdmin).map(({ key, label, short, path, Icon }) => {
        const active = isNavActive(pathname, path);
        const badge = key === 'decisions' ? decisionsBadge : 0;
        return (
          <Item
            key={key}
            type="button"
            $active={active}
            aria-current={active ? 'page' : undefined}
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
            <Label>{short ?? label}</Label>
            {badge ? <span className="qmp-visually-hidden">, {badge} waiting for you</span> : null}
          </Item>
        );
      })}
    </Bar>
  );
}
