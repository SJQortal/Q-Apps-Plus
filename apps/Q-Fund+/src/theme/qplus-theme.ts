import type { AppThemeConfig } from "../hub-theme";
import { darkThemeOptions, lightThemeOptions } from "../styles/theme";

/** localStorage key for the chosen theme; the boot snippet in index.html reads the same key. */
export const THEME_STORAGE_KEY = "qfundplus-ui-theme";

/** The original Q-Fund look, offered as the "Q-Fund Classic" (Hub 2.0) theme. */
export const themeConfig: AppThemeConfig = {
  hub20: {
    name: "Q-Fund Classic",
    description: "The original Q-Fund purples and teal",
    swatches: ["#1C1A26", "#434259", "#6B6FBF", "#34BFA6"],
    bootBackground: { light: "#ffffff", dark: "#1C1A26" },
  },
  hub20Options: mode => (mode === "dark" ? darkThemeOptions : lightThemeOptions),
};
