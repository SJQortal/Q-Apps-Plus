/**
 * Opens and closes what it holds smoothly (comment threads): its height
 * follows the content as it opens, as it loads (a skeleton giving way to the
 * thread, avatars, bodies arriving) and as it closes, so what is below glides
 * instead of jumping. The content fades in as it opens; it mounts on opening
 * and unmounts once closed, and can't be reached by keyboard while closing.
 * It never anchors the page's scroll, so closing a thread doesn't pull the
 * page with it.
 *
 * Something open from the start (an item's own page) shows at its natural
 * height with no motion until it is first closed. Reduced motion (index.css)
 * makes it instant; a close that gets no transitionend (no transition at
 * all) ends on a timer.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Box } from '@mui/material';

/** Longer than a state change (150–200 ms): a thread can be tall. */
const GROW_MS = 260;

export function SmoothReveal({ open, children }: { open: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(open);
  // Open from the start: natural height, no motion, until it is first closed.
  const [natural, setNatural] = useState(open);
  const [height, setHeight] = useState(0);
  const [fade, setFade] = useState(false);
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  if (open && !mounted) {
    setMounted(true);
    setFade(true);
    setHeight(0);
  }

  // Opening, and while open: follow the content's height.
  useLayoutEffect(() => {
    if (!open || !mounted || natural) return;
    const content = inner.current;
    const box = outer.current;
    if (!content || !box) return;
    // The height on screen is laid out first, so the change to the content's height animates.
    void box.offsetHeight;
    setHeight(content.offsetHeight);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setHeight(content.offsetHeight));
    observer.observe(content);
    return () => observer.disconnect();
  }, [open, mounted, natural]);

  // Closing: from the height on screen down to 0, then unmount.
  useLayoutEffect(() => {
    if (open || !mounted) return;
    const box = outer.current;
    if (!box) return;
    if (natural) {
      // From its natural height: fix it in pixels first, so the change to 0 animates.
      box.style.height = `${box.offsetHeight}px`;
      void box.offsetHeight;
      setNatural(false);
    }
    setHeight(0);
  }, [open, mounted, natural]);
  useEffect(() => {
    if (open || !mounted) return;
    const timer = setTimeout(() => setMounted(false), GROW_MS + 120);
    return () => clearTimeout(timer);
  }, [open, mounted]);

  if (!mounted) return null;
  return (
    <Box
      ref={outer}
      inert={!open || undefined}
      onTransitionEnd={(event) => {
        if (event.target === outer.current && event.propertyName === 'height' && !open)
          setMounted(false);
      }}
      // Inline: the height changes often while a thread loads; a class per height would pile up.
      style={{ height: natural ? 'auto' : height }}
      sx={{
        overflow: 'clip',
        overflowClipMargin: '4px',
        overflowAnchor: 'none',
        transition: `height ${GROW_MS}ms var(--qmp-ease-enter)`,
      }}
    >
      <Box
        ref={inner}
        sx={{
          display: 'flow-root',
          animation: fade ? `qmp-fade-in ${GROW_MS}ms var(--qmp-ease-fade)` : undefined,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
