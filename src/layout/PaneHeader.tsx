import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconButton, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { headerFill } from '../hub-theme';
import { useLayoutMode } from './useLayoutMode';
import { COMPACT_BAR_HEIGHT, LANDSCAPE_FRAME_MEDIA, useLandscapeFrame } from '../utils/hubFrame';

export const PANE_HEADER_HEIGHT = 56;
/** In Hub a phone held sideways gives the app a frame about 201 px tall, so the bar shrinks (pitfall 3). */
export const PANE_HEADER_HEIGHT_COMPACT = COMPACT_BAR_HEIGHT;
/** Scroll distance that counts as a direction change. */
const SCROLL_DELTA = 8;

const Header = styled('header', { shouldForwardProp: (p) => p !== '$hidden' && p !== '$height' })<{
  $hidden: boolean;
  $height: number;
}>(({ theme, $hidden, $height }) => ({
  position: 'sticky',
  top: 0,
  zIndex: 3,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  minHeight: $height,
  padding: theme.spacing(0.5, 1),
  backgroundColor: headerFill(theme),
  backdropFilter: 'blur(12px)',
  borderBottom: `1px solid ${theme.palette.divider}`,
  flexShrink: 0,
  // Hide on scroll down, return on scroll up (phones): the header slides
  // out of the pane and the scroller takes its space.
  transform: $hidden ? `translateY(-${$height}px)` : 'none',
  marginBottom: $hidden ? -$height : 0,
  transition: 'transform 180ms ease, margin-bottom 180ms ease',
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  [`@media ${LANDSCAPE_FRAME_MEDIA}`]: {
    minHeight: PANE_HEADER_HEIGHT_COMPACT,
    paddingTop: 0,
    paddingBottom: 0,
  },
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

/** Pure direction logic, exported for tests: returns the new hidden state. */
export function nextHiddenState(hidden: boolean, previousTop: number, top: number, headerHeight = PANE_HEADER_HEIGHT): boolean {
  if (top <= headerHeight) return false;
  const delta = top - previousTop;
  if (delta > SCROLL_DELTA) return true;
  if (delta < -SCROLL_DELTA) return false;
  return hidden;
}

/**
 * Tracks the pane's scroller (the element right after the header, i.e. the
 * PaneScroll) and hides the header while the user scrolls down on phones.
 */
function useHideOnScroll(enabled: boolean, headerHeight: number) {
  const headerRef = useRef<HTMLElement | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setHidden(false);
      return;
    }
    const next = headerRef.current?.nextElementSibling as HTMLElement | null;
    if (!next) return;
    // The scroller is the next sibling (a PaneScroll), or an element marked
    // data-pane-scroll inside it (the composer's form, which may mount later
    // from a lazy chunk). Scroll events don't bubble, but they do pass the
    // capture phase, so one capturing listener on the sibling sees both.
    const isPaneScroller = (target: EventTarget | null): target is HTMLElement =>
      target === next || (target instanceof HTMLElement && target.hasAttribute('data-pane-scroll') && next.contains(target));
    let previousTop = 0;
    let lastScroller: HTMLElement | null = null;
    let frame = 0;
    const onScroll = (event: Event) => {
      const scroller = event.target;
      if (!isPaneScroller(scroller)) return;
      if (scroller !== lastScroller) {
        lastScroller = scroller;
        previousTop = 0;
      }
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const top = scroller.scrollTop;
        setHidden((current) => nextHiddenState(current, previousTop, top, headerHeight));
        previousTop = top;
      });
    };
    next.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => {
      next.removeEventListener('scroll', onScroll, { capture: true });
      if (frame) window.cancelAnimationFrame(frame);
      setHidden(false);
    };
  }, [enabled, headerHeight]);

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
  // A short, wide frame (a phone held sideways in Hub) is one pane at a time
  // too, so the header hides on scroll there as well, from its compact height.
  const landscape = useLandscapeFrame();
  const height = landscape ? PANE_HEADER_HEIGHT_COMPACT : PANE_HEADER_HEIGHT;
  const { headerRef, hidden } = useHideOnScroll((isPhone || landscape) && hideOnScroll, height);
  return (
    <Header
      ref={headerRef}
      className={className}
      $hidden={hidden}
      $height={height}
      data-hidden={hidden ? 'true' : undefined}
      data-compact={landscape ? 'true' : undefined}
    >
      {onBack ? (
        <IconButton onClick={onBack} aria-label={backLabel} size="large" sx={{ minWidth: 44, minHeight: 44 }}>
          <ArrowBackIcon />
        </IconButton>
      ) : (
        leading
      )}
      <Titles>
        <Typography component="h1" sx={{ fontWeight: 700, fontSize: landscape ? '1rem' : '1.05rem', lineHeight: 1.25 }} noWrap>
          {title}
        </Typography>
        {subtitle && !landscape && (
          <Typography variant="body2" color="text.secondary" noWrap>
            {subtitle}
          </Typography>
        )}
      </Titles>
      {actions && <Actions>{actions}</Actions>}
    </Header>
  );
}
