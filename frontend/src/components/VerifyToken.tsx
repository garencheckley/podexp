import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { verifyToken } from '../services/api';
import '../styles/VerifyToken.css';

const VerifyToken: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const navigate = useNavigate();

  useEffect(() => {
    const handleTokenVerification = async () => {
      try {
        const token = searchParams.get('token');
        
        if (!token) {
          setStatus('error');
          return;
        }

        // Attempt JavaScript-based verification first
        const success = await verifyToken(token);
        
        if (success) {
          setStatus('success');
          
          // Redirect to home page after a short delay
          setTimeout(() => {
            navigate('/');
          }, 2000);
        } else {
          setStatus('error');
        }
      } catch (error) {
        console.error('Token verification error:', error);
        setStatus('error');
      }
    };

    handleTokenVerification();
  }, [searchParams, navigate]);

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