import type { AppThemeConfig } from "../hub-theme";
import { darkThemeOptions, lightThemeOptions } from "../styles/theme";

import { THEME_STORAGE_KEY } from "../constants/plus";

/** localStorage key for the chosen theme (JSON string, e.g. "hub30"), from constants/plus. */
export { THEME_STORAGE_KEY };

export const themeConfig: AppThemeConfig = {
  hub20: {
    name: "Q-Shop Classic",
    description: "The original Q-Shop blue on near-black or off-white",
    swatches: ["#111111", "#1A1C1E", "#5b93e3", "#fcfcfc"],
    bootBackground: { light: "#fcfcfc", dark: "#111111" },
  },
  hub20Options: (mode) => (mode === "dark" ? darkThemeOptions : lightThemeOptions),
};
