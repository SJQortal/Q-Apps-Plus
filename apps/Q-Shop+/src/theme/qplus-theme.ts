import type { AppThemeConfig } from "../hub-theme";
import { darkThemeOptions, lightThemeOptions } from "../styles/theme";

/** localStorage key for the chosen theme (JSON string, e.g. "hub30"). */
export const THEME_STORAGE_KEY = "qshopplus-ui-theme";

export const themeConfig: AppThemeConfig = {
  hub20: {
    name: "Q-Shop Classic",
    description: "The original Q-Shop navy and blue",
    swatches: ["#111111", "#1A1C1E", "#2e3d60", "#417Ed4"],
    bootBackground: { light: "#fcfcfc", dark: "#111111" },
  },
  hub20Options: (mode) => (mode === "dark" ? darkThemeOptions : lightThemeOptions),
};
