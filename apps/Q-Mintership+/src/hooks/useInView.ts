/**
 * True once `node` has come within `rootMargin` of the viewport, and from
 * then on: it never turns false again. Without IntersectionObserver (old
 * WebViews, the test harness) it is true at once, so nothing waits forever.
 * Used to read things only once they are about to be seen.
 *
 * The app's own document is the root, so the margin also works when the
 * app runs in a frame (Hub and GO show it in one). Where a document can't
 * be the root, the viewport is.
 */
import { useEffect, useState } from 'react';

export function useInView(node: Element | null, rootMargin = '300px'): boolean {
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (seen || !node) return;
    let observer: IntersectionObserver;
    const make = (options: IntersectionObserverInit) =>
      new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      }, options);
    try {
      observer = make({ root: document, rootMargin });
    } catch {
      observer = make({ rootMargin });
    }
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, seen, rootMargin]);
  return seen;
}
