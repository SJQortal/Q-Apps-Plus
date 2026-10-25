import { useAtomValue } from 'jotai';
import Notification from './components/common/Notification/Notification';
import { HubThemeProvider } from './hub-theme';
import { Routes } from './Routes.tsx';
import { hostModeAtom } from './state/global/theme';
import { PaletteExtender } from './theme/PaletteExtender';
import { themeConfig, THEME_STORAGE_KEY } from './theme/qplus-theme';

function App() {
  // The kit reads Hub's mode once when it mounts; a new key re-reads it
  // after Hub sends THEME_CHANGED (see useIframe).
  const hostMode = useAtomValue(hostModeAtom);
  return (
    <HubThemeProvider key={hostMode} storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      <PaletteExtender>
        <Notification />
        <Routes />
      </PaletteExtender>
    </HubThemeProvider>
  );
}

export default App;
