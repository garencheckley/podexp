import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { verifyToken } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import '../styles/VerifyToken.css';

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
    <div className="verify-container">
      {status === 'loading' && (
        <div className="verify-card">
          <h2>Verifying your login...</h2>
          <p>Please wait while we verify your login.</p>
          <div className="loading-spinner"></div>
        </div>
      )}
      
      {status === 'success' && (
        <div className="verify-card success">
          <h2>Login Successful!</h2>
          <p>You have been logged in successfully.</p>
          <p>Redirecting to the home page...</p>
        </div>
      )}
      
      {status === 'error' && (
        <div className="verify-card error">
          <h2>Verification Failed</h2>
          <p>We couldn't verify your login link. It may have expired or been used already.</p>
          <button onClick={() => navigate('/login')}>
            Return to Login
          </button>
        </div>
      )}
    </div>
  );
};

export default VerifyToken; 