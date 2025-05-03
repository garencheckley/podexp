import React, { createContext, useContext, useState, ReactNode } from 'react';
import { logout as apiLogout } from '../services/api';

// Key for storing the user email in localStorage (mirrors api.ts)
const USER_EMAIL_KEY = 'userEmail';

interface AuthContextType {
  isAuthenticated: boolean;
  userEmail: string | null;
  login: (email: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize state directly from localStorage
  const initialEmail = localStorage.getItem(USER_EMAIL_KEY);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!initialEmail);
  const [userEmail, setUserEmail] = useState<string | null>(initialEmail);

  // Function to handle login (called after token verification)
  const handleLogin = (email: string) => {
    console.log('AuthContext: Logging in with email:', email);
    localStorage.setItem(USER_EMAIL_KEY, email);
    setUserEmail(email);
    setIsAuthenticated(true);
  };

  // Function to handle logout
  const handleLogout = () => {
    console.log('AuthContext: Logging out.');
    apiLogout(); // Calls the api function (which just clears localStorage)
    setIsAuthenticated(false);
    setUserEmail(null);
  };

  const value = {
    isAuthenticated,
    userEmail,
    login: handleLogin,
    logout: handleLogout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 