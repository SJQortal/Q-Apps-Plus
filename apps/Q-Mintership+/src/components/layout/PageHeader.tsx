/**
 * The sticky, translucent page header: Back on sub-pages, the title, actions
 * on the right. On phones it slides away when scrolling down and comes back
 * when scrolling up (docs/DESIGN.md → Mobile).
 *
 * A new page's title and actions fade in (index.css → .qmp-reveal-fade);
 * the bar itself stays put.
 *
 * After a route change it takes focus on its title, so a screen reader
 * announces the new page and Tab starts from its top, and it names the
 * document after the page. The app's first page keeps the browser's focus.
 * An Explorer account's tabs are one page (routes/paths.ts pageKeyOf): a tab
 * switch leaves focus on the tab.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { IconButton, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { headerFill } from '../../hub-theme';
import { usePhoneLayout } from '../../hooks/usePhoneLayout';
import { useHideOnScroll, usePublishHeaderOffset } from '../../hooks/useHideOnScroll';
import { useSafeBack } from '../../hooks/useSafeBack';
import { useLandscapeFrame } from '../../utils/hubFrame';
import { APP_NAME } from '../../constants/plus';
import { pageKeyOf } from '../../routes/paths';
import { isFirstPage } from './pageFocus';

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
  /** What the heading shows, when not `title` itself (a crossed-out name: MarkedName). */
  heading?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Show Back; the value is where Back goes when the app was opened on this page. */
  back?: string;
  /** Anything under the title row (tabs, filters). */
  children?: ReactNode;
}

export function PageHeader({ title, heading, subtitle, actions, back, children }: PageHeaderProps) {
  const page = pageKeyOf(useLocation().pathname);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (isFirstPage()) return;
    titleRef.current?.focus({ preventScroll: true });
  }, [page]);

  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`;
  }, [title]);

  const phone = usePhoneLayout();
  const compact = useLandscapeFrame();
  const { hidden, reveal } = useHideOnScroll(phone);
  const ref = useRef<HTMLElement>(null);
  usePublishHeaderOffset(ref, hidden);
  const goBack = useSafeBack(back ?? '/');
  return (
    <Header
      ref={ref}
      $hidden={hidden}
      $compact={compact}
      onFocus={reveal}
      className="qmp-reveal-fade"
    >
      {back !== undefined ? (
        <IconButton aria-label="Back" onClick={goBack} edge="start" sx={{ width: 44, height: 44 }}>
          <ArrowBackIcon />
        </IconButton>
      ) : null}
      <div style={{ minWidth: 0, flex: 1 }}>
        <Typography
          ref={titleRef}
          component="h1"
          tabIndex={-1}
          sx={{
            fontSize: compact ? 18 : 20,
            fontWeight: 700,
            lineHeight: 1.2,
            // Focused by the app on a route change, not by the user: no ring.
            '&:focus': { outline: 'none' },
          }}
          noWrap
        >
          {heading ?? title}
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
