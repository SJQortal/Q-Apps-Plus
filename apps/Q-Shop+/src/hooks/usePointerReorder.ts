/**
 * Drag to reorder with pointer events, so it works with a mouse in Hub and
 * with a finger in GO (HTML drag and drop doesn't, on touch). A mouse drags
 * once it moves a few pixels; a finger presses and holds first, so a swipe
 * still scrolls the page. While an item is dragged over another, the list
 * moves it there (onMove), as the variants editor's drag does.
 */
import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

const MOUSE_START = 4;
const TOUCH_HOLD_MS = 300;
const TOUCH_SLOP = 10;

interface Press {
  pointerId: number;
  index: number;
  x: number;
  y: number;
  touch: boolean;
  started: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

export function usePointerReorder(onMove: (from: number, to: number) => void, disabled = false) {
  const list = useId();
  const press = useRef<Press | null>(null);
  const move = useRef(onMove);
  const [dragging, setDragging] = useState<number | null>(null);
  useEffect(() => {
    move.current = onMove;
  });

  useEffect(() => {
    const end = () => {
      const p = press.current;
      if (!p) return;
      if (p.timer) clearTimeout(p.timer);
      press.current = null;
      setDragging(null);
    };
    const over = (x: number, y: number): number | null => {
      const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-reorder-list]");
      if (!el || el.dataset.reorderList !== list) return null;
      const index = Number(el.dataset.reorderIndex);
      return Number.isInteger(index) ? index : null;
    };
    const onPointerMove = (e: PointerEvent) => {
      const p = press.current;
      if (!p || e.pointerId !== p.pointerId) return;
      const far = Math.hypot(e.clientX - p.x, e.clientY - p.y);
      if (!p.started) {
        // A finger that moves before the hold is a scroll; a mouse that moves is a drag.
        if (p.touch) {
          if (far > TOUCH_SLOP) end();
          return;
        }
        if (far < MOUSE_START) return;
        p.started = true;
        setDragging(p.index);
      }
      const to = over(e.clientX, e.clientY);
      if (to !== null && to !== p.index) {
        move.current(p.index, to);
        p.index = to;
        setDragging(to);
      }
    };
    // Once a finger drags, the page doesn't scroll under it.
    const onTouchMove = (e: TouchEvent) => {
      if (press.current?.started && e.cancelable) e.preventDefault();
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("touchmove", onTouchMove);
      end();
    };
  }, [list]);

  /** Props for the element that is dragged (and dragged over) at `index`. */
  const itemProps = (index: number) => ({
    "data-reorder-list": list,
    "data-reorder-index": index,
    onPointerDown: (e: ReactPointerEvent) => {
      if (disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
      // Its buttons (star, remove) are pressed, not dragged.
      if ((e.target as Element).closest("button")) return;
      const touch = e.pointerType !== "mouse";
      const p: Press = { pointerId: e.pointerId, index, x: e.clientX, y: e.clientY, touch, started: false, timer: null };
      if (touch) {
        p.timer = setTimeout(() => {
          if (press.current !== p) return;
          p.started = true;
          p.timer = null;
          setDragging(p.index);
        }, TOUCH_HOLD_MS);
      }
      press.current = p;
    },
    // A held picture would open the browser's own menu, or start its own drag.
    onContextMenu: (e: { preventDefault: () => void }) => {
      if (!disabled) e.preventDefault();
    },
    onDragStart: (e: { preventDefault: () => void }) => e.preventDefault(),
  });

  return { itemProps, dragging };
}
