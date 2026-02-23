import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  driverEmail: string;
  login: (email: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = '@pegasus_session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [driverEmail, setDriverEmail] = useState('');

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const session = await AsyncStorage.getItem(STORAGE_KEY);
      if (session) {
        const { email } = JSON.parse(session);
        setDriverEmail(email);
        setIsAuthenticated(true);
      }
    } catch (error) {
      logger.error('Error checking session', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string): Promise<boolean> => {
    if (!email) return false;

    const session = {
      email,
      timestamp: new Date().toISOString(),
    };

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      setDriverEmail(email);
      setIsAuthenticated(true);
      logger.logAuth('login', email);
      return true;
    } catch (error) {
      logger.error('Error saving session', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      const email = driverEmail;
      await AsyncStorage.removeItem(STORAGE_KEY);
      setIsAuthenticated(false);
      setDriverEmail('');
      logger.logAuth('logout', email);
    } catch (error) {
      logger.error('Error logging out', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        driverEmail,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
