import { useEffect, useState } from 'react';

/** True while the user scrolls down past the header; false again on scroll up. */
export function useHideOnScroll(enabled: boolean, threshold = 64): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let last = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y <= threshold) setHidden(false);
        else if (y > last + 4) setHidden(true);
        else if (y < last - 4) setHidden(false);
        last = y;
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [enabled, threshold]);
  return enabled && hidden;
}
