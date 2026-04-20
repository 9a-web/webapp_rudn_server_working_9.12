/**
 * Хранилище JWT и данных пользователя в localStorage.
 *
 * Единая точка доступа для AuthContext, axios-интерсептора и компонентов.
 */
import { jwtDecode } from 'jwt-decode';

export const TOKEN_KEY = 'rudn_auth_token';
export const USER_KEY = 'rudn_auth_user';

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
};

export const clearToken = () => {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
};

export const getStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setStoredUser = (user) => {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {}
};

export const clearStoredUser = () => {
  try { localStorage.removeItem(USER_KEY); } catch {}
};

export const clearAuth = () => {
  clearToken();
  clearStoredUser();
};

/**
 * Полная очистка ВСЕХ данных пользователя в localStorage.
 * Используется при удалении аккаунта — чистит и новые (Stage 3 JWT),
 * и старые ключи (user_settings, telegram_user, session_token и т.д.).
 */
export const clearAllLocalAuthData = () => {
  clearAuth();
  const legacyKeys = [
    'telegram_user',
    'synced_user',
    'user_settings',
    'session_token',
    'linked_telegram_id',
    'vk_oauth_state',
    'vk_oauth_verifier',
    'vk_oauth_redirect',
    'vk_oauth_referral',
  ];
  try {
    legacyKeys.forEach((k) => localStorage.removeItem(k));
    // Префиксные ключи: user_settings_*
    const keys = Object.keys(localStorage);
    keys.forEach((k) => {
      if (k.startsWith('user_settings_')) {
        try { localStorage.removeItem(k); } catch {}
      }
    });
    // sessionStorage — VK OAuth остатки
    legacyKeys.forEach((k) => { try { sessionStorage.removeItem(k); } catch {} });
  } catch {}
};

/**
 * Клиентская валидация JWT. Только для UX — реальная проверка на backend.
 */
export const isTokenValid = (token) => {
  if (!token) return false;
  try {
    const { exp } = jwtDecode(token);
    if (!exp) return true;
    return Date.now() < exp * 1000;
  } catch {
    return false;
  }
};

export const decodeToken = (token) => {
  try { return jwtDecode(token); } catch { return null; }
};
