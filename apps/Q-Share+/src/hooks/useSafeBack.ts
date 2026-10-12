import { useCallback, useEffect } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";

/**
 * The app's own back stack. Every Hub tab is an iframe in one Hub document,
 * so `window.history` is shared: `history.length` counts other tabs' entries
 * and `navigate(-1)` can move a hidden tab instead of this one. Back buttons
 * therefore navigate to the previous in-app path, or to a parent page when
 * the app was opened on this page (a deep link or Hub's reload).
 */
const stack: string[] = [];
let goingBack = false;

/** Mount once, inside the router (GlobalWrapper). */
export function useTrackInAppHistory(): void {
  const location = useLocation();
  const type = useNavigationType();
  useEffect(() => {
    const path = location.pathname + location.search;
    if (goingBack) {
      goingBack = false;
      return;
    }
    // Returning to the page below the top (browser Back, or Hub's Back, which
    // arrives as a navigation to the previous path) pops instead of pushing.
    if (type === "REPLACE" && stack.length) stack[stack.length - 1] = path;
    else if (stack.length > 1 && stack[stack.length - 2] === path) stack.pop();
    else if (stack[stack.length - 1] !== path) stack.push(path);
  }, [location, type]);
}

/** A Back handler: the previous in-app page, else `fallback` (replacing this entry). */
export function useSafeBack(fallback = "/"): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    if (stack.length > 1) {
      stack.pop();
      goingBack = true;
      navigate(stack[stack.length - 1]);
    } else {
      navigate(fallback, { replace: true });
    }
  }, [fallback, navigate]);
}

/** Test hook: forget the stack between tests. */
export function resetInAppHistory(): void {
  stack.length = 0;
  goingBack = false;
}
