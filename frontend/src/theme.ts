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
          background: 'linear-gradient(145deg, rgba(35, 35, 45, 0.9), rgba(20, 20, 30, 0.95))',
          backdropFilter: 'blur(10px) saturate(180%)',
          '-webkit-backdrop-filter': 'blur(10px) saturate(180%)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.125)',
          boxShadow: 'none',
          color: '#e6edf3',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '50px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          background: 'linear-gradient(145deg, rgba(60, 60, 70, 0.8), rgba(40, 40, 50, 0.85))',
          color: '#e6edf3',
          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
          backdropFilter: 'blur(5px)',
          '-webkit-backdrop-filter': 'blur(5px)',
          textTransform: 'none',
          fontWeight: 'bold',
          transition: 'all 0.3s ease',
          '&:hover': {
            background: 'linear-gradient(145deg, rgba(80, 80, 90, 0.9), rgba(55, 55, 65, 0.95))',
            boxShadow: '0 6px 35px rgba(0, 0, 0, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
          },
        },
        outlined: {
          background: 'transparent',
          border: '1px solid rgba(255, 255, 255, 0.4)',
          color: '#e6edf3',
           '&:hover': {
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.5)',
          },
        },
      },
    },
    MuiTouchRipple: {
      styleOverrides: {
        root: {
          transform: 'none',
        },
      },
    },
    MuiAppBar: {
        styleOverrides: {
            root: {
                backgroundColor: 'transparent',
                boxShadow: 'none',
                borderBottom: 'none',
                backgroundImage: 'none',
            }
        }
    },
    MuiMenu: {
        styleOverrides: {
            paper: {
              background: 'linear-gradient(145deg, rgba(35, 35, 45, 0.9), rgba(20, 20, 30, 0.95))',
              backdropFilter: 'blur(10px) saturate(180%)',
              '-webkit-backdrop-filter': 'blur(10px) saturate(180%)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.125)',
              boxShadow: 'none',
            }
        }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(145deg, rgba(35, 35, 45, 0.9), rgba(20, 20, 30, 0.95))',
          backdropFilter: 'blur(10px) saturate(180%)',
          '-webkit-backdrop-filter': 'blur(10px) saturate(180%)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.125)',
          boxShadow: 'none',
          transition: 'transform 0.3s ease, box-shadow 0.3s ease, background 0.3s ease',
          '&:hover': {
            background: 'linear-gradient(145deg, rgba(45, 45, 55, 0.95), rgba(25, 25, 35, 1))',
            boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
          },
          color: '#e6edf3',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: '#e6edf3',
          '& .MuiSvgIcon-root': {
            color: '#e6edf3',
          },
        },
      },
    },
  },
});

export default theme; 