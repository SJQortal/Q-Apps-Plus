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

/** After the header hides or shows, scroll changes for this long are its own doing (the 180 ms slide, and a frame or two). */
export const HEADER_SETTLE_MS = 300;

/** Pure direction logic, exported for tests: returns the new hidden state. */
export function nextHiddenState(hidden: boolean, previousTop: number, top: number, headerHeight = PANE_HEADER_HEIGHT): boolean {
  if (top <= headerHeight) return false;
  const delta = top - previousTop;
  if (delta > SCROLL_DELTA) return true;
  if (delta < -SCROLL_DELTA) return false;
  return hidden;
}

export interface ScrollSample {
  top: number;
  /** scrollHeight - clientHeight: how far the scroller can scroll right now. */
  max: number;
  at: number;
}

/**
 * The hidden state after a scroll event, ignoring scrolling the user didn't
 * do. Hiding the header makes the scroller taller (so does GO hiding its own
 * bar, or the keyboard closing), which leaves less room to scroll; near the
 * end, the browser pulls the content back by up to the header's height. Read
 * as a scroll up, that showed the header again, which shrank the scroller,
 * and so on: on a page only a little taller than the screen (a reply with the
 * keyboard down), the header flickered at certain positions, even with no
 * finger on the screen. So:
 * - a page with less than three header heights to scroll keeps its header,
 *   and at the very top the header always shows;
 * - the scroller growing and pulling the content back to its new end is not
 *   a scroll;
 * - for HEADER_SETTLE_MS after the header hides or shows, nothing changes.
 */
export function nextHiddenOnScroll(
  hidden: boolean,
  previous: ScrollSample,
  sample: ScrollSample,
  settleUntil: number,
  headerHeight = PANE_HEADER_HEIGHT
): boolean {
  if (sample.top <= 0) return false;
  // Judged only while the header shows: once hidden, the room also lost the
  // header's height, and GO's bar's if it went too.
  if (!hidden && sample.max < headerHeight * 3) return false;
  const pulledBack = sample.max < previous.max - 1 && sample.top >= sample.max - 1 && sample.top < previous.top;
  if (pulledBack || sample.at < settleUntil) return hidden;
  return nextHiddenState(hidden, previous.top, sample.top, headerHeight);
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
    const sampleOf = (scroller: HTMLElement): ScrollSample => ({
      top: scroller.scrollTop,
      max: scroller.scrollHeight - scroller.clientHeight,
      at: performance.now(),
    });
    let previous: ScrollSample | null = null;
    let lastScroller: HTMLElement | null = null;
    let isHidden = false;
    let settleUntil = 0;
    let frame = 0;
    const onScroll = (event: Event) => {
      const scroller = event.target;
      if (!isPaneScroller(scroller)) return;
      if (scroller !== lastScroller) {
        lastScroller = scroller;
        previous = null;
      }
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const sample = sampleOf(scroller);
        const next = nextHiddenOnScroll(isHidden, previous ?? { ...sample, top: 0 }, sample, settleUntil, headerHeight);
        if (next !== isHidden) {
          isHidden = next;
          settleUntil = sample.at + HEADER_SETTLE_MS;
          setHidden(next);
        }
        previous = sample;
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
