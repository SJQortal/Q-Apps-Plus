import { createTheme, type ThemeOptions } from '@mui/material/styles'


// Extend the Theme interface

const commonThemeOptions = {
  typography: {
    fontFamily: [
      "var(--qapp-font-sans, 'Lexend', sans-serif)"
    ].join(','),
    h1: {
      fontSize: '2rem',
      fontWeight: 600
    },
    h2: {
      fontSize: '1.75rem',
      fontWeight: 500
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 500
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 500
    },
    h5: {
      fontSize: '1rem',
      fontWeight: 500
    },
    h6: {
      fontSize: '0.875rem',
      fontWeight: 500
    },
    body1: {
      fontSize: '1rem',
      fontWeight: 400,
      lineHeight: 1.5,
      letterSpacing: '0.5px'
    },

    body2: {
      fontSize: '0.875rem',
      fontWeight: 400,
      lineHeight: 1.4,
      letterSpacing: '0.2px'
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
        root: {
          backgroundColor: 'inherit',
          transition: 'filter 0.3s ease-in-out',
          '&:hover': {
            filter: 'brightness(1.1)'
          }
        }
      },
      defaultProps: {
        disableElevation: true,
        disableRipple: true
      }
    },
    MuiModal: {
      styleOverrides: {
        root: {
          zIndex: 50000,
        },
      }

    }
  }
}

const lightThemeOptions: ThemeOptions = {
  ...commonThemeOptions,
  palette: {
    mode: 'light',
    // The original accent (#1b74c2) as text or an outline reads at 4.3:1 on
    // these pale surfaces, so primary.main is one step deeper (5.8:1); the
    // soft blues of the old primary live on as primary.light.
    primary: {
      main: '#155f9f',
      dark: '#0f4a7f',
      light: '#dce9ff',
      contrastText: '#ffffff'
    },
    secondary: {
      main: '#1b74c2'
    },
    // MUI's default red reads at 4.3:1 on these surfaces as text (error
    // states, "Could not open"); one step deeper gives 4.9:1.
    error: {
      main: '#c62828'
    },
    background: {
      default: '#e7f0ff',
      paper: '#f3f8ff'
    },
    text: {
      primary: '#132744',
      secondary: '#3f5678'
    }
  },

  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow:
            '0 8px 24px rgba(21, 43, 72, 0.09)',
          borderRadius: '8px',
          transition: 'all 0.3s ease-in-out',
          '&:hover': {
            cursor: 'pointer',
            boxShadow: '0 12px 26px rgba(21, 43, 72, 0.13)'
          }
        }
      }
    },
    MuiIcon: {
      defaultProps: {
        style: {
          color: '#132744'
        }
      }
    }
  },
}

const darkThemeOptions: ThemeOptions = {
  ...commonThemeOptions,
  palette: {
    mode: 'dark',
    // The original accent (--qmail-brand) as primary: 7.8:1 on the navy
    // surfaces. The old navy primary is kept as primary.dark for fills.
    primary: {
      main: '#39afff',
      dark: '#15233b',
      light: '#67c3ff',
      contrastText: '#0b1220'
    },
    secondary: {
      main: '#39afff'
    },
    // A red that reads as text on the navy (5.4:1) and carries dark text as
    // a fill (5.4:1); MUI's default dark red managed neither (3.7:1).
    error: {
      main: '#ef5350',
      contrastText: '#0b1220'
    },

    background: {
      default: '#0b1220',
      paper: '#131f35'
    },
    text: {
      primary: '#e9f2ff',
      secondary: '#a8bfdc'
    }
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.34)',
          borderRadius: '8px',
          transition: 'all 0.3s ease-in-out',
          '&:hover': {
            cursor: 'pointer',
            boxShadow: '0 14px 34px rgba(0, 0, 0, 0.42)'
          }
        }
      }
    },
    MuiIcon: {
      defaultProps: {
        style: {
          color: '#e9f2ff'
        }
      }
    }
  },
}

const lightTheme = createTheme(lightThemeOptions)
const darkTheme = createTheme(darkThemeOptions)

// The options objects feed the theme kit's Hub 2.0 ("Q-Mail Classic") theme;
// the built themes stay for anything that still wants them.
export { lightTheme, darkTheme, lightThemeOptions, darkThemeOptions }
