/**
 * API Service для системы уведомлений
 */

import axios from 'axios';
import { getBackendURL } from '../utils/config';

const API_BASE = `${getBackendURL()}/api`;

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const handleError = (error) => {
  if (error.response) {
    const detail = error.response.data.detail;
    if (Array.isArray(detail)) {
      throw new Error(detail.map(err => err.msg).join('; '));
    }
    throw new Error(detail || 'Ошибка сервера');
  } else if (error.request) {
    throw new Error('Ошибка сети');
  }
  throw new Error(error.message);
};

export const notificationsAPI = {
  /**
   * Получить список уведомлений
   */
  getNotifications: async (telegramId, limit = 50, offset = 0, unreadOnly = false) => {
    try {
      const params = new URLSearchParams({ limit, offset });
      if (unreadOnly) params.append('unread_only', 'true');
      
      const response = await api.get(`/notifications/${telegramId}?${params}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Получить количество непрочитанных
   */
  getUnreadCount: async (telegramId) => {
    try {
      const response = await api.get(`/notifications/${telegramId}/unread-count`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Отметить уведомление как прочитанное
   */
  markAsRead: async (notificationId, telegramId) => {
    try {
      const response = await api.put(`/notifications/${notificationId}/read`, {
        telegram_id: telegramId
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Отметить все как прочитанные
   */
  markAllAsRead: async (telegramId) => {
    try {
      const response = await api.put(`/notifications/${telegramId}/read-all`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Скрыть уведомление
   */
  dismissNotification: async (notificationId, telegramId) => {
    try {
      const response = await api.delete(`/notifications/${notificationId}`, {
        data: { telegram_id: telegramId }
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Выполнить действие уведомления
   */
  performAction: async (notificationId, telegramId, actionId) => {
    try {
      const response = await api.put(`/notifications/${notificationId}/action`, {
        telegram_id: telegramId,
        action_id: actionId
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Получить настройки уведомлений
   */
  getSettings: async (telegramId) => {
    try {
      const response = await api.get(`/notifications/${telegramId}/settings`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Обновить настройки уведомлений
   */
  updateSettings: async (telegramId, settings) => {
    try {
      const response = await api.put(`/notifications/${telegramId}/settings`, settings);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  }
};

export default notificationsAPI;
