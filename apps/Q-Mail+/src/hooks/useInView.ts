import { useEffect, useState } from 'react';

/**
 * True once `node` has come within 200 px of the viewport (and from then on).
 * Where IntersectionObserver does not exist, everything counts as in view.
 * Rows use it so their Hub requests (saved-subject decrypts, recipient
 * lookups) wait until the row can be seen, as avatars already do.
 */
export function useInView(node: Element | null): boolean {
  const [visible, setVisible] = useState<boolean>(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (visible) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    // The ref callback sets `node` after the first render: wait for it.
    if (!node) return;
    let observer: IntersectionObserver | null = null;
    try {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setVisible(true);
            observer?.disconnect();
          }
        },
        { rootMargin: '200px' }
      );
      observer.observe(node);
    } catch {
      setVisible(true);
    }
    return () => observer?.disconnect();
  }, [node, visible]);

  return visible;
}
