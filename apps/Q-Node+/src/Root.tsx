import { useAtomValue } from 'jotai';
import { I18nextProvider } from 'react-i18next';
import { HubThemeProvider } from './hub-theme';
import i18n from './i18n/i18n';
import { themeConfig, THEME_STORAGE_KEY } from './theme/qplus-theme';
import { hostModeAtom } from './state/global/system';
import { Routes } from './routes/Routes';

export function Root() {
  // The kit reads Hub's mode once when it mounts; a new key re-reads it
  // after Hub sends THEME_CHANGED (see useIframe).
  const hostMode = useAtomValue(hostModeAtom);
  return (
    // qapp-core registers its own i18next instance as react-i18next's global
    // default, so this app's instance is passed through context explicitly.
    <I18nextProvider i18n={i18n}>
      <HubThemeProvider
        key={hostMode}
        storageKey={THEME_STORAGE_KEY}
        config={themeConfig}
      >
        <Routes />
      </HubThemeProvider>
    </I18nextProvider>
  );
}
