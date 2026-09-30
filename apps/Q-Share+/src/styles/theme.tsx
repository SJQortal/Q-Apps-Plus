import type { ThemeOptions } from "@mui/material/styles";

/**
 * The original Q-Share look. It is offered as the "Q-Share Classic" (Hub 2.0)
 * theme by src/theme/qplus-theme.ts; the default look now comes from the
 * theme kit in src/hub-theme.
 */
const commonThemeOptions: ThemeOptions = {
  typography: {
    fontFamily: ["Cambon Light", "Raleway, sans-serif", "Cairo", "Arial"].join(","),
    h1: {
      fontSize: "2rem",
      fontWeight: 600
    },
    h2: {
      fontSize: "1.75rem",
      fontWeight: 500
    },
    h3: {
      fontSize: "1.5rem",
      fontWeight: 500
    },
    h4: {
      fontSize: "1.25rem",
      fontWeight: 500
    },
    h5: {
      fontSize: "1rem",
      fontWeight: 500
    },
    h6: {
      fontSize: "0.875rem",
      fontWeight: 500
    },
    body1: {
      fontSize: "23px",
      fontFamily: "Raleway",
      fontWeight: 400,
      lineHeight: 1.5,
      letterSpacing: "0.5px"
    },

    body2: {
      fontSize: "18px",
      fontFamily: "Raleway, Arial",
      fontWeight: 400,
      lineHeight: 1.4,
      letterSpacing: "0.2px"
    }
  },
  spacing: 8,
  shape: {
    borderRadius: 4
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536
    }
  },
  components: {
    MuiButton: {
      styleOverrides: {
        // The original set backgroundColor: "inherit" here, which the + app's
        // contained buttons (Download, Publish) cannot live with: they lost
        // their fill and read as plain text.
        root: {
          transition: "filter 0.3s ease-in-out",
          "&:hover": {
            filter: "brightness(1.1)"
          }
        }
      },
      defaultProps: {
        disableElevation: true,
        disableRipple: true
      }
    }
  }
};

export const lightThemeOptions: ThemeOptions = {
  ...commonThemeOptions,
  palette: {
    mode: "light",
    // The original used a white "primary" as a surface colour and its blue as
    // "secondary". MUI components colour every control from primary, so the
    // blue is primary here; the whites live on as the backgrounds below.
    // A step darker than the original #417Ed4 so text and outlines on the
    // white surfaces reach 4.5:1 (docs/DESIGN.md); the original stays as "light".
    primary: {
      main: "#2f63b0",
      dark: "#264f8d",
      light: "#417Ed4"
    },
    secondary: {
      main: "#2f63b0",
      dark: "#264f8d"
    },
    // Fills take black or white text only when it reads at 4.5:1.
    contrastThreshold: 4.5,
    background: {
      default: "#fcfcfc",
      paper: "#F5F5F5"
    },
    text: {
      primary: "#000000",
      secondary: "#525252"
    }
  },
  components: {
    ...commonThemeOptions.components,
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
              "rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.06) 0px 2px 4px -1px;"
          }
        }
      }
    },
    MuiIcon: {
      defaultProps: {
        style: {
          color: "#000000"
        }
      }
    }
  }
};

export const darkThemeOptions: ThemeOptions = {
  ...commonThemeOptions,
  palette: {
    mode: "dark",
    // Electric blue, one step lighter than the original #007FFF: on the deep
    // purple paper the original read at 3.4:1 as text, this reads at 5:1
    // (docs/DESIGN.md asks for 4.5:1). The original hue stays as "dark".
    primary: {
      main: "#4DA6FF",
      dark: "#007FFF",
      light: "#7ABFFF"
    },
    secondary: {
      main: "#4DA6FF",
      dark: "#007FFF",
      light: "#7ABFFF"
    },
    // Fills take black or white text only when it reads at 4.5:1.
    contrastThreshold: 4.5,
    background: {
      default: "#1C1C1C", // Deep space black
      paper: "#342F41" // Dark cyberpunk-style purple
    },
    text: {
      primary: "#ffffff",
      secondary: "#b3b3b3"
    }
  },
  components: {
    ...commonThemeOptions.components,
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          borderRadius: "8px",
          transition: "all 0.3s ease-in-out",
          "&:hover": {
            cursor: "pointer",
            boxShadow: "0px 3px 4px 0px hsla(0,0%,0%,0.14), 0px 3px 3px -2px hsla(0,0%,0%,0.12), 0px 1px 8px 0px hsla(0,0%,0%,0.2);"
          }
        }
      }
    },
    MuiIcon: {
      defaultProps: {
        style: {
          color: "#ffffff"
        }
      }
    }
  }
};
