import React, { FC, useEffect, useMemo } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, GlobalStyles } from '@mui/material';
import { resolveTorqTheme, UI_THEME_WHITE } from './theme';
import { HIDDEN_POST_MARKER } from '../../utils/contentFilters';
import { EnumTheme, themeAtom } from '../../state/global/system';
import { normalizeUiTheme, uiThemeAtom } from '../../state/global/settings';
import { applyDocumentChrome } from '../../utils/hubBoot';
import { useAtomValue } from 'jotai';

interface ThemeProviderWrapperProps {
  children: React.ReactNode;
}

const ThemeProviderWrapper: FC<ThemeProviderWrapperProps> = ({ children }) => {
  const themeMode = useAtomValue(themeAtom);
  const uiTheme = normalizeUiTheme(useAtomValue(uiThemeAtom));
  const mode =
    uiTheme === UI_THEME_WHITE
      ? 'light'
      : themeMode === EnumTheme.LIGHT
        ? 'light'
        : 'dark';
  const theme = useMemo(
    () => resolveTorqTheme(mode, uiTheme),
    [mode, uiTheme]
  );

  useEffect(() => {
    applyDocumentChrome(mode, uiTheme);
  }, [mode, uiTheme]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles
        styles={{
          ':root': {
            '--torq-accent': theme.palette.primary.main,
            '--torq-like': theme.palette.error.main,
            '--torq-repost': theme.palette.success.main,
            '--torq-chrome': theme.torq.chrome,
            '--torq-chrome-strong': theme.torq.chromeStrong,
            '--torq-chrome-soft': theme.torq.chromeSoft,
            '--torq-chrome-muted': theme.torq.chromeMuted,
            '--torq-chrome-faint': theme.torq.chromeFaint,
            '--torq-app-gradient': theme.torq.appGradient,
            '--scrollbar-thumb-active-color': theme.torq.primarySoft,
          },
          [`div:has(> [${HIDDEN_POST_MARKER}])`]: {
            display: 'none !important',
          },
        }}
      />
      {children}
    </ThemeProvider>
  );
};

export default ThemeProviderWrapper;
