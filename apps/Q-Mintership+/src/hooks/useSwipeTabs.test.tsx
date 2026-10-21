/**
 * Swiping through tabs on a touch screen: left for the next, right for the
 * previous, none past the ends; nothing for a scroll up or down, a short or
 * slow drag, a touch at the screen's edge, on a field, on a part marked
 * data-no-swipe or one that scrolls sideways, or with two fingers. The
 * panel follows the finger a little and springs back.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { EDGE_PX, isSwipe, MIN_SWIPE_PX, useSwipeTabs, type SwipeStep } from './useSwipeTabs';

function Panel({ go, first = false }: { go: (step: SwipeStep) => void; first?: boolean }) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  useSwipeTabs(node, { enabled: true, canGo: (step) => !(first && step === -1), go });
  return (
    <div ref={setNode} data-testid="panel">
      <p>Words</p>
      <input aria-label="Search" />
      <div data-no-swipe="">Chart</div>
    </div>
  );
}

/** A touch event with its points, as a browser sends them. */
function touch(target: Element, type: string, points: Array<{ x: number; y: number }>) {
  const event = new Event(type, { bubbles: true });
  const list = points.map((p) => ({ clientX: p.x, clientY: p.y }));
  Object.defineProperty(event, 'touches', { value: type === 'touchend' ? [] : list });
  Object.defineProperty(event, 'changedTouches', { value: list });
  target.dispatchEvent(event);
}

/** One finger from (x, y) moved by (dx, dy). */
function swipe(target: Element, x: number, y: number, dx: number, dy = 0) {
  touch(target, 'touchstart', [{ x, y }]);
  touch(target, 'touchmove', [{ x: x + dx / 2, y: y + dy / 2 }]);
  touch(target, 'touchmove', [{ x: x + dx, y: y + dy }]);
  touch(target, 'touchend', [{ x: x + dx, y: y + dy }]);
}

afterEach(() => vi.restoreAllMocks());

describe('isSwipe', () => {
  it('takes a quick sideways move, or a long one, never one more up or down', () => {
    expect(isSwipe(-MIN_SWIPE_PX, 10, 200, 390)).toBe(true);
    expect(isSwipe(MIN_SWIPE_PX - 1, 0, 200, 390)).toBe(false);
    expect(isSwipe(-80, 50, 200, 390)).toBe(false);
    expect(isSwipe(-80, 0, 1500, 390)).toBe(false);
    expect(isSwipe(-200, 0, 1500, 390)).toBe(true);
  });
});

describe('useSwipeTabs', () => {
  it('opens the next tab on a swipe to the left, the previous on one to the right', () => {
    const go = vi.fn();
    render(<Panel go={go} />);
    const words = screen.getByText('Words');
    swipe(words, 500, 300, -120);
    expect(go).toHaveBeenLastCalledWith(1);
    swipe(words, 300, 300, 120, 20);
    expect(go).toHaveBeenLastCalledWith(-1);
    expect(go).toHaveBeenCalledTimes(2);
  });

  it('goes nowhere past the first tab', () => {
    const go = vi.fn();
    render(<Panel go={go} first />);
    swipe(screen.getByText('Words'), 300, 300, 120);
    expect(go).not.toHaveBeenCalled();
  });

  it('leaves alone a scroll, a short drag, the screen’s edge, a field, a chart and two fingers', () => {
    const go = vi.fn();
    render(<Panel go={go} />);
    const words = screen.getByText('Words');
    swipe(words, 500, 300, -60, 200);
    swipe(words, 500, 300, -40);
    swipe(words, EDGE_PX - 4, 300, 150);
    swipe(words, window.innerWidth - EDGE_PX + 4, 300, -150);
    swipe(screen.getByRole('textbox', { name: 'Search' }), 500, 300, -150);
    swipe(screen.getByText('Chart'), 500, 300, -150);
    touch(words, 'touchstart', [
      { x: 500, y: 300 },
      { x: 600, y: 300 },
    ]);
    touch(words, 'touchend', [{ x: 300, y: 300 }]);
    expect(go).not.toHaveBeenCalled();
  });

  it('leaves alone a part that scrolls sideways itself', () => {
    const go = vi.fn();
    render(<Panel go={go} />);
    const words = screen.getByText('Words');
    words.style.overflowX = 'auto';
    vi.spyOn(words, 'scrollWidth', 'get').mockReturnValue(800);
    vi.spyOn(words, 'clientWidth', 'get').mockReturnValue(300);
    swipe(words, 500, 300, -150);
    expect(go).not.toHaveBeenCalled();
  });

  it('follows the finger a little, then springs back', () => {
    render(<Panel go={() => {}} />);
    const panel = screen.getByTestId('panel');
    const words = screen.getByText('Words');
    touch(words, 'touchstart', [{ x: 500, y: 300 }]);
    touch(words, 'touchmove', [{ x: 300, y: 305 }]);
    expect(panel.style.transform).toBe('translateX(-48px)');
    touch(words, 'touchend', [{ x: 300, y: 305 }]);
    expect(panel.style.transform).toBe('');
  });
});
