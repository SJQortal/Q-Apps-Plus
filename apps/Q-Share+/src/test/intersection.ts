import { act } from '@testing-library/react';
import { onTestFinished } from 'vitest';

/**
 * An IntersectionObserver that answers the way a browser does when nothing
 * scrolls: one reading for each element it starts observing, then nothing.
 * Calling mockAllIsIntersecting again and again hands the same element fresh
 * readings a browser never gives, so a pager that stalls in a browser would
 * still pass. Restored when the test ends.
 */
export function readOncePerObserve(isIntersecting = true): void {
  const original = window.IntersectionObserver;

  class ReadOnceObserver {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds: number[];
    private readonly callback: IntersectionObserverCallback;
    private readonly observed = new Set<Element>();

    constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit = {}) {
      this.callback = callback;
      this.thresholds = Array.isArray(options.threshold) ? options.threshold : [options.threshold ?? 0];
    }

    observe(target: Element) {
      this.observed.add(target);
      setTimeout(() => {
        if (!this.observed.has(target)) return;
        const rect = target.getBoundingClientRect();
        const entry = {
          target,
          isIntersecting,
          intersectionRatio: isIntersecting ? 1 : 0,
          boundingClientRect: rect,
          intersectionRect: rect,
          rootBounds: null,
          time: 0,
        } as IntersectionObserverEntry;
        act(() => this.callback([entry], this as unknown as IntersectionObserver));
      });
    }

    unobserve(target: Element) {
      this.observed.delete(target);
    }

    disconnect() {
      this.observed.clear();
    }

    takeRecords() {
      return [];
    }
  }

  window.IntersectionObserver = ReadOnceObserver as unknown as typeof IntersectionObserver;
  onTestFinished(() => {
    window.IntersectionObserver = original;
  });
}
