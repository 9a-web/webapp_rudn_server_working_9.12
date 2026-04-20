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
 */
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
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

// --- Глобальный axios interceptor (ставится один раз) ---
let _interceptorsInstalled = false;
const installAxiosInterceptors = (onUnauthorized) => {
  if (_interceptorsInstalled) return;
  _interceptorsInstalled = true;

  axios.interceptors.request.use((config) => {
    const token = getToken();
    if (token && !config.headers?.Authorization) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  axios.interceptors.response.use(
    (r) => r,
    (err) => {
      if (err?.response?.status === 401 && getToken()) {
        // Не на auth-эндпоинтах — иначе login/email при неверном пароле тоже сбрасывает сессию
        const url = err.config?.url || '';
        if (!url.includes('/api/auth/login') && !url.includes('/api/auth/register')) {
          try { onUnauthorized?.(); } catch {}
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
  const didInitRef = useRef(false);

  const applyAuth = useCallback((newToken, newUser) => {
    setToken(newToken);
    setStoredUser(newUser);
    setTokenState(newToken);
    setUserState(newUser);
  }, []);

  const logout = useCallback(async () => {
    try { await authAPI.logout(); } catch { /* ignore */ }
    clearAuth();
    setTokenState(null);
    setUserState(null);
  }, []);

  // Install interceptors once on mount
  useEffect(() => {
    installAxiosInterceptors(() => {
      clearAuth();
      setTokenState(null);
      setUserState(null);
    });

    const onUnauth = () => {
      clearAuth();
      setTokenState(null);
      setUserState(null);
    };
    window.addEventListener('auth:unauthorized', onUnauth);
    return () => window.removeEventListener('auth:unauthorized', onUnauth);
  }, []);

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
      return me;
    } catch (e) {
      if (e?.message?.includes('401') || /не найден|авторизац/i.test(e?.message || '')) {
        clearAuth();
        setTokenState(null);
        setUserState(null);
      }
      return null;
    } finally {
      setInitializing(false);
    }
  }, []);

  // Initial /me fetch
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    if (token && isTokenValid(token)) {
      refreshMe();
    } else {
      if (token && !isTokenValid(token)) {
        clearAuth();
        setTokenState(null);
        setUserState(null);
      }
      setInitializing(false);
    }
  }, [token, refreshMe]);

  // --- Auth methods ---

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
      return resp;
    } catch (e) { setError(e.message); throw e; }
    finally { setLoading(false); }
  };

  const _stashUsernameConflict = (resp) => {
    try {
      if (resp?.suggested_username_taken) {
        sessionStorage.setItem(
          'auth:username_conflict',
          JSON.stringify({
            value: resp.suggested_username_taken,
            ts: Date.now(),
          })
        );
      }
    } catch { /* noop */ }
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

  const value = {
    token, user, loading, initializing, error,
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
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
