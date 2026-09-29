import { Routes, Route } from "react-router-dom";
import { store } from "./state/store";
import { Provider } from "react-redux";
import { HubThemeProvider } from "./hub-theme";
import { themeConfig, THEME_STORAGE_KEY } from "./theme/qplus-theme";
import GlobalWrapper from "./wrappers/GlobalWrapper";
import Notification from "./components/common/Notification/Notification";
import { Home } from "./pages/Home/Home";
import { FileContent } from "./pages/FileContent/FileContent.tsx";
import DownloadWrapper from "./wrappers/DownloadWrapper";
import { IndividualProfile } from "./pages/IndividualProfile/IndividualProfile";
import { Settings } from "./pages/Settings/Settings";

function App() {
  return (
    <Provider store={store}>
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        <Notification />
        <DownloadWrapper>
          <GlobalWrapper>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/share/:name/:id" element={<FileContent />} />
              <Route path="/channel/:name" element={<IndividualProfile />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </GlobalWrapper>
        </DownloadWrapper>
      </HubThemeProvider>
    </Provider>
  );
}

export default App;
