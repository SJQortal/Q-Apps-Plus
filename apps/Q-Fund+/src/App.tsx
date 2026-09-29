import { Route, Routes } from 'react-router-dom';
import { store } from './state/store';
import { Provider } from 'react-redux';
import GlobalWrapper from './wrappers/GlobalWrapper';
import Notification from './components/common/Notification/Notification';
import { Home } from './pages/Home/Home';
import DownloadWrapper from './wrappers/DownloadWrapper';
import { Crowdfund } from './pages/Crowdfund/Crowdfund';
import { Settings } from './pages/Settings/Settings';
import { HubThemeProvider } from './hub-theme';
import { themeConfig, THEME_STORAGE_KEY } from './theme/qplus-theme';

function App() {
  return (
    <Provider store={store}>
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        <Notification />
        <DownloadWrapper>
          <GlobalWrapper>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/crowdfund/:name/:id" element={<Crowdfund />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </GlobalWrapper>
        </DownloadWrapper>
      </HubThemeProvider>
    </Provider>
  );
}

export default App;
