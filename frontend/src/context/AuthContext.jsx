import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/auth.service';
import { TOKEN_KEY } from '../services/api';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => !!localStorage.getItem(TOKEN_KEY));

  // Restore session on page load
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    authService
      .me()
      .then(setUser)
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  // api.js fires this when the server returns 401
  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, []);

  const startSession = useCallback(({ user, token }) => {
    localStorage.setItem(TOKEN_KEY, token);
    setUser(user);
  }, []);

  const login = useCallback(
    async (payload) => startSession(await authService.login(payload)),
    [startSession]
  );

  const register = useCallback(
    async (payload) => startSession(await authService.register(payload)),
    [startSession]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, isAuthenticated: !!user, login, register, logout, setUser }),
    [user, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}