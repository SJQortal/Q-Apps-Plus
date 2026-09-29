import type { AppThemeConfig } from "../hub-theme";
import { darkThemeOptions, lightThemeOptions } from "../styles/theme";

/** localStorage key for the chosen theme; must match the boot snippet in index.html. */
export const THEME_STORAGE_KEY = "qshareplus-ui-theme";

export const themeConfig: AppThemeConfig = {
  hub20: {
    name: "Q-Share Classic",
    description: "The original Q-Share electric blue",
    swatches: ["#1C1C1C", "#342F41", "#007FFF", "#fcfcfc"],
    bootBackground: { light: "#fcfcfc", dark: "#1C1C1C" },
  },
  hub20Options: (mode) => (mode === "dark" ? darkThemeOptions : lightThemeOptions),
};
