import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface NavigateMessage {
  action?: string;
  path?: string;
}

/**
 * Hub sends `NAVIGATE_TO_PATH` into the iframe for deep links and its back
 * button; answer with `NAVIGATION_SUCCESS` once the router has moved.
 */
export const useIframe = () => {
  const navigate = useNavigate();
  useEffect(() => {
    function handleNavigation(event: MessageEvent<NavigateMessage>) {
      const data = event.data;
      if (data?.action === "NAVIGATE_TO_PATH" && typeof data.path === "string" && data.path) {
        navigate(data.path);
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
