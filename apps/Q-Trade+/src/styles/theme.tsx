/**
 * The original Q-Trade theme, kept as the "Q-Trade Classic" (Hub 2.0) option.
 * Only the palette, type and shape live here; the layout is the + one. The
 * upstream app was dark only; the light variant keeps its blue on light greys.
 */
import type { ThemeOptions } from "@mui/material/styles";

const commonThemeOptions: ThemeOptions = {
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: { scrollBehavior: "smooth" },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          transition: "filter 0.3s ease-in-out",
          "&:hover": { filter: "brightness(1.1)" },
        },
      },
      defaultProps: { disableElevation: true, disableRipple: true },
    },
    MuiCard: {
      styleOverrides: {
        root: { boxShadow: "none", borderRadius: "8px" },
      },
    },
    MuiDialog: {
      styleOverrides: { paper: { backgroundImage: "none" } },
    },
    MuiPopover: {
      styleOverrides: { paper: { backgroundImage: "none" } },
    },
  },
  typography: {
    // Upstream listed Fira Sans first but never shipped a working file for it,
    // so what users actually saw was Fredoka One, with Inter in the tables.
    fontFamily: "'Fredoka One', 'Inter', sans-serif",
    button: { textTransform: "none" },
    h1: { fontSize: "42px" },
    h2: { fontSize: "32px" },
    h3: { fontSize: "21px" },
    h4: { fontSize: "18px" },
    h5: { fontSize: "16px" },
    h6: { fontSize: "14px" },
    body1: { fontSize: "1rem" },
    body2: { fontSize: "0.875rem" },
  },
  spacing: 8,
  shape: { borderRadius: 4 },
  breakpoints: { values: { xs: 0, sm: 600, md: 900, lg: 1280, xl: 1920 } },
};

export const darkThemeOptions: ThemeOptions = {
  ...commonThemeOptions,
  palette: {
    mode: "dark",
    primary: { main: "#0085ff", light: "#70BAFF", contrastText: "#ffffff" },
    secondary: { main: "#F29999" },
    background: { default: "#27282c", paper: "#292929", surface: "#323336", elevated: "#3a3b40" },
    text: { primary: "#ffffff", secondary: "rgba(255, 255, 255, 0.62)" },
    divider: "rgba(255, 255, 255, 0.14)",
  },
  components: {
    ...commonThemeOptions.components,
    MuiCssBaseline: {
      styleOverrides: {
        html: { scrollBehavior: "smooth" },
        "body::-webkit-scrollbar-track": { backgroundColor: "#27282c" },
        "body::-webkit-scrollbar": { width: "16px", height: "10px", backgroundColor: "#27282c" },
        "body::-webkit-scrollbar-thumb": {
          backgroundColor: "#171a27",
          borderRadius: "8px",
          backgroundClip: "content-box",
          border: "4px solid transparent",
        },
        "body::-webkit-scrollbar-thumb:hover": { backgroundColor: "#0e1018" },
      },
    },
  },
};

export const lightThemeOptions: ThemeOptions = {
  ...commonThemeOptions,
  palette: {
    mode: "light",
    primary: { main: "#0085ff", light: "#70BAFF", contrastText: "#ffffff" },
    secondary: { main: "#d9534f" },
    background: { default: "#f4f5f7", paper: "#ffffff", surface: "#eceef1", elevated: "#e3e6ea" },
    text: { primary: "rgba(0, 0, 0, 0.87)", secondary: "rgba(0, 0, 0, 0.6)" },
    divider: "rgba(0, 0, 0, 0.12)",
  },
};
