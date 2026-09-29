import { useAtomValue } from "jotai";
import { BrowserRouter } from "react-router-dom";
import { HubThemeProvider } from "./hub-theme";
import { themeConfig, THEME_STORAGE_KEY } from "./theme/qplus-theme";
import { hostModeAtom } from "./state/hostMode";
import { IndexedDBProvider } from "./contexts/indexedDBContext";
import App from "./App";

const baseUrl = (window as Window & { _qdnBase?: string })._qdnBase || "";

export function Root() {
  // The kit reads Hub's mode once when it mounts; a new key re-reads it
  // after Hub sends THEME_CHANGED (see useHubMessages).
  const hostMode = useAtomValue(hostModeAtom);
  return (
    <HubThemeProvider key={hostMode} storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      <BrowserRouter basename={baseUrl}>
        <IndexedDBProvider>
          <App />
        </IndexedDBProvider>
      </BrowserRouter>
    </HubThemeProvider>
  );
}
