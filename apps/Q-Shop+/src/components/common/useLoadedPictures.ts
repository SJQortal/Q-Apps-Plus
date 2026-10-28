import { useCallback, useState } from "react";

/**
 * Which pictures have loaded, so a picture's tinted backdrop (the placeholder
 * while it loads) can go once it is in: a product photo with a transparent
 * background then shows the card or page behind it, not a grey square
 * (Simon, 2026-10-22). A picture that fails keeps its backdrop.
 */
export function useLoadedPictures() {
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(() => new Set());
  const isLoaded = useCallback((src: string | null | undefined) => !!src && loaded.has(src), [loaded]);
  const onLoad = useCallback(
    (src: string | null | undefined) => () => {
      if (src) setLoaded((prev) => (prev.has(src) ? prev : new Set(prev).add(src)));
    },
    []
  );
  return { isLoaded, onLoad };
}
