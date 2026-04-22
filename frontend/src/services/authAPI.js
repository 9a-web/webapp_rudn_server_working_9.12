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
  // P4: теперь принимает referral_code как 5й аргумент
  registerEmail: unwrap((email, password, first_name, last_name, referral_code) =>
    axios.post(`${BASE}/register/email`, {
      email, password, first_name, last_name,
      referral_code: referral_code || undefined,
    })),

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
  logoutAll: unwrap((keep_current = true) =>
    axios.post(`${BASE}/logout-all?keep_current=${keep_current ? 'true' : 'false'}`, {}, withAuth())),

  // Linking & profile
  linkEmail: unwrap((email, password) =>
    axios.post(`${BASE}/link/email`, { email, password }, withAuth())),

  linkTelegramWidget: unwrap((widgetData) =>
    axios.post(`${BASE}/link/telegram`, widgetData, withAuth())),

  linkTelegramWebApp: unwrap((init_data) =>
    axios.post(`${BASE}/link/telegram-webapp`, { init_data }, withAuth())),

  linkVK: unwrap(({ code, device_id, redirect_uri, code_verifier, state }) =>
    axios.post(`${BASE}/link/vk`,
      { code, device_id, redirect_uri, code_verifier, state }, withAuth())),

  unlinkProvider: unwrap((provider) =>
    axios.delete(`${BASE}/link/${encodeURIComponent(provider)}`, withAuth())),

  checkUsername: unwrap((username, opts = {}) =>
    axios.get(
      `${BASE}/check-username/${encodeURIComponent(username)}`,
      { ...withAuth(), signal: opts.signal } // Stage 7: B-07 — AbortController support
    )),

  updateProfileStep: unwrap((payload) =>
    axios.patch(`${BASE}/profile-step`, payload, withAuth())),

  // ========== P2: Password management ==========
  changePassword: unwrap((old_password, new_password) =>
    axios.post(`${BASE}/password/change`, { old_password, new_password }, withAuth())),

  forgotPassword: unwrap((email) =>
    axios.post(`${BASE}/password/forgot`, { email })),

  resetPassword: unwrap((token, new_password) =>
    axios.post(`${BASE}/password/reset`, { token, new_password })),

  // ========== P3: Email verification ==========
  sendVerification: unwrap(() =>
    axios.post(`${BASE}/email/send-verification`, {}, withAuth())),

  verifyEmail: unwrap((token) =>
    axios.post(`${BASE}/email/verify`, { token }, withAuth())),

  // ========== P4: Sessions / Devices ==========
  getSessions: unwrap(() =>
    axios.get(`${BASE}/sessions`, withAuth())),

  revokeSession: unwrap((jti) =>
    axios.delete(`${BASE}/sessions/${encodeURIComponent(jti)}`, withAuth())),

  // Public config (bot username, VK app id, features flags)
  config: unwrap(() => axios.get(`${BASE}/config`)),
};
