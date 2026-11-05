import { describe, expect, it } from "vitest";
import { createTheme } from "@mui/material/styles";
import { darkThemeOptions, lightThemeOptions } from "./theme";
import { PHONE_MEDIA } from "../hooks/usePhoneLayout";

describe("Q-Shop Classic type sizes", () => {
  it("keeps the original 23/18 px body text on desktop and uses 16/14 px on phones", () => {
    for (const options of [lightThemeOptions, darkThemeOptions]) {
      const theme = createTheme(options);
      const body1 = theme.typography.body1 as Record<string, any>;
      const body2 = theme.typography.body2 as Record<string, any>;
      expect(body1.fontSize).toBe("23px");
      expect(body2.fontSize).toBe("18px");
      expect(body1[`@media ${PHONE_MEDIA}`]?.fontSize).toBe("16px");
      expect(body2[`@media ${PHONE_MEDIA}`]?.fontSize).toBe("14px");
    }
  });
});
