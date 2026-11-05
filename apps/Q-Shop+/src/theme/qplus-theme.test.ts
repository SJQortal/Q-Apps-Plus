import { describe, expect, it } from "vitest";
import { getContrastRatio } from "@mui/material/styles";
import { createAppTheme, UI_THEME_IDS, type ColorMode } from "../hub-theme";
import { themeConfig } from "./qplus-theme";

const MODES: ColorMode[] = ["light", "dark"];

/** Paper and page colours as painted (the kit's surfaces can be translucent; these are not). */
const surfaces = (theme: ReturnType<typeof createAppTheme>) =>
  [theme.palette.background.default, theme.palette.background.paper].filter((c) => c.startsWith("#"));

describe("Q-Shop Classic (Hub 2.0) contrast", () => {
  for (const mode of MODES) {
    it(`reads at 4.5:1 or better in ${mode} mode`, () => {
      const theme = createAppTheme("hub20", mode, themeConfig);
      const p = theme.palette;
      for (const surface of surfaces(theme)) {
        expect(getContrastRatio(p.text.primary, surface)).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(p.text.secondary, surface)).toBeGreaterThanOrEqual(4.5);
        // Primary is the accent of links, selected items and outlined buttons.
        expect(getContrastRatio(p.primary.main, surface)).toBeGreaterThanOrEqual(4.5);
      }
      // Contained buttons: their text on their fill.
      expect(getContrastRatio(p.primary.contrastText, p.primary.main)).toBeGreaterThanOrEqual(4.5);
      expect(getContrastRatio(p.secondary.contrastText, p.secondary.main)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("keeps the original surfaces and font", () => {
    const light = createAppTheme("hub20", "light", themeConfig);
    const dark = createAppTheme("hub20", "dark", themeConfig);
    expect(light.palette.background.default).toBe("#fcfcfc");
    expect(dark.palette.background.default).toBe("#111111");
    expect(String(light.typography.fontFamily)).toMatch(/^Raleway/);
  });

  it("every theme builds in both modes", () => {
    for (const id of UI_THEME_IDS) {
      for (const mode of MODES) expect(createAppTheme(id, mode, themeConfig).palette.primary.main).toBeTruthy();
    }
  });
});
