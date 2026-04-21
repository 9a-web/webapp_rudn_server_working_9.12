/**
 * Хранилище JWT и данных пользователя в localStorage.
 *
 * Единая точка доступа для AuthContext, axios-интерсептора и компонентов.
 */
import { jwtDecode } from 'jwt-decode';

export const TOKEN_KEY = 'rudn_auth_token';
export const USER_KEY = 'rudn_auth_user';

// SessionStorage ключи, связанные с auth-flow
const SESSION_AUTH_KEYS = [
  'auth:username_conflict',  // Подсказка о занятом username при login через Telegram/VK
  'vk_oauth_mode',           // 'login' | 'link' — режим VK OAuth
  'vk_oauth_state',          // CSRF state для VK OAuth
  'vk_oauth_verifier',       // PKCE verifier
  'vk_oauth_redirect',       // куда вернуться после VK OAuth
  'vk_oauth_referral',       // реферальный код
  'vk_oauth_continue',       // continueUrl после login через VK
];

// LocalStorage legacy ключи (старая авторизация)
const LEGACY_LOCAL_KEYS = [
  'telegram_user',
  'synced_user',
  'user_settings',
  'session_token',
  'linked_telegram_id',
];

const safeLocalRemove = (k) => {
  try { localStorage.removeItem(k); } catch { /* noop */ }
};

const safeSessionRemove = (k) => {
  try { sessionStorage.removeItem(k); } catch { /* noop */ }
};

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* noop */ }
};

export const clearToken = () => {
  safeLocalRemove(TOKEN_KEY);
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
  } catch { /* noop */ }
};

export const clearStoredUser = () => {
  safeLocalRemove(USER_KEY);
};

export const clearAuth = () => {
  clearToken();
  clearStoredUser();
};

/**
 * Полная очистка ВСЕХ данных пользователя в localStorage + sessionStorage.
 * Используется при удалении аккаунта или logout — чистит и новые
 * (Stage 3 JWT), и старые ключи (user_settings, telegram_user, ...).
 */
export const clearAllLocalAuthData = () => {
  clearAuth();
  try {
    // 1) Local: legacy ключи
    LEGACY_LOCAL_KEYS.forEach(safeLocalRemove);

    // 2) Local: префиксные ключи user_settings_* (legacy профили per-tg-id)
    const lkeys = Object.keys(localStorage);
    lkeys.forEach((k) => {
      if (k.startsWith('user_settings_')) safeLocalRemove(k);
    });

    // 3) Session: все auth-связанные ключи
    SESSION_AUTH_KEYS.forEach(safeSessionRemove);

    // 4) Session: всё начинающееся с auth: или vk_oauth (catch-all)
    const skeys = Object.keys(sessionStorage);
    skeys.forEach((k) => {
      if (k.startsWith('auth:') || k.startsWith('vk_oauth')) {
        safeSessionRemove(k);
      }
    });
  } catch { /* noop */ }
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
