import React, { useState } from 'react';
import { requestLogin } from '../services/api';
import '../styles/Login.css';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      setMessage({ text: 'Please enter a valid email address', type: 'error' });
      return;
    }
    
    setIsSubmitting(true);
    setMessage(null);
    
    try {
      await requestLogin(email);
      setMessage({ 
        text: 'Login link sent! Please check your email inbox.', 
        type: 'success' 
      });
      setEmail('');
    } catch (error) {
      console.error('Login request failed:', error);
      setMessage({ 
        text: 'Failed to send login link. Please try again later.', 
        type: 'error' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Log In to Podcast Generator</h2>
        <p className="login-description">
          Enter your email address below to receive a login link.
          No password needed!
        </p>
        
        {message && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={isSubmitting}
              required
            />
          </div>
          
          <button 
            type="submit" 
            className="login-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Sending...' : 'Send Login Link'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login; 