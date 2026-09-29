import { createTheme } from '@mui/material/styles'


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

const lightTheme = createTheme({
  ...commonThemeOptions,
  palette: {
    mode: 'light',
    primary: {
      main: '#dce9ff',
      dark: '#c6dcff',
      light: '#eff5ff'
    },
    secondary: {
      main: '#1b74c2'
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
})

const darkTheme = createTheme({
  ...commonThemeOptions,
  palette: {
    mode: 'dark',
    primary: {
      main: '#15233b',
      dark: '#0f1a31',
      light: '#22385a'
    },
    secondary: {
      main: '#39afff'
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
})

export { lightTheme, darkTheme }
