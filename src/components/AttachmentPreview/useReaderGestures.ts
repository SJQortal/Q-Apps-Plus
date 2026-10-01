/**
 * Touch gestures for a scrolling reader (adapted from Torq's
 * src/hooks/useReaderGestures.ts). One finger keeps the browser's own
 * scrolling (the element should use `touch-action: pan-x pan-y`); two fingers
 * pinch. A trackpad pinch arrives as a ctrl wheel and is reported the same way.
 */
import { useEffect, useRef } from 'react';

export type ReaderPoint = { x: number; y: number };

export interface ReaderGestureHandlers {
  /** Two fingers went down, or a trackpad pinch began. */
  onPinchStart?: (focal: ReaderPoint) => void;
  /** `ratio` is the finger spread compared with the start of the pinch. */
  onPinch?: (ratio: number, focal: ReaderPoint) => void;
  onPinchEnd?: (ratio: number, focal: ReaderPoint) => void;
  onTap?: (point: ReaderPoint) => void;
  onDoubleTap?: (point: ReaderPoint) => void;
  /** 1 when the finger moved left (next), -1 when it moved right. */
  onSwipe?: (direction: 1 | -1) => void;
}

const TAP_SLOP_PX = 10;
const TAP_MAX_MS = 350;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP_PX = 32;
const SWIPE_MIN_PX = 64;
const SWIPE_MAX_MS = 600;
const WHEEL_SETTLE_MS = 180;

export function pointerDistance(a: ReaderPoint, b: ReaderPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function pointerMidpoint(a: ReaderPoint, b: ReaderPoint): ReaderPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * A trackpad pinch is a ctrl/meta wheel whose deltaY is 100 * ln(scale), so
 * dividing by 100 restores the finger scale.
 */
export function wheelZoomFactor(deltaY: number): number {
  return Math.exp(-deltaY * 0.01);
}

function touchPoint(touch: { clientX: number; clientY: number }): ReaderPoint {
  return { x: touch.clientX, y: touch.clientY };
}

function onControl(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('button, a, input, select, [role="button"]'));
}

export function useReaderGestures(node: HTMLElement | null, handlers: ReaderGestureHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!node) return;
    let pinch: { distance: number; ratio: number; focal: ReaderPoint } | null = null;
    let pinched = false;
    let single: { x: number; y: number; at: number; moved: boolean; control: boolean } | null = null;
    let lastTap = { at: 0, x: 0, y: 0 };
    let frame = 0;
    let wheel: { ratio: number; focal: ReaderPoint } | null = null;
    let wheelTimer = 0;
    let mouse: { x: number; y: number; at: number } | null = null;

    const tap = (point: ReaderPoint) => {
      const now = Date.now();
      const { onTap, onDoubleTap } = handlersRef.current;
      if (onDoubleTap && now - lastTap.at < DOUBLE_TAP_MS && pointerDistance(lastTap, point) < DOUBLE_TAP_SLOP_PX) {
        lastTap = { at: 0, x: 0, y: 0 };
        onDoubleTap(point);
        return;
      }
      lastTap = { at: now, ...point };
      onTap?.(point);
    };

    const endPinch = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      const done = pinch;
      pinch = null;
      if (done) handlersRef.current.onPinchEnd?.(done.ratio, done.focal);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length >= 2) {
        const a = touchPoint(event.touches[0]!);
        const b = touchPoint(event.touches[1]!);
        if (!pinch) {
          pinch = { distance: Math.max(1, pointerDistance(a, b)), ratio: 1, focal: pointerMidpoint(a, b) };
          handlersRef.current.onPinchStart?.(pinch.focal);
        }
        pinched = true;
        single = null;
        return;
      }
      if (event.touches.length === 1) {
        pinched = false;
        single = { ...touchPoint(event.touches[0]!), at: Date.now(), moved: false, control: onControl(event.target) };
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      if (pinch && event.touches.length >= 2) {
        if (event.cancelable) event.preventDefault();
        const a = touchPoint(event.touches[0]!);
        const b = touchPoint(event.touches[1]!);
        pinch.ratio = Math.max(1, pointerDistance(a, b)) / pinch.distance;
        pinch.focal = pointerMidpoint(a, b);
        if (!frame) {
          frame = window.requestAnimationFrame(() => {
            frame = 0;
            if (pinch) handlersRef.current.onPinch?.(pinch.ratio, pinch.focal);
          });
        }
        return;
      }
      if (single && event.touches.length === 1) {
        const point = touchPoint(event.touches[0]!);
        if (pointerDistance(single, point) > TAP_SLOP_PX) single.moved = true;
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (pinch) {
        if (event.touches.length < 2) endPinch();
        return;
      }
      const start = single;
      single = null;
      if (!start || pinched || event.touches.length > 0 || start.control) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      const point = touchPoint(touch);
      const dx = point.x - start.x;
      const dy = point.y - start.y;
      const elapsed = Date.now() - start.at;
      if (elapsed < SWIPE_MAX_MS && Math.abs(dx) > SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 2) {
        handlersRef.current.onSwipe?.(dx < 0 ? 1 : -1);
        return;
      }
      if (!start.moved && elapsed < TAP_MAX_MS) tap(point);
    };

    const onTouchCancel = () => {
      single = null;
      endPinch();
    };

    // Touch taps come from the touch events above; this covers mouse and pen.
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || event.button !== 0) return;
      mouse = onControl(event.target) ? null : { x: event.clientX, y: event.clientY, at: Date.now() };
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || !mouse) return;
      const start = mouse;
      mouse = null;
      const point = { x: event.clientX, y: event.clientY };
      if (pointerDistance(start, point) <= TAP_SLOP_PX / 2 && Date.now() - start.at < TAP_MAX_MS * 2) {
        tap(point);
      }
    };

    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !handlersRef.current.onPinch) return;
      event.preventDefault();
      const focal = { x: event.clientX, y: event.clientY };
      if (!wheel) {
        wheel = { ratio: 1, focal };
        handlersRef.current.onPinchStart?.(focal);
      }
      wheel.ratio *= wheelZoomFactor(event.deltaY);
      wheel.focal = focal;
      handlersRef.current.onPinch?.(wheel.ratio, focal);
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => {
        const done = wheel;
        wheel = null;
        if (done) handlersRef.current.onPinchEnd?.(done.ratio, done.focal);
      }, WHEEL_SETTLE_MS);
    };

    node.addEventListener('touchstart', onTouchStart, { passive: true });
    node.addEventListener('touchmove', onTouchMove, { passive: false });
    node.addEventListener('touchend', onTouchEnd);
    node.addEventListener('touchcancel', onTouchCancel);
    node.addEventListener('pointerdown', onPointerDown);
    node.addEventListener('pointerup', onPointerUp);
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      node.removeEventListener('touchstart', onTouchStart);
      node.removeEventListener('touchmove', onTouchMove);
      node.removeEventListener('touchend', onTouchEnd);
      node.removeEventListener('touchcancel', onTouchCancel);
      node.removeEventListener('pointerdown', onPointerDown);
      node.removeEventListener('pointerup', onPointerUp);
      node.removeEventListener('wheel', onWheel);
      if (frame) window.cancelAnimationFrame(frame);
      window.clearTimeout(wheelTimer);
    };
  }, [node]);
}
