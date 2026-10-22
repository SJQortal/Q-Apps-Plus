import type { ThemeOptions } from "@mui/material/styles";

// Q-Shop's original look. The + app shows it as the "Q-Shop Classic" (Hub 2.0)
// theme through the hub-theme kit; the other three themes come from the kit.
//
// Kept from the original: the fonts and type sizes, the 4 px corners, the
// off-white / near-black surfaces, the cards, tooltips and scrollbars. Changed
// for contrast (docs/DESIGN.md asks for 4.5:1 on text and controls): the blue
// accent is "primary" in both modes, a step darker in light and a step lighter
// in dark than the original #417Ed4. The original's own light/dark options
// replaced its shared `components` (a MuiButton override), so that override
// never applied and is left out here too.

const commonThemeOptions: ThemeOptions = {
  typography: {
    // Raleway was hard-coded on most of the original components, so it is the
    // base font here; Cambon Light and Karla are the other two the app shipped.
    fontFamily: ["Raleway", "Cambon Light", "Karla", "Arial", "sans-serif"].join(","),
    h1: {
      fontSize: "2rem",
      fontWeight: 600,
    },
    h2: {
      fontSize: "1.75rem",
      fontWeight: 500,
    },
    h3: {
      fontSize: "1.5rem",
      fontWeight: 500,
    },
    h4: {
      fontSize: "1.25rem",
      fontWeight: 500,
    },
    h5: {
      fontSize: "1rem",
      fontWeight: 500,
    },
    h6: {
      fontSize: "0.875rem",
      fontWeight: 500,
    },
    body1: {
      fontSize: "23px",
      fontFamily: "Raleway",
      fontWeight: 400,
      lineHeight: 1.5,
      letterSpacing: "0.5px",
    },

    body2: {
      fontSize: "18px",
      fontFamily: "Raleway, Arial",
      fontWeight: 400,
      lineHeight: 1.4,
      letterSpacing: "0.2px",
    },
  },
  spacing: 8,
  shape: {
    borderRadius: 4,
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },
};

const lightThemeOptions: ThemeOptions = {
  ...commonThemeOptions,
  palette: {
    mode: "light",
    // The original used a white "primary" as a surface colour and its blue as
    // "secondary". MUI components (and the + app's shell) colour every
    // control from primary, so the blue is primary here, and the whites live
    // on as the backgrounds below. #417Ed4 read at 3.7:1 on the paper; this
    // reads at 5.4:1 as text, and white on it at 5.9:1. The original blue
    // stays as "light".
    primary: {
      main: "#2f63b0",
      dark: "#264f8d",
      light: "#417Ed4",
    },
    secondary: {
      main: "#2f63b0",
      dark: "#264f8d",
      light: "#417Ed4",
    },
    // Fills take black or white text only when it reads at 4.5:1.
    contrastThreshold: 4.5,
    background: {
      default: "#fcfcfc",
      paper: "#F5F5F5",
    },
    text: {
      primary: "#000000",
      secondary: "#525252",
    },
    // Unselected toggle buttons and icons use action.active; MUI's default
    // 54 % black read at 4.2:1 on the paper.
    action: {
      active: "rgba(0, 0, 0, 0.72)",
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        "body::-webkit-scrollbar-track": {
          backgroundColor: "#fcfcfc",
        },
        "body::-webkit-scrollbar-track:hover": {
          backgroundColor: "#fcfcfc",
        },
        "body::-webkit-scrollbar": {
          width: "16px",
          height: "10px",
          backgroundColor: "#fcfcfc",
        },
        "body::-webkit-scrollbar-thumb": {
          backgroundColor: "#417Ed4",
          borderRadius: "8px",
          backgroundClip: "content-box",
          border: "4px solid transparent",
          transition: "all 0.3s ease-in-out",
        },
        "body::-webkit-scrollbar-thumb:hover": {
          backgroundColor: "#3e74c1",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow:
            "rgba(0, 0, 0, 0.1) 0px 1px 3px 0px, rgba(0, 0, 0, 0.06) 0px 1px 2px 0px;",
          borderRadius: "8px",
          transition: "all 0.3s ease-in-out",
          "&:hover": {
            cursor: "pointer",
            boxShadow:
              "rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.06) 0px 2px 4px -1px;",
          },
        },
      },
    },
    MuiIcon: {
      defaultProps: {
        style: {
          color: "#000000",
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontFamily: "Karla",
          fontSize: "17px",
          letterSpacing: "0px",
          fontWeight: 300,
          backgroundColor: "#F5F5F5",
          color: "#000000",
          zIndex: 10,
          opacity: 1,
        },
        arrow: {
          color: "#F5F5F5",
        },
      },
    },
  },
};

const darkThemeOptions: ThemeOptions = {
  ...commonThemeOptions,
  palette: {
    mode: "dark",
    // The original's dark primary was its navy (#2e3d60), which reads at
    // 1.8:1 on the near-black page, and its blue (#417Ed4, secondary) read at
    // 4.2:1 on the paper. The blue, one step lighter, is primary here: 5.5:1
    // on the paper as text, with black text on it at 6.7:1. The navy stays on
    // the scrollbar, the original blue as "dark".
    primary: {
      main: "#5b93e3",
      dark: "#417Ed4",
      light: "#7fadeb",
    },
    secondary: {
      main: "#5b93e3",
      dark: "#417Ed4",
      light: "#7fadeb",
    },
    // Fills take black or white text only when it reads at 4.5:1.
    contrastThreshold: 4.5,
    background: {
      default: "#111111",
      paper: "#1A1C1E",
    },
    text: {
      primary: "#ffffff",
      secondary: "#b3b3b3",
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        "body::-webkit-scrollbar-track": {
          backgroundColor: "#111111",
        },
        "body::-webkit-scrollbar-track:hover": {
          backgroundColor: "#111111",
        },
        "body::-webkit-scrollbar": {
          width: "16px",
          height: "10px",
          backgroundColor: "#111111",
        },
        "body::-webkit-scrollbar-thumb": {
          backgroundColor: "#2e3d60",
          borderRadius: "8px",
          backgroundClip: "content-box",
          border: "4px solid transparent",
          transition: "all 0.3s ease-in-out",
        },
        "body::-webkit-scrollbar-thumb:hover": {
          backgroundColor: "#1a2744",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          borderRadius: "8px",
          transition: "all 0.3s ease-in-out",
          "&:hover": {
            cursor: "pointer",
            boxShadow:
              " 0px 3px 4px 0px hsla(0,0%,0%,0.14), 0px 3px 3px -2px hsla(0,0%,0%,0.12), 0px 1px 8px 0px hsla(0,0%,0%,0.2);",
          },
        },
      },
    },
    MuiIcon: {
      defaultProps: {
        style: {
          color: "#ffffff",
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontFamily: "Karla",
          fontSize: "17px",
          letterSpacing: "0px",
          fontWeight: 300,
          backgroundColor: "#1A1C1E",
          color: "white",
          zIndex: 10,
          opacity: 1,
        },
        arrow: {
          color: "#1A1C1E",
        },
      },
    },
  },
};
export { lightThemeOptions, darkThemeOptions };
