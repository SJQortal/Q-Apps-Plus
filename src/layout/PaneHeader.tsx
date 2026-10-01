import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconButton, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { headerFill } from '../hub-theme';
import { useLayoutMode } from './useLayoutMode';

export const PANE_HEADER_HEIGHT = 56;
/** Scroll distance that counts as a direction change. */
const SCROLL_DELTA = 8;

const Header = styled('header', { shouldForwardProp: (p) => p !== '$hidden' })<{ $hidden: boolean }>(
  ({ theme, $hidden }) => ({
    position: 'sticky',
    top: 0,
    zIndex: 3,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    minHeight: PANE_HEADER_HEIGHT,
    padding: theme.spacing(0.5, 1),
    backgroundColor: headerFill(theme),
    backdropFilter: 'blur(12px)',
    borderBottom: `1px solid ${theme.palette.divider}`,
    flexShrink: 0,
    // Hide on scroll down, return on scroll up (phones): the header slides
    // out of the pane and the scroller takes its space.
    transform: $hidden ? `translateY(-${PANE_HEADER_HEIGHT}px)` : 'none',
    marginBottom: $hidden ? -PANE_HEADER_HEIGHT : 0,
    transition: 'transform 180ms ease, margin-bottom 180ms ease',
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  })
);

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

/** Pure direction logic, exported for tests: returns the new hidden state. */
export function nextHiddenState(hidden: boolean, previousTop: number, top: number): boolean {
  if (top <= PANE_HEADER_HEIGHT) return false;
  const delta = top - previousTop;
  if (delta > SCROLL_DELTA) return true;
  if (delta < -SCROLL_DELTA) return false;
  return hidden;
}

/**
 * Tracks the pane's scroller (the element right after the header, i.e. the
 * PaneScroll) and hides the header while the user scrolls down on phones.
 */
function useHideOnScroll(enabled: boolean) {
  const headerRef = useRef<HTMLElement | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setHidden(false);
      return;
    }
    const scroller = headerRef.current?.nextElementSibling as HTMLElement | null;
    if (!scroller) return;
    let previousTop = scroller.scrollTop;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const top = scroller.scrollTop;
        setHidden((current) => nextHiddenState(current, previousTop, top));
        previousTop = top;
      });
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      setHidden(false);
    };
  }, [enabled]);

  return { headerRef, hidden };
}

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
  /** Set false to keep the header in view on phones (default: hides on scroll down). */
  hideOnScroll?: boolean;
}

export function PaneHeader({
  title,
  subtitle,
  onBack,
  backLabel = 'Back',
  leading,
  actions,
  className,
  hideOnScroll = true,
}: PaneHeaderProps) {
  const isPhone = useLayoutMode() === 'phone';
  const { headerRef, hidden } = useHideOnScroll(isPhone && hideOnScroll);
  return (
    <Header ref={headerRef} className={className} $hidden={hidden} data-hidden={hidden ? 'true' : undefined}>
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
