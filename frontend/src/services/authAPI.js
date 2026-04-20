/**
 * API клиент для /api/auth/*
 *
 * Отделён от общего axios.create(), чтобы избежать циклических зависимостей.
 * Каждый вызов сам добавляет Authorization header если нужно.
 */
import axios from 'axios';
import { getBackendURL } from '../utils/config';
import { getToken } from '../utils/authStorage';

const BASE = `${getBackendURL()}/api/auth`;

const withAuth = () => {
  const t = getToken();
  return t ? { headers: { Authorization: `Bearer ${t}` } } : {};
};

const unwrap = (fn) => async (...args) => {
  try {
    const res = await fn(...args);
    return res.data;
  } catch (e) {
    const detail = e?.response?.data?.detail;
    if (Array.isArray(detail)) {
      throw new Error(detail.map(d => `${(d.loc || []).join('.')}: ${d.msg}`).join('; '));
    }
    throw new Error(detail || e?.response?.data?.error || e.message || 'Ошибка авторизации');
  }
};

export const authAPI = {
  // Registration
  registerEmail: unwrap((email, password, first_name, last_name) =>
    axios.post(`${BASE}/register/email`, { email, password, first_name, last_name })),

  // Email login
  loginEmail: unwrap((email, password) =>
    axios.post(`${BASE}/login/email`, { email, password })),

  // Telegram Login Widget (browser)
  loginTelegramWidget: unwrap((widgetData) =>
    axios.post(`${BASE}/login/telegram`, widgetData)),

  // Telegram WebApp initData (внутри бота)
  loginTelegramWebApp: unwrap((init_data, referral_code) =>
    axios.post(`${BASE}/login/telegram-webapp`, { init_data, referral_code })),

  // VK OAuth
  loginVK: unwrap(({ code, device_id, redirect_uri, code_verifier, state, referral_code }) =>
    axios.post(`${BASE}/login/vk`, { code, device_id, redirect_uri, code_verifier, state, referral_code })),

  // QR Login
  qrInit: unwrap(() => axios.post(`${BASE}/login/qr/init`)),
  qrStatus: unwrap((token) => axios.get(`${BASE}/login/qr/${token}/status`)),
  qrConfirm: unwrap((token) => axios.post(`${BASE}/login/qr/${token}/confirm`, {}, withAuth())),

  // Session
  me: unwrap(() => axios.get(`${BASE}/me`, withAuth())),
  logout: unwrap(() => axios.post(`${BASE}/logout`, {}, withAuth())),

  // Linking & profile
  linkEmail: unwrap((email, password) =>
    axios.post(`${BASE}/link/email`, { email, password }, withAuth())),

  checkUsername: unwrap((username) =>
    axios.get(`${BASE}/check-username/${encodeURIComponent(username)}`, withAuth())),

  updateProfileStep: unwrap((payload) =>
    axios.patch(`${BASE}/profile-step`, payload, withAuth())),

  // Public config (bot username, VK app id)
  config: unwrap(() => axios.get(`${BASE}/config`)),
};
