import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface NavigateMessage {
  action?: string;
  path?: string;
}

/**
 * The router path for a path Hub sends. Hub takes it from a `qortal://APP/<app>/…`
 * link without the leading slash ("share/alice/x"), and the router would read
 * that relative to the current page ("/settings/share/alice/x").
 */
export function hubPathToRoute(path: string): string {
  return `/${path.replace(/^\/+/, "")}`;
}

/**
 * Hub sends `NAVIGATE_TO_PATH` into the iframe for deep links (a notification
 * or a link opened while the app's tab is already open) and its back button;
 * answer with `NAVIGATION_SUCCESS` once the router has moved, echoing the path
 * as sent, or Hub reloads the whole app at that path after 250 ms.
 */
export const useIframe = () => {
  const navigate = useNavigate();
  useEffect(() => {
    function handleNavigation(event: MessageEvent<NavigateMessage>) {
      // Only Hub, the parent window, may move the app.
      if (event.source !== window.parent) return;
      const data = event.data;
      if (data?.action === "NAVIGATE_TO_PATH" && typeof data.path === "string" && data.path) {
        navigate(hubPathToRoute(data.path));
        window.parent.postMessage({ action: "NAVIGATION_SUCCESS", path: data.path }, "*");
      }
    }

    window.addEventListener("message", handleNavigation);

    return () => {
      window.removeEventListener("message", handleNavigation);
    };
  }, [navigate]);
  return { navigate };
};
