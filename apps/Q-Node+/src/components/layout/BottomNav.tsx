import { styled } from '@mui/material/styles';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { headerFill, primarySoft } from '../../hub-theme';
import { isNavActive, NAV_ITEMS } from './navItems';

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
  fontSize: 11,
  fontWeight: $active ? 700 : 500,
  transition: 'color 160ms ease',
  '& svg': {
    fontSize: 26,
    padding: 2,
    borderRadius: 999,
    backgroundColor: $active ? primarySoft(theme) : 'transparent',
    boxSizing: 'content-box',
    paddingLeft: 10,
    paddingRight: 10,
    transition: 'background-color 160ms ease',
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: -2,
  },
}));

export function BottomNav() {
  const { t } = useTranslation(['core']);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <Bar
      aria-label={t('core:header.navigation', {
        postProcess: 'capitalizeFirstChar',
      })}
    >
      {NAV_ITEMS.map(({ labelKey, path, Icon }) => {
        const label = t(`core:header.${labelKey}`, {
          postProcess: 'capitalizeFirstChar',
        });
        const active = isNavActive(pathname, path);
        return (
          <Item
            key={path}
            type="button"
            $active={active}
            aria-current={active ? 'page' : undefined}
            aria-label={label}
            onClick={() => navigate(path)}
          >
            <Icon />
            <span>{label}</span>
          </Item>
        );
      })}
    </Bar>
  );
}
