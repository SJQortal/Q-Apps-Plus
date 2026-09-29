import { createTheme } from "@mui/material/styles";

const commonThemeOptions = createTheme({
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ":root": {
          padding: "0px",
          margin: "0px",
          boxSizing: "border-box",
        },
        html: {
          scrollBehavior: "smooth",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          backgroundColor: "inherit",
          transition: "filter 0.3s ease-in-out",
          "&:hover": {
            filter: "brightness(1.1)",
          },
        },
      },
      defaultProps: {
        disableElevation: true,
        disableRipple: true,
      },
    },
  },
  typography: {
    fontFamily: "'Fira Sans', 'Fredoka One', 'Inter'",
    button: {
      textTransform: "none",
    },
    h1: {
      fontSize: "42px",
    },
    h2: {
      fontSize: "32px",
    },
    h3: {
      fontSize: "21px",
    },
    h4: {
      fontSize: "18px",
    },
    h5: {
      fontSize: "16px",
    },
    h6: {
      fontSize: "14px",
    },
    body1: {
      fontSize: "1rem",
    },
    body2: {
      fontSize: "0.875rem",
    },
  },
  spacing: 8, // Customize the base spacing unit (default is 8)
  shape: {
    borderRadius: 4, // Customize the border radius of components
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 1160,
      lg: 1280,
      xl: 1920,
    },
  },
});

const darkTheme = createTheme({
  ...commonThemeOptions,
  palette: {
    mode: "dark",
    primary: {
      main: "#0085ff",
      // dark: "#043596",
      light: "#70BAFF",
    },
    secondary: {
      main: "#F29999",
      //   light: "#5657b1",
      //   dark: "#302F40"
    },
    background: {
      default: "#27282c",
    },
    text: {
      primary: "#ffffff",
      secondary: "#464646",
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        "body::-webkit-scrollbar-track": {
          backgroundColor: "#27282c",
        },
        "body::-webkit-scrollbar-track:hover": {
          backgroundColor: "#27282c",
        },
        "body::-webkit-scrollbar": {
          width: "16px",
          height: "10px",
          backgroundColor: "#27282c",
        },
        "body::-webkit-scrollbar-thumb": {
          backgroundColor: "#171a27",
          borderRadius: "8px",
          backgroundClip: "content-box",
          border: "4px solid transparent",
        },
        "body::-webkit-scrollbar-thumb:hover": {
          backgroundColor: "#0e1018",
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
              "0px 4px 5px 0px hsla(0,0%,0%,0.14), 0px 1px 10px 0px hsla(0,0%,0%,0.12), 0px 2px 4px -1px hsla(0,0%,0%,0.2)",
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          transition: "filter 0.3s ease-in-out",
          "&:hover": {
            cursor: "pointer",
            backgroundColor: "inherit",
            boxShadow:
              "0px 4px 5px 0px hsla(0,0%,0%,0.14), 0px 1px 10px 0px hsla(0,0%,0%,0.12), 0px 2px 4px -1px hsla(0,0%,0%,0.2)",
          },
        },
      },
      defaultProps: {
        disableElevation: true,
        disableRipple: true,
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

export { darkTheme };
