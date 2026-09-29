import { useAtomValue } from 'jotai';
import { HubThemeProvider } from './hub-theme';
import { themeConfig, THEME_STORAGE_KEY } from './theme/qplus-theme';
import { hostModeAtom } from './state/global/system';
import { Routes } from './Routes';

export function Root() {
  // The kit reads Hub's mode once when it mounts; a new key re-reads it
  // after Hub sends THEME_CHANGED (see useIframe).
  const hostMode = useAtomValue(hostModeAtom);
  return (
    <HubThemeProvider key={hostMode} storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      <Routes />
    </HubThemeProvider>
  );
}
