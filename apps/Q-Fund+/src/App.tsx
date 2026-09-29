import { useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { darkTheme, lightTheme } from './styles/theme';
import { store } from './state/store';
import { Provider } from 'react-redux';
import GlobalWrapper from './wrappers/GlobalWrapper';
import Notification from './components/common/Notification/Notification';
import { Home } from './pages/Home/Home';
import DownloadWrapper from './wrappers/DownloadWrapper';
import { Crowdfund } from './pages/Crowdfund/Crowdfund';

function App() {
  // const themeColor = window._qdnTheme

  const [theme, setTheme] = useState('dark');

  return (
    <Provider store={store}>
      <ThemeProvider theme={theme === 'light' ? lightTheme : darkTheme}>
        <Notification />
        <DownloadWrapper>
          <GlobalWrapper setTheme={(val: string) => setTheme(val)}>
            <CssBaseline />
            <Routes>
              <Route
                path="/"
                element={<Home setTheme={(val: string) => setTheme(val)} />}
              />
              <Route path="/crowdfund/:name/:id" element={<Crowdfund />} />
            </Routes>
          </GlobalWrapper>
        </DownloadWrapper>
      </ThemeProvider>
    </Provider>
  );
}

export default App;
