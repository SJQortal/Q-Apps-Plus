/**
 * Swipe back on touch screens: a sideways swipe closes what is on top, as
 * Back does (an open message, the composer, a thread, a preview, a dialog,
 * a sheet, Settings). Swipe right for most; the mailboxes drawer, which
 * slides in from the left, closes with a swipe left. A round arrow follows
 * the finger from the screen's edge and fills in once letting go will close.
 *
 * Only layers that registered themselves (backStack.ts) are closed, and each
 * the way its own close button does, so nothing goes back in the history
 * Hub shares between tabs. With nothing open, a swipe does nothing.
 *
 * A swipe is left alone when it:
 * - starts in something that scrolls sideways and can still scroll that way
 *   (a zoomed image or PDF, the composer's row of attachments), or inside
 *   `[data-no-swipe-back]`, a slider or a range input;
 * - is mostly vertical (scrolling), or comes after holding still (a long
 *   press for a row's menu, or selecting text), or uses two fingers;
 * - happens while a dialog or menu that is not registered is open (a
 *   confirmation, a picker): it would close the layer under it.
 *
 * Touch only: a mouse never fires these events. Renders one hidden element.
 */
import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { overlayLayerCount, topBackLayer, type BackLayer, type SwipeDirection } from './backStack';

/** Movement before the swipe decides its direction. */
export const SWIPE_LOCK_PX = 12;
/** Movement that closes on release. */
export const SWIPE_TRIGGER_PX = 72;
/** Held this long before moving: a long press or a text selection, not a swipe. */
export const SWIPE_HOLD_MS = 400;

const ARROW_SIZE = 44;

/** Open MUI modals (dialogs, drawers, sheets, menus, pickers). */
const openModalCount = (): number => document.querySelectorAll('.MuiModal-root:not(.MuiModal-hidden)').length;

/** Whether a swipe from `target` in `direction` belongs to something under the finger. */
export function swipeBlockedAt(target: EventTarget | null, direction: SwipeDirection): boolean {
  for (let el = target instanceof Element ? target : null; el && el !== document.body; el = el.parentElement) {
    if (el.hasAttribute('data-no-swipe-back')) return true;
    if (el instanceof HTMLInputElement && el.type === 'range') return true;
    if (el.classList.contains('MuiSlider-root')) return true;
    if (el.scrollWidth > el.clientWidth + 1) {
      const overflowX = window.getComputedStyle(el).overflowX;
      if (overflowX === 'auto' || overflowX === 'scroll') {
        // A finger moving right scrolls the content back towards its start.
        const canScroll = direction === 'right' ? el.scrollLeft > 0 : el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
        if (canScroll) return true;
      }
    }
  }
  return false;
}

interface Gesture {
  x: number;
  y: number;
  at: number;
  target: EventTarget | null;
  layer: BackLayer;
  direction: SwipeDirection | null;
  pull: number;
}

export function SwipeBack() {
  const arrowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let gesture: Gesture | null = null;

    const paint = (pull: number, y: number, direction: SwipeDirection) => {
      const arrow = arrowRef.current;
      if (!arrow) return;
      const progress = Math.min(1, pull / SWIPE_TRIGGER_PX);
      // From just off the edge to 16 px in once it would close.
      const inset = -ARROW_SIZE + (ARROW_SIZE + 16) * progress;
      arrow.style.visibility = 'visible';
      arrow.style.top = `${Math.round(Math.max(8, Math.min(window.innerHeight - ARROW_SIZE - 8, y - ARROW_SIZE / 2)))}px`;
      arrow.style.left = direction === 'right' ? `${inset}px` : '';
      arrow.style.right = direction === 'left' ? `${inset}px` : '';
      arrow.style.opacity = String(Math.min(1, 0.25 + progress));
      arrow.dataset.armed = pull >= SWIPE_TRIGGER_PX ? 'true' : 'false';
    };
    const hide = () => {
      const arrow = arrowRef.current;
      if (arrow) {
        arrow.style.visibility = 'hidden';
        arrow.dataset.armed = 'false';
      }
    };
    const cancel = () => {
      gesture = null;
      hide();
    };

    const onStart = (event: TouchEvent) => {
      cancel();
      if (event.touches.length !== 1) return;
      const layer = topBackLayer();
      if (!layer) return;
      // A dialog or menu above every registered layer would be skipped.
      if (openModalCount() > overlayLayerCount()) return;
      const selection = window.getSelection?.();
      if (selection && !selection.isCollapsed) return;
      const touch = event.touches[0];
      gesture = { x: touch.clientX, y: touch.clientY, at: performance.now(), target: event.target, layer, direction: null, pull: 0 };
    };

    const onMove = (event: TouchEvent) => {
      if (!gesture) return;
      if (event.touches.length !== 1) return cancel();
      const touch = event.touches[0];
      const dx = touch.clientX - gesture.x;
      const dy = touch.clientY - gesture.y;
      if (!gesture.direction) {
        if (Math.hypot(dx, dy) < SWIPE_LOCK_PX) return;
        const direction: SwipeDirection = dx > 0 ? 'right' : 'left';
        if (
          performance.now() - gesture.at > SWIPE_HOLD_MS ||
          Math.abs(dx) < Math.abs(dy) * 1.5 ||
          direction !== gesture.layer.direction ||
          swipeBlockedAt(gesture.target, direction)
        ) {
          return cancel();
        }
        gesture.direction = direction;
      }
      // Ours now: the page neither scrolls nor clicks under the finger.
      if (event.cancelable) event.preventDefault();
      gesture.pull = Math.max(0, gesture.direction === 'right' ? dx : -dx);
      paint(gesture.pull, touch.clientY, gesture.direction);
    };

    const onEnd = () => {
      const done = gesture;
      cancel();
      // Still the top layer: nothing else opened or closed meanwhile.
      if (done?.direction && done.pull >= SWIPE_TRIGGER_PX && topBackLayer() === done.layer) done.layer.close();
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', cancel);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', cancel);
    };
  }, []);

  return (
    <Box
      ref={arrowRef}
      aria-hidden
      data-swipe-back-arrow
      data-armed="false"
      sx={(theme) => ({
        position: 'fixed',
        zIndex: theme.zIndex.tooltip + 1,
        width: ARROW_SIZE,
        height: ARROW_SIZE,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        visibility: 'hidden',
        pointerEvents: 'none',
        bgcolor: 'background.paper',
        color: 'text.primary',
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: theme.shadows[6],
        transition: 'background-color 120ms, color 120ms',
        '&[data-armed="true"]': {
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          borderColor: 'primary.main',
        },
      })}
    >
      <ArrowBackIcon fontSize="small" />
    </Box>
  );
}
