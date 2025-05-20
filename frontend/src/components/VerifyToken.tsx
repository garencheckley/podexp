import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  CircularProgress, 
  Button, 
  Card, 
  CardContent,
  Alert
} from '@mui/material';
import { verifyToken } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const VerifyToken: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const handleTokenVerification = async () => {
      try {
        const token = searchParams.get('token');
        
        if (!token) {
          setStatus('error');
          return;
        }

        // Call API to verify token and get email
        const verificationResult = await verifyToken(token);
        
        if (verificationResult.success && verificationResult.email) {
          setStatus('success');
          // Call the login function from AuthContext to update state
          login(verificationResult.email);
          console.log('Token verified, context updated, navigating immediately.');
          navigate('/'); 
        } else {
          setStatus('error');
        }
      } catch (error) {
        console.error('Token verification error:', error);
        setStatus('error');
      }
    };

    handleTokenVerification();
  }, [searchParams, navigate, login]);

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        p: 2
      }}
    >
      <Card sx={{ maxWidth: 400, width: '100%' }}>
        <CardContent>
          {status === 'loading' && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h5" gutterBottom>
                Verifying your login...
              </Typography>
              <Typography color="text.secondary" paragraph>
                Please wait while we verify your login.
              </Typography>
              <CircularProgress sx={{ mt: 2 }} />
            </Box>
          )}
          
          {status === 'success' && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h5" gutterBottom color="success.main">
                Login Successful!
              </Typography>
              <Typography color="text.secondary" paragraph>
                You have been logged in successfully.
              </Typography>
              <Typography color="text.secondary">
                Redirecting to the home page...
              </Typography>
            </Box>
          )}
          
          {status === 'error' && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Alert severity="error" sx={{ mb: 3 }}>
                Verification Failed
              </Alert>
              <Typography color="text.secondary" paragraph>
                We couldn't verify your login link. It may have expired or been used already.
              </Typography>
              <Button
                variant="contained"
                onClick={() => navigate('/login')}
                sx={{ mt: 2 }}
              >
                Return to Login
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default VerifyToken; 