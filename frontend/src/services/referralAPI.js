/**
 * API сервис для работы с реферальной системой
 */

import axios from 'axios';
import { getBackendURL } from '../utils/config';

const API_BASE_URL = getBackendURL();

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Получить реферальный код пользователя
 * @param {number} telegram_id - ID пользователя в Telegram
 * @returns {Promise} - { referral_code, referral_link, referral_link_webapp, bot_username }
 */
export const getReferralCode = async (telegram_id) => {
  const response = await api.get(`/referral/code/${telegram_id}`);
  return response.data;
};

/**
 * Получить статистику по рефералам
 * @param {number} telegram_id - ID пользователя в Telegram
 * @returns {Promise} - статистика рефералов
 */
export const getReferralStats = async (telegram_id) => {
  const response = await api.get(`/referral/stats/${telegram_id}`);
  return response.data;
};

/**
 * Получить дерево рефералов
 * @param {number} telegram_id - ID пользователя в Telegram
 * @returns {Promise} - дерево рефералов
 */
export const getReferralTree = async (telegram_id) => {
  const response = await api.get(`/referral/tree/${telegram_id}`);
  return response.data;
};

/**
 * Обработать реферальный код через Web App
 * Вызывается при открытии приложения по ссылке t.me/bot/app?startapp=ref_CODE
 * @param {Object} data - { telegram_id, username, first_name, last_name, referral_code }
 * @returns {Promise} - { success, message, referrer_name, bonus_points }
 */
export const processReferralWebApp = async (data) => {
  const response = await api.post('/referral/process-webapp', data);
  return response.data;
};

/**
 * Трекинг события по админской реферальной ссылке (adref_)
 * event_type: "click" | "registration" | "login"
 * @param {Object} data - { code, event_type, telegram_id?, telegram_username?, telegram_name? }
 * @returns {Promise} - { success, event_type, is_unique, link_name }
 */
export const trackAdminReferralEvent = async (data) => {
  try {
    const response = await api.post('/admin/referral-track', data);
    return response.data;
  } catch (error) {
    console.error('❌ Ошибка трекинга реферального события:', error);
    return { success: false, message: error?.response?.data?.detail || 'Ошибка' };
  }
};

export default {
  getReferralCode,
  getReferralStats,
  getReferralTree,
  processReferralWebApp,
  trackAdminReferralEvent,
};
