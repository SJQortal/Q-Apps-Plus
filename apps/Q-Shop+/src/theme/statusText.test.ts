import { describe, expect, it } from "vitest";
import { getContrastRatio } from "@mui/material/styles";
import { createAppTheme, UI_THEME_IDS, type ColorMode } from "../hub-theme";
import { themeConfig } from "./qplus-theme";
import { statusText, type StatusColor } from "./statusText";

const MODES: ColorMode[] = ["light", "dark"];
const STATUSES: StatusColor[] = ["warning", "success", "error"];

describe("status colours as text", () => {
  it("read at 4.5:1 on the page and on paper in every theme and mode", () => {
    for (const id of UI_THEME_IDS) {
      for (const mode of MODES) {
        const theme = createAppTheme(id, mode, themeConfig);
        for (const status of STATUSES) {
          const color = statusText(theme, status);
          for (const surface of [theme.palette.background.default, theme.palette.background.paper]) {
            expect(getContrastRatio(color, surface), `${status} in ${id} ${mode}`).toBeGreaterThanOrEqual(4.5);
          }
        }
      }
    }
  });

  it("keep the palette's own colour where it already reads", () => {
    const theme = createAppTheme("hub30", "dark", themeConfig);
    expect(statusText(theme, "error")).toBe(theme.palette.error.main);
  });

  it("darken MUI's warning orange on White", () => {
    const theme = createAppTheme("white", "light", themeConfig);
    expect(getContrastRatio(theme.palette.warning.main, theme.palette.background.paper)).toBeLessThan(4.5);
    expect(statusText(theme, "warning")).not.toBe(theme.palette.warning.main);
  });
});
