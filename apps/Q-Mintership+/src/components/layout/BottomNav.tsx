import { Badge } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useLocation, useNavigate } from 'react-router-dom';
import { headerFill, primarySoft } from '../../hub-theme';
import { badgeWords, isNavActive, phoneItems } from './navItems';

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
  // The browser's default button padding (6 px a side) cut "Nominees" short at 360 px.
  padding: 0,
  border: 0,
  background: 'none',
  color: $active ? theme.palette.primary.main : theme.palette.text.secondary,
  cursor: 'pointer',
  font: 'inherit',
  fontSize: 12,
  fontWeight: $active ? 700 : 500,
  transition: 'color 160ms ease',
  '& svg': { fontSize: 24 },
  '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
}));

/**
 * The pill behind the icon. Its fill is its own layer, so the selected
 * item's pill grows out from the middle as it fades in, and the old one
 * fades away. Same size as the icon's old padding: the badge sits where it did.
 */
const Pill = styled('span', {
  shouldForwardProp: (prop) => prop !== '$active',
})<{ $active?: boolean }>(({ theme, $active }) => ({
  position: 'relative',
  isolation: 'isolate',
  display: 'inline-flex',
  padding: '2px 12px',
  borderRadius: 999,
  '&::before': {
    content: '""',
    position: 'absolute',
    inset: 0,
    zIndex: -1,
    borderRadius: 'inherit',
    backgroundColor: primarySoft(theme),
    opacity: $active ? 1 : 0,
    scale: $active ? '1' : '0.5 1',
    transition:
      'opacity var(--qmp-motion-enter) var(--qmp-ease-fade), scale var(--qmp-motion-enter) var(--qmp-ease-enter)',
  },
}));

const Label = styled('span')({
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  padding: '0 2px',
});

export function BottomNav({
  withDecisions,
  decisionsBadge = 0,
  historyBadge = 0,
}: {
  /** Decisions is in the navigation (useDecisionsInNav). */
  withDecisions: boolean;
  decisionsBadge?: number;
  /** Changes decided since this Minter Admin last had History open. */
  historyBadge?: number;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <Bar aria-label="Main">
      {phoneItems(withDecisions).map(({ key, label, short, path, Icon }) => {
        const active = isNavActive(pathname, path);
        const badge = key === 'decisions' ? decisionsBadge : key === 'history' ? historyBadge : 0;
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
              <Pill $active={active} aria-hidden>
                <Icon />
              </Pill>
            </Badge>
            <Label>{short ?? label}</Label>
            {badge ? <span className="qmp-visually-hidden">, {badgeWords(key, badge)}</span> : null}
          </Item>
        );
      })}
    </Bar>
  );
}
