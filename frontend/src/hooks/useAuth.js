import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react';
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

  // Il token JWT dura 30gg; se scade a metà sessione l'API risponde 401
  // e qui forziamo il logout con un messaggio invece di un errore criptico.
  useEffect(() => {
    const onExpired = () => {
      sessionStorage.setItem('ct_session_expired', '1');
      logout();
    };
    window.addEventListener('ct:session-expired', onExpired);
    return () => window.removeEventListener('ct:session-expired', onExpired);
  }, []);

  const updateUser = (partialUser) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...partialUser };
      localStorage.setItem('ct_user', JSON.stringify(updated));
      return updated;
    });
  };

  // All'avvio riallinea l'utente salvato con il server (es. ruolo organizzatore assegnato
  // dall'admin dopo il login), senza dover rifare l'accesso.
  useEffect(() => {
    if (!localStorage.getItem('ct_token')) return;
    api.getMe().then(fresh => { if (fresh?.id) updateUser(fresh) }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const value = useMemo(() => ({ user, login, register, logout, updateUser }), [user]);

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return value;
}
