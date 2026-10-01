import { useState, useEffect } from 'react';

export interface WindowSize {
  width: number | undefined;
}

/** The window's inner width, updated on resize. Prefer `usePhoneLayout()` for breakpoints. */
export function useWindowSize(): WindowSize {
  const [windowSize, setWindowSize] = useState<WindowSize>({
    width: undefined,
  });

  useEffect(() => {
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
      });
    }

    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return windowSize;
}
