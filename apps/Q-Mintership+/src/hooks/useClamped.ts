/**
 * Whether a line-clamped element cuts its text off: measured, not guessed
 * from the text's length, and measured again when its size changes, so a
 * "Show the whole …" button only shows when there is more to show.
 */
import { useLayoutEffect, useState } from 'react';

export function useClamped(node: HTMLElement | null, text: string): boolean {
  const [clamped, setClamped] = useState(false);
  useLayoutEffect(() => {
    if (!node) return;
    const measure = () => setClamped(node.scrollHeight > node.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, text]);
  return clamped;
}
