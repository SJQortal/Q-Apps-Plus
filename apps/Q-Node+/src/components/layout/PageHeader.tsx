import type { ReactNode } from 'react';
import { styled } from '@mui/material/styles';
import { Typography } from '@mui/material';
import { headerFill } from '../../hub-theme';

const Header = styled('header')(({ theme }) => ({
  position: 'sticky',
  top: 0,
  zIndex: theme.zIndex.appBar - 1,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  minHeight: 56,
  padding: theme.spacing(1, 2),
  paddingTop: `calc(${theme.spacing(1)} + var(--qp-safe-top))`,
  backgroundColor: headerFill(theme),
  backdropFilter: 'blur(12px)',
  borderBottom: `1px solid ${theme.palette.divider}`,
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(0.75, 1.5),
    paddingTop: `calc(${theme.spacing(0.75)} + var(--qp-safe-top))`,
  },
}));

const Actions = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginLeft: 'auto',
  flexShrink: 0,
}));

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Anything below the title row, such as a search field. */
  children?: ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  children,
}: PageHeaderProps) {
  return (
    <Header>
      <div style={{ minWidth: 0 }}>
        <Typography
          component="h1"
          sx={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}
          noWrap
        >
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body2" color="text.secondary" noWrap>
            {subtitle}
          </Typography>
        ) : null}
      </div>
      {children}
      {actions ? <Actions>{actions}</Actions> : null}
    </Header>
  );
}
