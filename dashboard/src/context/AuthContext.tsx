import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  apiKey: string | null;
  userEmail: string | null;
  isReady: boolean;
  login: (key: string, email?: string) => void;
  logout: () => void;
  setUnauthorized: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem('pipeline_api_key');
    if (stored) {
      setApiKeyState(stored);
    }
    const storedEmail = localStorage.getItem('pipeline_user_email');
    if (storedEmail) {
      setUserEmail(storedEmail);
    }
    setIsReady(true);
  }, []);

  const login = (key: string, email?: string) => {
    localStorage.setItem('pipeline_api_key', key);
    setApiKeyState(key);
    if (email) {
      localStorage.setItem('pipeline_user_email', email);
      setUserEmail(email);
    }
    navigate('/');
  };

  const logout = () => {
    localStorage.removeItem('pipeline_api_key');
    localStorage.removeItem('pipeline_user_email');
    setApiKeyState(null);
    setUserEmail(null);
    navigate('/login');
  };

  const setUnauthorized = () => {
    localStorage.removeItem('pipeline_api_key');
    localStorage.removeItem('pipeline_user_email');
    setApiKeyState(null);
    setUserEmail(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ apiKey, userEmail, isReady, login, logout, setUnauthorized }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
