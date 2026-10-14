/**
 * Wrap the app in this once, near the root:
 *
 *   <HubThemeProvider storageKey="qmailplus-ui-theme" config={themeConfig}>
 *     <App />
 *   </HubThemeProvider>
 *
 * It picks the MUI theme from the saved choice and Hub's light/dark mode,
 * exposes CSS variables for plain CSS, and lets Settings change the theme
 * through `useHubTheme()`.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CssBaseline, GlobalStyles } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { applyDocumentChrome, hostModeFromMessage, readHostMode, readStoredUiTheme, writeStoredUiTheme } from './boot';
import { createAppTheme, tokensFromTheme, type AppThemeConfig } from './mui-theme';
import { cssVariables, resolveMode, type ColorMode, type UiThemeId } from './tokens';

interface HubThemeContextValue {
  uiTheme: UiThemeId;
  setUiTheme: (id: UiThemeId) => void;
  /** The mode actually shown (Black is always dark, White always light). */
  mode: ColorMode;
  /** The light/dark mode Hub asked for. */
  hostMode: ColorMode;
  config: AppThemeConfig;
}

const HubThemeContext = createContext<HubThemeContextValue | null>(null);

export function useHubTheme(): HubThemeContextValue {
  const value = useContext(HubThemeContext);
  if (!value) throw new Error('useHubTheme must be used inside <HubThemeProvider>');
  return value;
}

interface HubThemeProviderProps {
  /** localStorage key, unique per app, e.g. "qmailplus-ui-theme". */
  storageKey: string;
  config: AppThemeConfig;
  children: ReactNode;
}

export function HubThemeProvider({ storageKey, config, children }: HubThemeProviderProps) {
  const [uiTheme, setUiThemeState] = useState<UiThemeId>(() => readStoredUiTheme(storageKey));
  const [hostMode, setHostMode] = useState<ColorMode>(readHostMode);
  const mode = resolveMode(uiTheme, hostMode);

  const setUiTheme = useCallback(
    (id: UiThemeId) => {
      setUiThemeState(id);
      writeStoredUiTheme(storageKey, id);
    },
    [storageKey]
  );

  // Keep several open tabs of the same app in step.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey) setUiThemeState(readStoredUiTheme(storageKey));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storageKey]);

  // Follow Hub's own light/dark switch while the app is open; Hub does not reload the app.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const next = hostModeFromMessage(event.data);
      if (!next) return;
      // A remount (e.g. after an error boundary) reads the injected value again.
      (window as Window & { _qdnTheme?: string })._qdnTheme = next;
      setHostMode(next);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const theme = useMemo(() => createAppTheme(uiTheme, hostMode, config), [uiTheme, hostMode, config]);
  const cssVars = useMemo(() => cssVariables(tokensFromTheme(theme)), [theme]);

  useEffect(() => {
    applyDocumentChrome(uiTheme, hostMode, config.hub20);
  }, [uiTheme, hostMode, config.hub20]);

  const value = useMemo(
    () => ({ uiTheme, setUiTheme, mode, hostMode, config }),
    [uiTheme, setUiTheme, mode, hostMode, config]
  );

  return (
    <HubThemeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <GlobalStyles styles={{ ':root': cssVars }} />
        {children}
      </ThemeProvider>
    </HubThemeContext.Provider>
  );
}
