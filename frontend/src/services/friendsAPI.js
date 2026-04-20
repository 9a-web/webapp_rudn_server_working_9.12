/**
 * API Service для работы с системой друзей
 * Использует REACT_APP_BACKEND_URL из .env
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

// Обработка ошибок
const handleError = (error) => {
  if (error.response) {
    const detail = error.response.data?.detail;
    const message = Array.isArray(detail)
      ? detail.map(err => err.msg).join('; ')
      : (detail || 'Ошибка сервера');
    const err = new Error(message);
    err.status = error.response.status;
    err.detail = detail;
    throw err;
  } else if (error.request) {
    const err = new Error('Ошибка сети. Проверьте подключение.');
    err.status = 0;
    err.isNetworkError = true;
    throw err;
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

  getProfileQR: async (telegramId, requesterTelegramId = null) => {
    try {
      const params = requesterTelegramId ? `?requester_telegram_id=${requesterTelegramId}` : '';
      const response = await api.get(`/profile/${telegramId}/qr${params}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // Активность пользователя — заменяет side-effect на GET /profile
  pingActivity: async (telegramId) => {
    try {
      const response = await api.post('/profile/activity-ping', { telegram_id: telegramId });
      return response.data;
    } catch (error) {
      // Не кидаем — это не блокирующая ошибка
      return null;
    }
  },

  // Зарегистрировать просмотр профиля (счётчик у владельца)
  // Stage 7: B-16 — client-side dedup через sessionStorage.
  // Backend и так дедуплицирует по часу, но без client-side защиты
  // каждый открытый таб шлёт запрос при каждой навигации — лишняя нагрузка.
  registerProfileView: async (ownerTelegramId, viewerTelegramId) => {
    try {
      if (typeof window !== 'undefined' && ownerTelegramId && viewerTelegramId) {
        const key = `pv:${ownerTelegramId}:${viewerTelegramId}`;
        const now = Date.now();
        // 1 час = 3600_000 мс (совпадает с backend cutoff)
        const prev = Number(sessionStorage.getItem(key) || 0);
        if (prev && now - prev < 3600_000) {
          return null; // ещё в окне — не дублируем
        }
        sessionStorage.setItem(key, String(now));
      }
      const response = await api.post(`/profile/${ownerTelegramId}/view`, {
        viewer_telegram_id: viewerTelegramId,
      });
      return response.data;
    } catch (error) {
      return null; // не блокирующая
    }
  },

  // Ссылка для шаринга профиля
  getShareLink: async (telegramId) => {
    try {
      const response = await api.get(`/profile/${telegramId}/share-link`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // ========== Настройки приватности ==========

  getPrivacySettings: async (telegramId) => {
    try {
      const response = await api.get(`/profile/${telegramId}/privacy?requester_telegram_id=${telegramId}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  updatePrivacySettings: async (telegramId, settings) => {
    try {
      const response = await api.put(`/profile/${telegramId}/privacy?requester_telegram_id=${telegramId}`, settings);
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
  },

  // ========== Header Граффити (шапка) ==========

  getGraffiti: async (telegramId, requesterTelegramId = null) => {
    try {
      const params = requesterTelegramId ? `?requester_telegram_id=${requesterTelegramId}` : '';
      const response = await api.get(`/profile/${telegramId}/graffiti${params}`);
      return response.data;
    } catch (error) {
      handleError(error);
      throw error;
    }
  },

  saveGraffiti: async (telegramId, graffitiData) => {
    try {
      const response = await api.put(`/profile/${telegramId}/graffiti`, {
        graffiti_data: graffitiData,
        requester_telegram_id: telegramId,
      });
      return response.data;
    } catch (error) {
      handleError(error);
      throw error;
    }
  },

  clearGraffiti: async (telegramId) => {
    try {
      const response = await api.post(`/profile/${telegramId}/graffiti/clear`, {
        requester_telegram_id: telegramId,
      });
      return response.data;
    } catch (error) {
      handleError(error);
      throw error;
    }
  },

  // ========== Wall Граффити (стена под шапкой) ==========

  getWallGraffiti: async (telegramId, requesterTelegramId = null) => {
    try {
      const params = requesterTelegramId ? `?requester_telegram_id=${requesterTelegramId}` : '';
      const response = await api.get(`/profile/${telegramId}/wall-graffiti${params}`);
      return response.data;
    } catch (error) {
      handleError(error);
      throw error;
    }
  },

  saveWallGraffiti: async (profileOwnerId, requesterId, graffitiData) => {
    try {
      const response = await api.put(`/profile/${profileOwnerId}/wall-graffiti`, {
        wall_graffiti_data: graffitiData,
        requester_telegram_id: requesterId,
      });
      return response.data;
    } catch (error) {
      handleError(error);
      throw error;
    }
  },

  clearWallGraffiti: async (telegramId) => {
    try {
      const response = await api.post(`/profile/${telegramId}/wall-graffiti/clear`, {
        requester_telegram_id: telegramId,
      });
      return response.data;
    } catch (error) {
      handleError(error);
      throw error;
    }
  },

  toggleWallGraffitiAccess: async (telegramId) => {
    try {
      const response = await api.put(`/profile/${telegramId}/wall-graffiti/access`, {
        requester_telegram_id: telegramId,
      });
      return response.data;
    } catch (error) {
      handleError(error);
      throw error;
    }
  },

  // ========== Кастомный аватар ==========

  getCustomAvatar: async (telegramId, requesterTelegramId = null) => {
    try {
      const params = requesterTelegramId ? `?requester_telegram_id=${requesterTelegramId}` : '';
      const response = await api.get(`/profile/${telegramId}/avatar${params}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  saveCustomAvatar: async (telegramId, avatarData) => {
    try {
      const response = await api.put(`/profile/${telegramId}/avatar`, {
        avatar_data: avatarData,
        requester_telegram_id: telegramId,
      });
      return response.data;
    } catch (error) {
      handleError(error);
      throw error;
    }
  },

  deleteCustomAvatar: async (telegramId) => {
    try {
      const response = await api.delete(`/profile/${telegramId}/avatar?requester_telegram_id=${telegramId}`);
      return response.data;
    } catch (error) {
      handleError(error);
      throw error;
    }
  },

  // ========== Система уровней ==========

  getUserLevel: async (telegramId) => {
    try {
      const response = await api.get(`/users/${telegramId}/level`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  recalculateXP: async (telegramId) => {
    try {
      const response = await api.post(`/users/${telegramId}/recalculate-xp`);
      return response.data;
    } catch (error) {
      handleError(error);
      throw error;
    }
  },

  getXPBreakdown: async (telegramId) => {
    try {
      const response = await api.get(`/users/${telegramId}/xp-breakdown`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  getXPRewardsInfo: async () => {
    try {
      const response = await api.get('/xp-rewards-info');
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  getPendingLevelUp: async (telegramId) => {
    try {
      const response = await api.get(`/users/${telegramId}/pending-level-up`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // ========== v3: XP History & Daily XP ==========

  getXPHistory: async (telegramId, days = 30) => {
    try {
      const response = await api.get(`/users/${telegramId}/xp-history?days=${days}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  getDailyXP: async (telegramId) => {
    try {
      const response = await api.get(`/users/${telegramId}/daily-xp`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },
};

export default friendsAPI;
