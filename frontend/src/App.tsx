import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { ThemeProvider, CssBaseline, AppBar, Toolbar, Typography, Button, Container, Box } from '@mui/material';
import { theme } from './theme';
import PodcastList from './components/PodcastList';
import PodcastDetail from './components/PodcastDetail';
import CreatePodcastForm from './components/CreatePodcastForm';
import Login from './components/Login';
import VerifyToken from './components/VerifyToken';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './App.css';

const AppHeader: React.FC = () => {
  const { isAuthenticated, logout } = useAuth();
  
  return (
    <AppBar position="static" color="primary" elevation={0}>
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Garen's Podcast Generator
        </Typography>
        <Box>
          {isAuthenticated ? (
            <Button 
              color="inherit" 
              onClick={logout}
              variant="outlined"
              sx={{ 
                borderColor: 'white',
                '&:hover': {
                  borderColor: 'white',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)'
                }
              }}
            >
              Log Out
            </Button>
          ) : (
            <Button 
              component={Link} 
              to="/login" 
              color="inherit"
              variant="outlined"
              sx={{ 
                borderColor: 'white',
                '&:hover': {
                  borderColor: 'white',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)'
                }
              }}
            >
              Log In
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

function AppContent() {
  // Load Roboto font
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  return (
    <Box sx={{ 
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: 'background.default'
    }}>
      <AppHeader />
      <Container component="main" sx={{ 
        flexGrow: 1,
        py: 4,
        display: 'flex',
        flexDirection: 'column'
      }}>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/auth/verify" element={<VerifyToken />} />
          {/* Make Podcast List public */}
          <Route path="/" element={<PodcastList />} /> 
          {/* Make Podcast Detail public */}
          <Route path="/podcasts/:podcastId" element={<PodcastDetail />} /> 
          
          {/* Protected Routes */}
          <Route path="/create-podcast" element={
            <ProtectedRoute>
              <CreatePodcastForm />
            </ProtectedRoute>
          } />
        </Routes>
      </Container>
    </Box>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;
