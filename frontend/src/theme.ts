import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#5865f2',
    },
    background: {
      default: '#0d1117',
      paper: 'rgba(30, 30, 40, 0.75)',
    },
    text: {
      primary: '#e6edf3',
      secondary: '#8b949e',
    },
  },
  typography: {
    fontFamily: "'Inter', sans-serif",
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage: 'linear-gradient(180deg, #161b22 0%, #0d1117 100%)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backdropFilter: 'blur(10px) saturate(180%)',
          '-webkit-backdrop-filter': 'blur(10px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.125)',
          borderRadius: '12px',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '20px',
          textTransform: 'none',
          padding: '10px 20px',
          fontWeight: 'normal',
        },
        outlined: {
          border: '1px solid rgba(255, 255, 255, 0.3)',
          color: '#fff',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.5)',
          },
        },
        contained: {
          backgroundColor: '#4A4A5A',
          boxShadow: 'none',
          '&:hover': {
            backgroundColor: '#5A5A6A',
            boxShadow: 'none',
          },
        },
      },
    },
    MuiAppBar: {
        styleOverrides: {
            root: {
                backgroundColor: 'transparent',
                boxShadow: 'none',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            }
        }
    },
    MuiMenu: {
        styleOverrides: {
            paper: {
                backgroundColor: 'rgba(25, 25, 35, 0.85) !important',
                backdropFilter: 'blur(10px)',
                '-webkit-backdrop-filter': 'blur(10px)',
            }
        }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(30, 30, 40, 0.75)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.125)',
        },
      },
    },
  },
});

export default theme; 