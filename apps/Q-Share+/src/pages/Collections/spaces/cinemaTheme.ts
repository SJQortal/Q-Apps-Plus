import { alpha, createTheme, getContrastRatio, lighten, type SxProps, type Theme } from "@mui/material/styles";

/**
 * The cinema's own dark look, whatever the app's theme: the same type, spacing
 * and shape, with a palette built from black and white. The app's component
 * overrides are left out, because they close over the app's colours. The app's
 * primary stays on as a soft accent, when it can be read on black.
 */
export function cinemaTheme(outer: Theme): Theme {
  const { black, white } = outer.palette.common;
  const main = outer.palette.primary.main;
  const accent = getContrastRatio(main, black) >= 4.5 ? main : lighten(main, 0.55);
  const { palette } = createTheme({
    palette: {
      mode: "dark",
      contrastThreshold: 4.5,
      primary: { main: white, contrastText: black },
      secondary: { main: getContrastRatio(accent, black) >= 4.5 ? accent : white },
      background: { default: lighten(black, 0.05), paper: lighten(black, 0.11) },
      text: { primary: white, secondary: alpha(white, 0.76) },
      divider: alpha(white, 0.16),
    },
  });
  return {
    ...outer,
    palette: {
      ...outer.palette,
      ...palette,
      background: {
        ...outer.palette.background,
        ...palette.background,
        surface: palette.background.paper,
        elevated: lighten(black, 0.16),
      },
    },
    components: {
      MuiAvatar: { styleOverrides: { colorDefault: { backgroundColor: alpha(white, 0.76), color: black } } },
      MuiButtonBase: {
        styleOverrides: { root: { "&.Mui-focusVisible": { outline: `2px solid ${white}`, outlineOffset: 2 } } },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { textTransform: "none", fontWeight: 700, padding: "8px 18px" } },
      },
      MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    },
  };
}

const TINTS = ["secondary", "info", "success", "warning"] as const;

/** A steady pick for a share, so its poster keeps its colour from one visit to the next. */
function tintOf(seed: string): (typeof TINTS)[number] {
  let sum = 0;
  for (let i = 0; i < seed.length; i++) sum = (sum * 31 + seed.charCodeAt(i)) % 9973;
  return TINTS[sum % TINTS.length];
}

/** Where a picture is missing: a strip of film, a soft colour and a sprocket row along each edge. */
export function filmFrame(seed: string): SxProps<Theme> {
  return (theme) => {
    const { black, white } = theme.palette.common;
    const holes = `repeating-linear-gradient(90deg, ${alpha(white, 0.2)} 0 8px, transparent 8px 20px)`;
    return {
      backgroundColor: lighten(black, 0.08),
      backgroundImage: `${holes}, ${holes}, linear-gradient(135deg, ${alpha(theme.palette[tintOf(seed)].main, 0.34)}, ${lighten(black, 0.08)} 72%)`,
      backgroundSize: "100% 6px, 100% 6px, 100% 100%",
      backgroundPosition: "0 6px, 0 calc(100% - 6px), 0 0",
      backgroundRepeat: "no-repeat",
    };
  };
}

export const REDUCED_MOTION = "@media (prefers-reduced-motion: reduce)";
