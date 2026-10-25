import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../api/client.js';

const TOKEN_KEY = 'learnhub.accessToken';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));

  const clearSession = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    apiGet('/api/auth/me', token)
      .then((result) => {
        if (!cancelled) setUser(result.user);
      })
      .catch(() => {
        if (!cancelled) clearSession();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [token, clearSession]);

  const acceptAuth = useCallback((result) => {
    sessionStorage.setItem(TOKEN_KEY, result.accessToken);
    setToken(result.accessToken);
    setUser(result.user);
  }, []);

  const login = useCallback(async (email, password) => {
    const result = await apiPost('/api/auth/login', { email, password });
    acceptAuth(result);
    return result.user;
  }, [acceptAuth]);

  const register = useCallback(async (name, email, password) => {
    const result = await apiPost('/api/auth/register', { name, email, password });
    acceptAuth(result);
    return result.user;
  }, [acceptAuth]);

  const value = useMemo(() => ({ token, user, loading, login, register, logout: clearSession }), [token, user, loading, login, register, clearSession]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
