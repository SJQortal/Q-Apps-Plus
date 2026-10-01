import type { ReactNode } from 'react';
import { Badge, ButtonBase, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { headerFill } from '../hub-theme';

export const BOTTOM_NAV_HEIGHT = 60;

const Bar = styled('nav')(({ theme }) => ({
  flexShrink: 0,
  display: 'flex',
  alignItems: 'stretch',
  justifyContent: 'space-around',
  height: `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  backgroundColor: headerFill(theme, 'chromeStrong'),
  backdropFilter: 'blur(16px)',
  borderTop: `1px solid ${theme.palette.divider}`,
  zIndex: 10,
}));

const Item = styled(ButtonBase, { shouldForwardProp: (p) => p !== '$active' })<{ $active?: boolean }>(
  ({ theme, $active }) => ({
    flex: 1,
    minWidth: 44,
    minHeight: 44,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    color: $active ? theme.palette.primary.main : theme.palette.text.secondary,
    borderRadius: theme.shape.borderRadius,
    transition: 'color 150ms ease, background-color 150ms ease',
    '& .MuiSvgIcon-root': { fontSize: 24 },
    '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  })
);

export interface BottomNavItem {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: number | string;
}

interface BottomNavProps {
  items: BottomNavItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

/** Phone bottom navigation: at most 5 thumb-reachable items. */
export function BottomNav({ items, activeId, onSelect }: BottomNavProps) {
  return (
    <Bar aria-label="Mailboxes">
      {items.slice(0, 5).map((item) => {
        const active = item.id === activeId;
        return (
          <Item
            key={item.id}
            $active={active}
            onClick={() => onSelect(item.id)}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
          >
            <Badge
              color="primary"
              badgeContent={item.badge}
              invisible={!item.badge}
              max={99}
              sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', minWidth: 16, height: 16 } }}
            >
              {item.icon}
            </Badge>
            <Typography sx={{ fontSize: '0.68rem', fontWeight: active ? 700 : 500, lineHeight: 1 }}>
              {item.label}
            </Typography>
          </Item>
        );
      })}
    </Bar>
  );
}
