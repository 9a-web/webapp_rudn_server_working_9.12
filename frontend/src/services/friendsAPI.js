/**
 * API Service для работы с системой друзей
 * Использует REACT_APP_BACKEND_URL из .env
 */

import axios from 'axios';

// Определяем URL backend из env
const getBackendURL = () => {
  let envBackendUrl = '';
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      envBackendUrl = import.meta.env.REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL || '';
    }
    if (!envBackendUrl && typeof process !== 'undefined' && process.env) {
      envBackendUrl = process.env.REACT_APP_BACKEND_URL || '';
    }
  } catch (error) {
    console.warn('Could not access environment variables:', error);
  }
  if (envBackendUrl && envBackendUrl.trim() !== '') {
    return envBackendUrl;
  }
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8001';
  }
  return window.location.origin;
};

const API_BASE = `${getBackendURL()}/api`;

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Обработка ошибок
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

/**
 * API методы для системы друзей
 */
export const friendsAPI = {
  // ========== Поиск и список ==========
  
  searchUsers: async (telegramId, query = '', groupId = null, facultetId = null, limit = 50) => {
    try {
      const params = new URLSearchParams({ telegram_id: telegramId, limit });
      if (query) params.append('query', query);
      if (groupId) params.append('group_id', groupId);
      if (facultetId) params.append('facultet_id', facultetId);
      
      const response = await api.get(`/friends/search?${params}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  getFriends: async (telegramId, favoritesOnly = false, search = '') => {
    try {
      const params = new URLSearchParams();
      if (favoritesOnly) params.append('favorites_only', 'true');
      if (search) params.append('search', search);
      
      const url = `/friends/${telegramId}${params.toString() ? '?' + params : ''}`;
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  getFriendRequests: async (telegramId) => {
    try {
      const response = await api.get(`/friends/${telegramId}/requests`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  getMutualFriends: async (telegramId, otherTelegramId) => {
    try {
      const response = await api.get(`/friends/mutual/${telegramId}/${otherTelegramId}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  getBlockedUsers: async (telegramId) => {
    try {
      const response = await api.get(`/friends/${telegramId}/blocked`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // ========== Действия с друзьями ==========

  sendFriendRequest: async (telegramId, targetTelegramId) => {
    try {
      const response = await api.post(`/friends/request/${targetTelegramId}`, {
        telegram_id: telegramId
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  acceptFriendRequest: async (requestId, telegramId) => {
    try {
      const response = await api.post(`/friends/accept/${requestId}`, {
        telegram_id: telegramId
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  rejectFriendRequest: async (requestId, telegramId) => {
    try {
      const response = await api.post(`/friends/reject/${requestId}`, {
        telegram_id: telegramId
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  cancelFriendRequest: async (requestId, telegramId) => {
    try {
      const response = await api.post(`/friends/cancel/${requestId}`, {
        telegram_id: telegramId
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  removeFriend: async (telegramId, friendTelegramId) => {
    try {
      const response = await api.delete(`/friends/${friendTelegramId}`, {
        data: { telegram_id: telegramId }
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  toggleFavorite: async (telegramId, friendTelegramId, isFavorite) => {
    try {
      const response = await api.post(`/friends/${friendTelegramId}/favorite`, {
        telegram_id: telegramId,
        is_favorite: isFavorite
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  blockUser: async (telegramId, targetTelegramId) => {
    try {
      const response = await api.post(`/friends/block/${targetTelegramId}`, {
        telegram_id: telegramId
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  unblockUser: async (telegramId, targetTelegramId) => {
    try {
      const response = await api.delete(`/friends/block/${targetTelegramId}`, {
        data: { telegram_id: telegramId }
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // ========== Профиль ==========

  getUserProfile: async (telegramId, viewerTelegramId = null) => {
    try {
      const params = viewerTelegramId ? `?viewer_telegram_id=${viewerTelegramId}` : '';
      const response = await api.get(`/profile/${telegramId}${params}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  getFriendSchedule: async (friendTelegramId, viewerTelegramId, date = null) => {
    try {
      const params = new URLSearchParams({ viewer_telegram_id: viewerTelegramId });
      if (date) params.append('date', date);
      
      const response = await api.get(`/profile/${friendTelegramId}/schedule?${params}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  getProfileQR: async (telegramId) => {
    try {
      const response = await api.get(`/profile/${telegramId}/qr`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // ========== Настройки приватности ==========

  getPrivacySettings: async (telegramId) => {
    try {
      const response = await api.get(`/profile/${telegramId}/privacy`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  updatePrivacySettings: async (telegramId, settings) => {
    try {
      const response = await api.put(`/profile/${telegramId}/privacy`, settings);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // ========== Онбординг ==========

  processFriendInvite: async (telegramId, inviterTelegramId, useInviterGroup = false) => {
    try {
      const response = await api.post('/friends/process-invite', {
        telegram_id: telegramId,
        inviter_telegram_id: inviterTelegramId,
        use_inviter_group: useInviterGroup
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  }
};

export default friendsAPI;
