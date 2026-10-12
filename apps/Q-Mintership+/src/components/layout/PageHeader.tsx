/**
 * The sticky, translucent page header: Back on sub-pages, the title, actions
 * on the right. On phones it slides away when scrolling down and comes back
 * when scrolling up (docs/DESIGN.md → Mobile).
 */
import { useRef, type ReactNode } from 'react';
import { IconButton, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { headerFill } from '../../hub-theme';
import { usePhoneLayout } from '../../hooks/usePhoneLayout';
import { useHideOnScroll, usePublishHeaderOffset } from '../../hooks/useHideOnScroll';
import { useSafeBack } from '../../hooks/useSafeBack';
import { useLandscapeFrame } from '../../utils/hubFrame';

const Header = styled('header', {
  shouldForwardProp: (prop) => prop !== '$hidden' && prop !== '$compact',
})<{ $hidden: boolean; $compact: boolean }>(({ theme, $hidden, $compact }) => ({
  position: 'sticky',
  top: 0,
  zIndex: theme.zIndex.appBar - 1,
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
  minHeight: $compact ? 48 : 56,
  padding: theme.spacing($compact ? 0.25 : 1, 2),
  paddingTop: `calc(${theme.spacing($compact ? 0.25 : 1)} + var(--qp-safe-top))`,
  backgroundColor: headerFill(theme),
  backdropFilter: 'blur(12px)',
  borderBottom: `1px solid ${theme.palette.divider}`,
  transform: $hidden ? 'translateY(-100%)' : 'none',
  transition: 'transform 200ms ease',
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing($compact ? 0.25 : 0.75, 1.5),
    paddingTop: `calc(${theme.spacing($compact ? 0.25 : 0.75)} + var(--qp-safe-top))`,
  },
}));

export interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Show Back; the value is where Back goes when the app was opened on this page. */
  back?: string;
  /** Anything under the title row (tabs, filters). */
  children?: ReactNode;
}

export function PageHeader({ title, subtitle, actions, back, children }: PageHeaderProps) {
  const phone = usePhoneLayout();
  const compact = useLandscapeFrame();
  const { hidden, reveal } = useHideOnScroll(phone);
  const ref = useRef<HTMLElement>(null);
  usePublishHeaderOffset(ref, hidden);
  const goBack = useSafeBack(back ?? '/');
  return (
    <Header ref={ref} $hidden={hidden} $compact={compact} onFocus={reveal}>
      {back !== undefined ? (
        <IconButton aria-label="Back" onClick={goBack} edge="start" sx={{ width: 44, height: 44 }}>
          <ArrowBackIcon />
        </IconButton>
      ) : null}
      <div style={{ minWidth: 0, flex: 1 }}>
        <Typography
          component="h1"
          sx={{ fontSize: compact ? 18 : 20, fontWeight: 700, lineHeight: 1.2 }}
          noWrap
        >
          {title}
        </Typography>
        {subtitle && !compact ? (
          <Typography variant="body2" color="text.secondary" noWrap>
            {subtitle}
          </Typography>
        ) : null}
      </div>
      {actions ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {actions}
        </div>
      ) : null}
      {children ? <div style={{ flexBasis: '100%', minWidth: 0 }}>{children}</div> : null}
    </Header>
  );
}
