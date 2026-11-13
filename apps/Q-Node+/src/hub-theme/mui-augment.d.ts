import '@mui/material/styles';
import type { ChromeTokens, UiThemeId } from './tokens';

export interface QPlusThemeTokens extends ChromeTokens {
  id: UiThemeId;
}

declare module '@mui/material/styles' {
  interface Theme {
    qplus: QPlusThemeTokens;
  }
  interface ThemeOptions {
    qplus?: Partial<QPlusThemeTokens>;
  }
  interface TypeBackground {
    surface?: string;
    elevated?: string;
  }
}
