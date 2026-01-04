import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  getIdToken
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

interface AuthContextType {
  isAuthenticated: boolean;
  userEmail: string | null;
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log('AuthContext: Auth state changed:', firebaseUser?.email || 'logged out');
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      console.log('AuthContext: Starting Google sign-in...');
      const result = await signInWithPopup(auth, googleProvider);
      console.log('AuthContext: Logged in as:', result.user.email);
    } catch (error) {
      console.error('AuthContext: Login error:', error);
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      console.log('AuthContext: Logging out...');
      await signOut(auth);
      console.log('AuthContext: Logged out successfully');
    } catch (error) {
      console.error('AuthContext: Logout error:', error);
      throw error;
    }
  };

  const getTokenAsync = async (): Promise<string | null> => {
    if (!user) return null;
    try {
      return await getIdToken(user);
    } catch (error) {
      console.error('AuthContext: Error getting token:', error);
      return null;
    }
  };

  const value: AuthContextType = {
    isAuthenticated: !!user,
    userEmail: user?.email || null,
    user,
    loading,
    login: handleLogin,
    logout: handleLogout,
    getToken: getTokenAsync,
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
