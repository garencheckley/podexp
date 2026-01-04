import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  CircularProgress
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already logged in
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await login();
      navigate('/');
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in cancelled. Please try again.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Pop-up blocked. Please allow pop-ups for this site.');
      } else {
        setError('Failed to sign in. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '80vh',
        px: 2
      }}
    >
      <Card
        elevation={2}
        sx={{
          maxWidth: 400,
          width: '100%',
          borderRadius: 4
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            Sign In
          </Typography>

          <Typography
            variant="body1"
            color="text.secondary"
            align="center"
            sx={{ mb: 4 }}
          >
            Sign in with your Google account to access your podcasts.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleGoogleLogin}
            disabled={isSubmitting}
            startIcon={isSubmitting ? null : <GoogleIcon />}
            sx={{
              py: 1.5,
              position: 'relative',
              fontWeight: 'normal',
              background: 'linear-gradient(145deg, #2c3e50, #1a252f)',
              '&:hover': {
                background: 'linear-gradient(145deg, #34495e, #2c3e50)',
              },
            }}
          >
            {isSubmitting ? (
              <>
                Signing in...
                <CircularProgress
                  size={24}
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    right: 16,
                    marginTop: '-12px',
                  }}
                />
              </>
            ) : (
              'Continue with Google'
            )}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Login;
