import type { ReactNode } from 'react';
import { IconButton, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { headerFill } from '../hub-theme';

const Header = styled('header')(({ theme }) => ({
  position: 'sticky',
  top: 0,
  zIndex: 3,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  minHeight: 56,
  padding: theme.spacing(0.5, 1),
  backgroundColor: headerFill(theme),
  backdropFilter: 'blur(12px)',
  borderBottom: `1px solid ${theme.palette.divider}`,
  flexShrink: 0,
}));

const Titles = styled('div')({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  paddingLeft: 8,
});

const Actions = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  flexShrink: 0,
}));

export interface PaneHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Renders a Back button on the left and calls this when pressed. */
  onBack?: () => void;
  backLabel?: string;
  /** Rendered left of the title when there is no Back button (e.g. a menu button). */
  leading?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PaneHeader({ title, subtitle, onBack, backLabel = 'Back', leading, actions, className }: PaneHeaderProps) {
  return (
    <Header className={className}>
      {onBack ? (
        <IconButton onClick={onBack} aria-label={backLabel} size="large" sx={{ minWidth: 44, minHeight: 44 }}>
          <ArrowBackIcon />
        </IconButton>
      ) : (
        leading
      )}
      <Titles>
        <Typography component="h1" sx={{ fontWeight: 700, fontSize: '1.05rem', lineHeight: 1.25 }} noWrap>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" noWrap>
            {subtitle}
          </Typography>
        )}
      </Titles>
      {actions && <Actions>{actions}</Actions>}
    </Header>
  );
}
