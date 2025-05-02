import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { checkAuthentication, logout } from '../services/api';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  userEmail: string | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Check authentication status on first render
  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const authResult = await checkAuthentication();
        setIsAuthenticated(authResult.status);
        setUserEmail(authResult.email);
      } catch (error) {
        console.error('Auth verification failed:', error);
        setIsAuthenticated(false);
        setUserEmail(null);
      } finally {
        setIsLoading(false);
      }
    };

    // Add a small delay to allow cookie processing after redirect
    const timer = setTimeout(() => {
      verifyAuth();
    }, 150); // Delay in milliseconds

    // Cleanup timer on unmount
    return () => clearTimeout(timer);
  }, []);

  const handleLogout = async () => {
    await logout();
    setIsAuthenticated(false);
    setUserEmail(null);
  };

  const value = {
    isAuthenticated,
    isLoading,
    userEmail,
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