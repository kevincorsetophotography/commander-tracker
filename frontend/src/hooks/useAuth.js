import { createContext, createElement, useContext, useMemo, useState } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);

const getStoredUser = () => {
  const raw = localStorage.getItem('ct_user');

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem('ct_user');
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    return getStoredUser();
  });

  const login = async (username, password) => {
    const { token, user } = await api.login({ username, password });
    localStorage.setItem('ct_token', token);
    localStorage.setItem('ct_user', JSON.stringify(user));
    setUser(user);
    return user;
  };

  const register = async (username, password, inviteCode) => {
    const { token, user } = await api.register({ username, password, inviteCode });
    localStorage.setItem('ct_token', token);
    localStorage.setItem('ct_user', JSON.stringify(user));
    setUser(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem('ct_token');
    localStorage.removeItem('ct_user');
    setUser(null);
  };

  const value = useMemo(() => ({ user, login, register, logout }), [user]);

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return value;
}
