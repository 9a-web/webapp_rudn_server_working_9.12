/**
 * AuthContext — управление JWT и данными текущего пользователя.
 *
 * Хранит:
 *  - token (JWT из backend)
 *  - user (UserPublic из /api/auth/me)
 *  - loading / error
 *
 * Автоматически:
 *  - подгружает /me при маунте если есть валидный токен
 *  - устанавливает interceptor на axios (Authorization header)
 *  - слушает событие `auth:unauthorized` (401) → logout
 *
 * 🔒 Stage 6 hardening:
 *  - При 500/network ошибке /me НЕ сбрасываем сессию (используем
 *    закэшированного user'а, чтобы не разлогинивать пользователя при
 *    кратковременном отказе backend).
 *  - Только 401/403/404 → clearAuth.
 *  - QR auto-confirm flag для seamless UX cross-device flow.
 */
import React, {
  createContext, useContext, useEffect, useState,
  useCallback, useRef, useMemo,
} from 'react';
import axios from 'axios';
import { authAPI } from '../services/authAPI';
import {
  getToken, setToken, clearAuth,
  getStoredUser, setStoredUser,
  isTokenValid,
} from '../utils/authStorage';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

// HTTP коды, при которых считаем токен невалидным и сбрасываем сессию.
// 500/502/503/504/408/network errors — НЕ сбрасываем (это временный отказ).
const AUTH_INVALIDATE_STATUSES = new Set([401, 403]);

// --- Глобальный axios interceptor (ставится один раз) ---
let _interceptorsInstalled = false;
const installAxiosInterceptors = (onUnauthorized) => {
  if (_interceptorsInstalled) return;
  _interceptorsInstalled = true;

  axios.interceptors.request.use((config) => {
    const token = getToken();
    if (token && !config.headers?.Authorization) {
      // eslint-disable-next-line no-param-reassign
      config.headers = config.headers || {};
      // eslint-disable-next-line no-param-reassign
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  axios.interceptors.response.use(
    (r) => r,
    (err) => {
      const status = err?.response?.status;
      if (status === 401 && getToken()) {
        // На /login и /register 401 — это «неверный пароль», сессию не ломаем.
        const url = err.config?.url || '';
        if (!url.includes('/api/auth/login') && !url.includes('/api/auth/register')) {
          try { onUnauthorized?.(); } catch { /* noop */ }
        }
      }
      return Promise.reject(err);
    },
  );
};

export const AuthProvider = ({ children }) => {
  const [token, setTokenState] = useState(() => {
    const t = getToken();
    return isTokenValid(t) ? t : null;
  });
  const [user, setUserState] = useState(() => getStoredUser());
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState(null);
  const [meError, setMeError] = useState(null); // network/500 errors при /me
  const didInitRef = useRef(false);

  const clearLocalAuth = useCallback(() => {
    clearAuth();
    setTokenState(null);
    setUserState(null);
  }, []);

  const applyAuth = useCallback((newToken, newUser) => {
    setToken(newToken);
    setStoredUser(newUser);
    setTokenState(newToken);
    setUserState(newUser);
    setMeError(null);
  }, []);

  const logout = useCallback(async () => {
    try { await authAPI.logout(); } catch { /* ignore */ }
    clearLocalAuth();
  }, [clearLocalAuth]);

  // Install interceptors once on mount
  useEffect(() => {
    installAxiosInterceptors(() => {
      clearLocalAuth();
    });

    const onUnauth = () => clearLocalAuth();
    window.addEventListener('auth:unauthorized', onUnauth);
    return () => window.removeEventListener('auth:unauthorized', onUnauth);
  }, [clearLocalAuth]);

  const refreshMe = useCallback(async () => {
    const t = getToken();
    if (!t || !isTokenValid(t)) {
      setInitializing(false);
      return null;
    }
    try {
      const me = await authAPI.me();
      setUserState(me);
      setStoredUser(me);
      setMeError(null);
      return me;
    } catch (e) {
      // Опираемся на response.status (надёжнее чем regex по сообщению).
      // axios-interceptor сам сбросит state при 401 — здесь дублируем для надёжности.
      const status = e?.response?.status;
      if (status && AUTH_INVALIDATE_STATUSES.has(status)) {
        clearLocalAuth();
      } else if (status === 404) {
        // user удалён → токен бесполезен
        clearLocalAuth();
      } else {
        // Сетевая или серверная ошибка — НЕ сбрасываем сессию,
        // оставляем закэшированного user'а из localStorage. UX:
        // пользователь не разлогинивается из-за кратковременного отказа.
        setMeError(e?.message || 'Network error');
      }
      return null;
    } finally {
      setInitializing(false);
    }
  }, [clearLocalAuth]);

  // Initial /me fetch
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    if (token && isTokenValid(token)) {
      refreshMe();
    } else {
      if (token && !isTokenValid(token)) {
        clearLocalAuth();
      }
      setInitializing(false);
    }
  }, [token, refreshMe, clearLocalAuth]);

  // --- Auth methods ---

  const _stashUsernameConflict = (resp) => {
    try {
      if (resp?.suggested_username_taken) {
        sessionStorage.setItem(
          'auth:username_conflict',
          JSON.stringify({
            value: resp.suggested_username_taken,
            ts: Date.now(),
          }),
        );
      }
    } catch { /* noop */ }
  };

  const loginEmail = async (email, password) => {
    setLoading(true); setError(null);
    try {
      const resp = await authAPI.loginEmail(email, password);
      applyAuth(resp.access_token, resp.user);
      return resp;
    } catch (e) { setError(e.message); throw e; }
    finally { setLoading(false); }
  };

  const registerEmail = async (email, password, first_name, last_name) => {
    setLoading(true); setError(null);
    try {
      const resp = await authAPI.registerEmail(email, password, first_name, last_name);
      applyAuth(resp.access_token, resp.user);
      _stashUsernameConflict(resp);
      return resp;
    } catch (e) { setError(e.message); throw e; }
    finally { setLoading(false); }
  };

  const loginTelegramWidget = async (widgetData) => {
    setLoading(true); setError(null);
    try {
      const resp = await authAPI.loginTelegramWidget(widgetData);
      applyAuth(resp.access_token, resp.user);
      _stashUsernameConflict(resp);
      return resp;
    } catch (e) { setError(e.message); throw e; }
    finally { setLoading(false); }
  };

  const loginTelegramWebApp = async (init_data, referral_code) => {
    setLoading(true); setError(null);
    try {
      const resp = await authAPI.loginTelegramWebApp(init_data, referral_code);
      applyAuth(resp.access_token, resp.user);
      _stashUsernameConflict(resp);
      return resp;
    } catch (e) { setError(e.message); throw e; }
    finally { setLoading(false); }
  };

  const loginVK = async (payload) => {
    setLoading(true); setError(null);
    try {
      const resp = await authAPI.loginVK(payload);
      applyAuth(resp.access_token, resp.user);
      _stashUsernameConflict(resp);
      return resp;
    } catch (e) { setError(e.message); throw e; }
    finally { setLoading(false); }
  };

  const applyQRResult = (resp) => {
    applyAuth(resp.access_token, resp.user);
    return resp;
  };

  const updateProfile = async (payload) => {
    const updated = await authAPI.updateProfileStep(payload);
    setUserState(updated);
    setStoredUser(updated);
    return updated;
  };

  const value = useMemo(() => ({
    token, user, loading, initializing, error, meError,
    isAuthenticated: !!token && !!user,
    needsOnboarding: !!user && (user.registration_step ?? 0) > 0,
    loginEmail,
    registerEmail,
    loginTelegramWidget,
    loginTelegramWebApp,
    loginVK,
    applyQRResult,
    logout,
    refreshMe,
    updateProfile,
    clearError: () => setError(null),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [token, user, loading, initializing, error, meError]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
