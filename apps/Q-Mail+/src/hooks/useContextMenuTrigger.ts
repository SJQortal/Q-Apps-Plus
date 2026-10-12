/**
 * Opens a list row's menu the ways people expect:
 * - right click (and the keyboard's menu key or Shift+F10, which fire the
 *   same `contextmenu` event on the focused row);
 * - a long press on a touch screen (LONG_PRESS_MS without moving more than
 *   LONG_PRESS_MOVE_PX), for iOS, whose WebView fires no `contextmenu`.
 *
 * Android fires `contextmenu` during a long press too; whichever comes first
 * opens the menu and the other is ignored. The tap that ends a long press
 * does not reach the row, so it does not also open the message.
 *
 * The row's own handler stops the event, so GlobalContextMenu (the app-wide
 * "Copy" menu for selected text) stays closed. Events from inside a portal
 * (the open menu itself) bubble through React to the row but are not the
 * row's, so they are left alone.
 */
import { useCallback, useEffect, useRef } from "react";
import type React from "react";

export const LONG_PRESS_MS = 500;
export const LONG_PRESS_MOVE_PX = 10;

export interface MenuPoint {
  top: number;
  left: number;
}

export interface ContextMenuTriggerHandlers {
  onContextMenu: (event: React.MouseEvent<HTMLElement>) => void;
  onTouchStart: (event: React.TouchEvent<HTMLElement>) => void;
  onTouchMove: (event: React.TouchEvent<HTMLElement>) => void;
  onTouchEnd: (event: React.TouchEvent<HTMLElement>) => void;
  onTouchCancel: () => void;
  onClickCapture: (event: React.MouseEvent<HTMLElement>) => void;
}

/** Where a menu opened from `event` goes: the pointer, or the row's corner for a keyboard. */
export function menuPointFor(event: { clientX: number; clientY: number }, row: HTMLElement): MenuPoint {
  const rect = row.getBoundingClientRect();
  const inside =
    event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  // A keyboard-opened menu has no pointer inside the row.
  if (!inside || (event.clientX === 0 && event.clientY === 0)) {
    return { top: rect.top + Math.min(rect.height, 40), left: rect.left + 16 };
  }
  return { top: event.clientY, left: event.clientX };
}

/** Whether the event happened on the row itself, not in a portal (the menu) rendered under it. */
const onRow = (event: { currentTarget: EventTarget; target: EventTarget }): boolean =>
  event.currentTarget instanceof Node && event.target instanceof Node && event.currentTarget.contains(event.target);

/** After a long press, Android's own contextmenu for the same press is ignored for this long. */
const SAME_PRESS_MS = 1500;
/** The click that ends a long press arrives within this of the finger lifting. */
const CLICK_AFTER_LIFT_MS = 600;

export function useContextMenuTrigger(onOpen: (point: MenuPoint) => void): ContextMenuTriggerHandlers {
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  // When a long press opened the menu (0: none since the finger last lifted).
  const longPressAt = useRef(0);
  // The tap that ends a long press is swallowed until then.
  const swallowClickUntil = useRef(0);
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

  const cancel = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    start.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);

  const onContextMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!onRow(event)) return;
      event.preventDefault();
      event.stopPropagation();
      if (start.current) {
        // Android's own long press came first: it opens the menu, our timer stops.
        cancel();
        longPressAt.current = Date.now();
      } else if (longPressAt.current && Date.now() - longPressAt.current < SAME_PRESS_MS) {
        // Our long press already opened it; this is Android's for the same press.
        return;
      }
      onOpenRef.current(menuPointFor(event, event.currentTarget));
    },
    [cancel]
  );

  const onTouchStart = useCallback(
    (event: React.TouchEvent<HTMLElement>) => {
      if (!onRow(event)) return;
      cancel();
      longPressAt.current = 0;
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      start.current = { x: touch.clientX, y: touch.clientY };
      const point = { top: touch.clientY, left: touch.clientX };
      timer.current = window.setTimeout(() => {
        timer.current = undefined;
        start.current = null;
        longPressAt.current = Date.now();
        onOpenRef.current(point);
      }, LONG_PRESS_MS);
    },
    [cancel]
  );

  const onTouchMove = useCallback(
    (event: React.TouchEvent<HTMLElement>) => {
      const touch = event.touches[0];
      if (!start.current || !touch) return;
      if (Math.hypot(touch.clientX - start.current.x, touch.clientY - start.current.y) > LONG_PRESS_MOVE_PX) cancel();
    },
    [cancel]
  );

  const onTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLElement>) => {
      cancel();
      if (!longPressAt.current) return;
      longPressAt.current = 0;
      // No click after a long press: the menu is open now.
      if (event.cancelable) event.preventDefault();
      swallowClickUntil.current = Date.now() + CLICK_AFTER_LIFT_MS;
    },
    [cancel]
  );

  const onClickCapture = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (!onRow(event) || Date.now() >= swallowClickUntil.current) return;
    swallowClickUntil.current = 0;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  return { onContextMenu, onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: cancel, onClickCapture };
}
