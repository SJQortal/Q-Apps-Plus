import type { AppThemeConfig } from "../hub-theme";
import { darkThemeOptions, lightThemeOptions } from "../styles/theme";

/** localStorage key for the chosen look. Must match STORAGE_KEY in index.html. */
export const THEME_STORAGE_KEY = "qtradeplus-ui-theme";

export const themeConfig: AppThemeConfig = {
  hub20: {
    name: "Q-Trade Classic",
    description: "The original Q-Trade greys and blue",
    swatches: ["#27282c", "#292929", "#323336", "#0085ff"],
    bootBackground: { light: "#f4f5f7", dark: "#27282c" },
  },
  hub20Options: (mode) => (mode === "dark" ? darkThemeOptions : lightThemeOptions),
};
