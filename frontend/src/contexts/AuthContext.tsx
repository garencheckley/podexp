import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { checkAuthentication, logout } from '../services/api';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Check authentication status on first render
  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const authStatus = await checkAuthentication();
        setIsAuthenticated(authStatus);
      } catch (error) {
        console.error('Auth verification failed:', error);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    verifyAuth();
  }, []);

  const handleLogout = async () => {
    await logout();
    setIsAuthenticated(false);
  };

  const value = {
    isAuthenticated,
    isLoading,
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