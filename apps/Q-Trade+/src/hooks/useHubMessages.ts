import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { hostModeAtom } from "../state/hostMode";

/**
 * Hub talks to the app with postMessage: THEME_CHANGED when its light/dark
 * mode flips, NAVIGATE_TO_PATH for its back button and deep links.
 * (App.tsx handles the trade-related messages, LOGOUT and RESPONSE_FOR_TRADES.)
 */
export function useHubMessages() {
  const setHostMode = useSetAtom(hostModeAtom);
  const navigate = useNavigate();

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.action === "THEME_CHANGED" && (data.theme === "dark" || data.theme === "light")) {
        // The theme kit reads _qdnTheme when its provider mounts.
        (window as Window & { _qdnTheme?: string })._qdnTheme = data.theme;
        setHostMode(data.theme);
      } else if (data.action === "NAVIGATE_TO_PATH" && typeof data.path === "string") {
        navigate(data.path);
        window.parent?.postMessage({ action: "NAVIGATION_SUCCESS", path: data.path }, "*");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [navigate, setHostMode]);
}
