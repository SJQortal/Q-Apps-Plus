import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import { store } from "./state/store";
import { Provider } from "react-redux";
import { HubThemeProvider } from "./hub-theme";
import { themeConfig, THEME_STORAGE_KEY } from "./theme/qplus-theme";
import GlobalWrapper from "./wrappers/GlobalWrapper";
import Notification from "./components/common/Notification/Notification";
import { Home } from "./pages/Home/Home";
import DownloadWrapper from "./wrappers/DownloadWrapper";
import PageLoader from "./components/common/PageLoader";

const FileContent = lazy(() =>
  import("./pages/FileContent/FileContent.tsx").then((m) => ({ default: m.FileContent }))
);
const IndividualProfile = lazy(() =>
  import("./pages/IndividualProfile/IndividualProfile").then((m) => ({ default: m.IndividualProfile }))
);
const Settings = lazy(() => import("./pages/Settings/Settings").then((m) => ({ default: m.Settings })));

function App() {
  return (
    <Provider store={store}>
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        <Notification />
        <DownloadWrapper>
          <GlobalWrapper>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/share/:name/:id" element={<FileContent />} />
                <Route path="/channel/:name" element={<IndividualProfile />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Suspense>
          </GlobalWrapper>
        </DownloadWrapper>
      </HubThemeProvider>
    </Provider>
  );
}

export default App;
